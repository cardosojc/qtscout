import { test as setup } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { TEST_USER } from './helpers/auth'

// Provisions the test user's profile and the meeting types directly via the
// Supabase service-role client (PostgREST), which bypasses RLS. There is no
// auth user anymore: sign-in is Cloudflare Access in production, and locally the
// API runs with AUTH_MODE=dev as AUTH_DEV_EMAIL (= TEST_USER.email).
async function ensureTestData() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. ' +
      'Set them in .env.local (local) or GitHub Secrets (CI).'
    )
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1. Ensure the profile row, matched by email (the identity the API uses).
  //    `createdAt`/`updatedAt` are NOT NULL with no DB default (Prisma used to
  //    manage them in-app), so we set them explicitly.
  const now = new Date().toISOString()
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', TEST_USER.email)
    .maybeSingle()

  const { error: profileError } = existingProfile
    ? await supabase
        .from('profiles')
        .update({ name: TEST_USER.name, role: 'ADMIN', updatedAt: now })
        .eq('id', existingProfile.id)
    : await supabase.from('profiles').insert({
        id: randomUUID(),
        username: TEST_USER.username,
        email: TEST_USER.email,
        name: TEST_USER.name,
        role: 'ADMIN',
        createdAt: now,
        updatedAt: now,
      })
  if (profileError) throw new Error(`Failed to provision profile: ${profileError.message}`)

  // 2. Ensure the meeting types exist. ignoreDuplicates so an existing row's id
  //    (referenced by meetings.meetingTypeId) is never rewritten; the generated
  //    id + timestamps are only used when inserting a brand-new row.
  const { error: typesError } = await supabase.from('meeting_types').upsert(
    [
      { id: randomUUID(), code: 'CA', name: 'Conselho de Agrupamento', description: 'Reunião do conselho', createdAt: now, updatedAt: now },
      { id: randomUUID(), code: 'RD', name: 'Reunião de Direção', description: 'Reunião da direção', createdAt: now, updatedAt: now },
    ],
    { onConflict: 'code', ignoreDuplicates: true }
  )
  if (typesError) throw new Error(`Failed to upsert meeting types: ${typesError.message}`)
}

setup('provision test user and load the app', async ({ page }) => {
  await ensureTestData()

  // The authenticated home redirects to /meetings once the profile loads from
  // the API, which confirms the browser -> /api (dev auth) path end-to-end.
  await page.goto('/')
  await page.waitForURL('**/meetings', { timeout: 30_000 })
  await page.getByRole('link', { name: 'Reuniões' }).first().waitFor({ timeout: 15_000 })

  await page.context().storageState({ path: '.auth/user.json' })
})
