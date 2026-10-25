import { test as setup } from '@playwright/test'

// The test user (ADMIN) and the meeting types are seeded by the API's webServer
// command (apps/api/scripts/local_db.py --seed) into a throwaway SQLite
// database. There is no sign-in: Cloudflare Access does that in production, and
// locally the API runs with AUTH_MODE=dev as that user.
setup('load the app as the test user', async ({ page }) => {
  // The authenticated home redirects to /meetings once the profile loads from
  // the API, which confirms the browser -> /api (dev auth) path end-to-end.
  await page.goto('/')
  await page.waitForURL('**/meetings', { timeout: 30_000 })
  await page.getByRole('link', { name: 'Reuniões' }).first().waitFor({ timeout: 15_000 })

  await page.context().storageState({ path: '.auth/user.json' })
})
