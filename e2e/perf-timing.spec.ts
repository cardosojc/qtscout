import { test, expect } from '@playwright/test'
import { TEST_USER } from './helpers/auth'

/**
 * Slowness measurement (no manual steps): reuses the stored ADMIN session,
 * navigates the real pages, and harvests the `Server-Timing` header the API
 * sets on every response (auth / profiledb / handler / total) plus the
 * client-side resource-timing waterfall and per-page wall times.
 *
 * It asserts only that the instrumentation is present; the value is the printed
 * tables. Run: `npx playwright test perf-timing` (the API's Server-Timing header
 * is emitted regardless of DEBUG_TIMING). Diagnostic — remove with the rest of
 * the timing scaffolding.
 */

type Hops = { auth: number; profiledb: number; handler: number; total: number }

function parseServerTiming(header: string | undefined): Hops | null {
  if (!header) return null
  const dur = (k: string) => {
    const m = header.match(new RegExp(`${k};dur=([\\d.]+)`))
    return m ? parseFloat(m[1]) : 0
  }
  return { auth: dur('auth'), profiledb: dur('profiledb'), handler: dur('handler'), total: dur('total') }
}

// Pages to load fresh, with the page <h1> proving the route rendered (a role
// heading, so it never matches the hidden sidebar nav <a> of the same text).
const PAGES: { label: string; url: string; heading: string }[] = [
  { label: 'meetings (cold app load)', url: '/meetings', heading: 'Reuniões' },
  { label: 'membros', url: '/membros', heading: 'Membros' },
  { label: 'documents', url: '/documents', heading: 'Documentos' },
  { label: 'meetings (warm re-nav)', url: '/meetings', heading: 'Reuniões' },
]

test('measure per-page API timing budget', async ({ page }) => {
  // Dev-server route compiles (Turbopack) and the cold app boot are slow; give
  // the whole walk room. For real numbers prefer a built app or a warm server.
  test.setTimeout(240_000)

  // Sign in fresh rather than trusting the shared storageState — the e2e
  // global.setup is broken post-migration (Prisma import), so the stored token
  // is stale and would bounce us to /auth/signin. Clear cookies first so the
  // stale session doesn't short-circuit the sign-in page. Wait for /meetings
  // (login lands there, not '/', which is why the signIn helper would hang).
  await page.context().clearCookies()
  await page.goto('/auth/signin')
  await page.locator('#email').fill(TEST_USER.email)
  await page.locator('#password').fill(TEST_USER.password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/meetings', { timeout: 120_000 })

  const samples: { path: string; hops: Hops }[] = []
  page.on('response', (res) => {
    const path = new URL(res.url()).pathname
    if (!path.startsWith('/api/')) return
    const hops = parseServerTiming(res.headers()['server-timing'])
    if (hops) samples.push({ path, hops })
  })

  const navRows: { page: string; wallMs: number; apiCalls: number }[] = []
  let firstWaterfall: { path: string; startMs: number; durMs: number }[] = []

  // The auth provider can client-side redirect while booting, detaching the
  // frame mid-navigation (net::ERR_ABORTED). Retry, and use 'commit' so we don't
  // wait on a load that the redirect interrupts.
  const safeGoto = async (url: string) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await page.goto(url, { waitUntil: 'commit' })
        return
      } catch (e) {
        if (!String(e).includes('ERR_ABORTED')) throw e
        await page.waitForTimeout(1_000)
      }
    }
  }

  // First load also warms the dev-server route compile; let auth settle once.
  await safeGoto('/meetings')
  await page.getByRole('heading', { name: 'Reuniões' }).waitFor({ timeout: 120_000 })

  for (const { label, url, heading } of PAGES) {
    const before = samples.length
    const t0 = Date.now()
    await safeGoto(url)
    await page.getByRole('heading', { name: heading }).waitFor({ timeout: 60_000 })
    // Brief settle for late SWR fetches. Avoid networkidle — Next dev's HMR
    // socket keeps the network "active" and it never settles.
    await page.waitForTimeout(1_500)
    const wallMs = Date.now() - t0

    navRows.push({ page: label, wallMs, apiCalls: samples.length - before })

    if (firstWaterfall.length === 0) {
      firstWaterfall = await page.evaluate(() =>
        (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
          .filter((e) => e.name.includes('/api/'))
          .map((e) => ({
            path: new URL(e.name).pathname,
            startMs: Math.round(e.startTime),
            durMs: Math.round(e.duration),
          }))
          .sort((a, b) => a.startMs - b.startMs),
      )
    }
  }

  // Per-endpoint server-side aggregates.
  const byPath = new Map<string, Hops[]>()
  for (const s of samples) {
    const list = byPath.get(s.path) ?? []
    list.push(s.hops)
    byPath.set(s.path, list)
  }
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b)
    return Math.round(s[Math.floor(s.length / 2)] * 10) / 10
  }
  const endpointRows = [...byPath.entries()].map(([path, hops]) => ({
    path,
    n: hops.length,
    auth: median(hops.map((h) => h.auth)),
    profiledb: median(hops.map((h) => h.profiledb)),
    handler: median(hops.map((h) => h.handler)),
    total: median(hops.map((h) => h.total)),
  }))

  console.log('\n=== Per-page wall time (ms) + # API calls ===')
  console.table(navRows)
  console.log('\n=== First-load client waterfall (resource timing, ms from nav start) ===')
  console.table(firstWaterfall)
  console.log('\n=== Per-endpoint server breakdown, median ms (auth = Supabase hop) ===')
  console.table(endpointRows)

  // The only hard assertion: the Server-Timing instrumentation is live.
  expect(samples.length, 'no Server-Timing headers captured from /api/* responses').toBeGreaterThan(0)
})
