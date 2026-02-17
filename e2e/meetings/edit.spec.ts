import { test, expect } from '@playwright/test'
import { createTestMeeting } from '../helpers/meeting'
import { MEETING_DATA } from '../helpers/fixtures'

test.describe('Meeting Edit', () => {
  let meetingUrl: string

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: '.auth/user.json' })
    const page = await context.newPage()
    meetingUrl = await createTestMeeting(page, {
      location: MEETING_DATA.location,
    })
    await context.close()
  })

  test('form is pre-populated with existing data', async ({ page }) => {
    await page.goto(`${meetingUrl}/edit`)
    await page.waitForLoadState('networkidle')

    // Title should say "Editar Reunião"
    await expect(page.getByRole('heading', { name: 'Editar Reunião' })).toBeVisible()

    // Location should be pre-filled
    const locationInput = page.locator('input[placeholder="Local da reunião"]')
    await expect(locationInput).toHaveValue(MEETING_DATA.location)
  })

  test('update and submit redirects to detail with changes', async ({ page }) => {
    await page.goto(`${meetingUrl}/edit`)
    await page.waitForLoadState('networkidle')

    const newLocation = 'Local Atualizado E2E'
    await page.locator('input[placeholder="Local da reunião"]').fill(newLocation)

    await page.getByRole('button', { name: 'Atualizar Reunião' }).click()

    // Should redirect to detail page
    await page.waitForURL(/\/meetings\/[a-zA-Z0-9-]+$/)

    // Updated location should be visible
    await expect(page.getByText(newLocation)).toBeVisible()
  })

  test('cancel navigates back to detail page', async ({ page }) => {
    await page.goto(`${meetingUrl}/edit`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Cancelar' }).click()

    // Should go back to the detail page
    await page.waitForURL(/\/meetings\/[a-zA-Z0-9-]+$/)
    await expect(page).not.toHaveURL(/\/edit$/)
  })
})
