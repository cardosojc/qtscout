import { test, expect } from '@playwright/test'
import { TEST_USER } from '../helpers/auth'
import { NEW_USER } from '../helpers/fixtures'

// Auth tests use a fresh context (no storageState)
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Register', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/register')
  })

  test('register new user auto-logs in and redirects to home', async ({ page }) => {
    const uniqueUser = {
      ...NEW_USER,
      username: `e2e-reg-${Date.now()}`,
      email: `e2e-reg-${Date.now()}@qtscout.test`,
    }

    await page.locator('#username').fill(uniqueUser.username)
    await page.locator('#email').fill(uniqueUser.email)
    await page.locator('#name').fill(uniqueUser.name)
    await page.locator('#password').fill(uniqueUser.password)
    await page.locator('#confirmPassword').fill(uniqueUser.password)
    await page.locator('button[type="submit"]').click()

    await page.waitForURL('/', { timeout: 15_000 })
    await expect(page).toHaveURL('/')
  })

  test('existing email shows error', async ({ page }) => {
    await page.locator('#username').fill('unique-username-test')
    await page.locator('#email').fill(TEST_USER.email)
    await page.locator('#name').fill('Test Name')
    await page.locator('#password').fill('Password123!')
    await page.locator('#confirmPassword').fill('Password123!')
    await page.locator('button[type="submit"]').click()

    await expect(page.getByText('Email já está registado')).toBeVisible()
  })

  test('existing username shows error', async ({ page }) => {
    await page.locator('#username').fill(TEST_USER.username)
    await page.locator('#email').fill(`unique-${Date.now()}@qtscout.test`)
    await page.locator('#name').fill('Test Name')
    await page.locator('#password').fill('Password123!')
    await page.locator('#confirmPassword').fill('Password123!')
    await page.locator('button[type="submit"]').click()

    await expect(page.getByText('Nome de utilizador já existe')).toBeVisible()
  })

  test('mismatched passwords shows error', async ({ page }) => {
    await page.locator('#username').fill('mismatch-user')
    await page.locator('#email').fill('mismatch@qtscout.test')
    await page.locator('#name').fill('Mismatch User')
    await page.locator('#password').fill('Password123!')
    await page.locator('#confirmPassword').fill('DifferentPassword!')
    await page.locator('button[type="submit"]').click()

    await expect(page.getByText('As palavras-passe não coincidem')).toBeVisible()
  })
})
