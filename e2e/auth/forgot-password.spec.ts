import { test, expect } from '@playwright/test'

// Auth tests use a fresh context (no storageState)
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Forgot Password', () => {
  test('submit email shows success message', async ({ page }) => {
    await page.goto('/auth/forgot-password')

    await page.locator('#email').fill('any-email@qtscout.test')
    await page.getByRole('button', { name: 'Enviar link de redefinição' }).click()

    await expect(
      page.getByText('Se o email existir no sistema, receberá um link de redefinição de palavra-passe.')
    ).toBeVisible()
  })
})
