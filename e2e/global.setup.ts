import { test as setup } from '@playwright/test'
import { TEST_USER } from './helpers/auth'

setup('authenticate', async ({ page }) => {
  // Sign in via the UI and persist the session to storageState
  await page.goto('/auth/signin')

  await page.locator('#email').fill(TEST_USER.email)
  await page.locator('#password').fill(TEST_USER.password)
  await page.locator('button[type="submit"]').click()

  // Wait for successful redirect to home page
  await page.waitForURL('/')

  // Verify we're logged in by checking for the welcome message
  await page.getByText(`Bem-vindo, ${TEST_USER.name}`).waitFor({ timeout: 10_000 })

  // Save signed-in state
  await page.context().storageState({ path: '.auth/user.json' })
})
