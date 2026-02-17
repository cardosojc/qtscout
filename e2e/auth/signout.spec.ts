import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

test.describe('Sign Out', () => {
  test('clicking Sair redirects to signin page', async ({ browser }) => {
    // Use a fresh context so we can sign in via UI
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    await signIn(page)
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()

    await page.getByRole('button', { name: 'Sair' }).click()
    await page.waitForURL('/auth/signin')
    await expect(page).toHaveURL('/auth/signin')

    await context.close()
  })

  test('protected route shows login prompt when not authenticated', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    await page.goto('/meetings')

    await expect(page.getByText('Precisa fazer login')).toBeVisible()

    await context.close()
  })
})
