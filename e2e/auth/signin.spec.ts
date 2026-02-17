import { test, expect } from '@playwright/test'
import { TEST_USER } from '../helpers/auth'
import { INVALID_CREDENTIALS } from '../helpers/fixtures'

// Auth tests use a fresh context (no storageState)
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Sign In', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/signin')
  })

  test('valid login redirects to home with welcome message', async ({ page }) => {
    await page.locator('#email').fill(TEST_USER.email)
    await page.locator('#password').fill(TEST_USER.password)
    await page.locator('button[type="submit"]').click()

    await page.waitForURL('/')
    await expect(page.getByText(`Bem-vindo, ${TEST_USER.name}`)).toBeVisible()
  })

  test('invalid credentials shows error message', async ({ page }) => {
    await page.locator('#email').fill(INVALID_CREDENTIALS.email)
    await page.locator('#password').fill(INVALID_CREDENTIALS.password)
    await page.locator('button[type="submit"]').click()

    await expect(page.getByText('Email ou palavra-passe incorretos')).toBeVisible()
  })

  test('empty fields keep submit button disabled', async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"]')
    await expect(submitBtn).toBeDisabled()

    // Fill only email — still disabled
    await page.locator('#email').fill(TEST_USER.email)
    await expect(submitBtn).toBeDisabled()
  })

  test('forgot password link navigates correctly', async ({ page }) => {
    await page.getByText('Esqueceu a palavra-passe?').click()
    await expect(page).toHaveURL('/auth/forgot-password')
  })

  test('register link navigates correctly', async ({ page }) => {
    await page.getByText('Não tem conta? Registar-se').click()
    await expect(page).toHaveURL('/auth/register')
  })

  test('callbackUrl redirects after login', async ({ page }) => {
    await page.goto('/auth/signin?callbackUrl=/meetings')
    await page.locator('#email').fill(TEST_USER.email)
    await page.locator('#password').fill(TEST_USER.password)
    await page.locator('button[type="submit"]').click()

    await page.waitForURL('/meetings')
    await expect(page).toHaveURL('/meetings')
  })
})
