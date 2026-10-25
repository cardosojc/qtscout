import { test, expect } from '@playwright/test'

test.describe('Dashboard — Home Page', () => {
  // No "not signed in" case: in production Cloudflare Access handles sign-in
  // before the app loads, and locally the API authenticates every request as
  // the test user (AUTH_MODE=dev).
  test('authenticated user is redirected to /meetings', async ({ page }) => {
    // The home page redirects signed-in users to /meetings once the profile
    // loads (a few auth round-trips). Use waitUntil:'commit' so the initial
    // navigation doesn't race with the client redirect (which can abort a
    // 'load' wait), and allow generous time for the auth chain.
    test.setTimeout(45_000)
    await page.goto('/', { waitUntil: 'commit' })
    await page.waitForURL('**/meetings', { timeout: 30_000 })
    await expect(page.getByRole('heading', { name: 'Reuniões' })).toBeVisible()
  })
})
