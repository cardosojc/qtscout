import { Page } from '@playwright/test'

export const TEST_USER = {
  email: process.env.E2E_TEST_EMAIL ?? 'e2e-test@qtscout.test',
  password: process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!',
  username: 'e2e-tester',
  name: 'E2E Tester',
  role: 'ADMIN',
}

export async function signIn(page: Page, email = TEST_USER.email, password = TEST_USER.password) {
  await page.goto('/auth/signin')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('/')
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sair' }).click()
  await page.waitForURL('/auth/signin')
}
