import { Page, BrowserContext } from '@playwright/test'

/**
 * Extract the Supabase access token from the restored session cookie, for
 * calling the standalone API directly (Bearer auth) from tests.
 */
export async function getAccessToken(context: BrowserContext): Promise<string> {
  const cookies = await context.cookies()
  const authCookie = cookies.find((c) => c.name.includes('auth-token'))
  if (!authCookie) throw new Error('No Supabase auth cookie found in context')
  const raw = authCookie.value.replace(/^base64-/, '')
  const session = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'))
  return session.access_token as string
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

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
