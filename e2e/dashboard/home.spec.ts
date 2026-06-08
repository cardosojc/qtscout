import { test, expect } from '@playwright/test'

test.describe('Dashboard — Home Page', () => {
  test('not authenticated shows "Entre na sua conta"', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    await page.goto('/')
    await expect(page.getByText('Entre na sua conta')).toBeVisible()
    await expect(
      page.getByText('Faça login para aceder ao sistema de atas de reunião.')
    ).toBeVisible()

    await context.close()
  })

  test('not authenticated shows system title and footer', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Sistema de Atas de Reunião' })).toBeVisible()
    await expect(page.getByText('CNE - instituição de utilidade pública')).toBeVisible()

    await context.close()
  })

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
