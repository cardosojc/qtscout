import { test, expect } from '@playwright/test'
import { createTestMeeting } from '../helpers/meeting'
import { MEETING_DATA } from '../helpers/fixtures'

test.describe('Meeting Detail', () => {
  let meetingUrl: string

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: '.auth/user.json' })
    const page = await context.newPage()
    meetingUrl = await createTestMeeting(page, {
      location: MEETING_DATA.location,
      agendaTitle: MEETING_DATA.agendaTitle,
    })
    await context.close()
  })

  test('displays meeting identifier and info', async ({ page }) => {
    await page.goto(meetingUrl)
    await page.waitForLoadState('networkidle')

    // Should show identifier in heading
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()

    // Should show location
    await expect(page.getByText(MEETING_DATA.location)).toBeVisible()
  })

  test('shows agenda items', async ({ page }) => {
    await page.goto(meetingUrl)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Ordem de Trabalhos')).toBeVisible()
    await expect(page.getByText(MEETING_DATA.agendaTitle)).toBeVisible()
  })

  test('edit button navigates correctly', async ({ page }) => {
    await page.goto(meetingUrl)
    await page.waitForLoadState('networkidle')

    await page.getByRole('link', { name: 'Editar' }).click()
    await expect(page).toHaveURL(/\/edit$/)
  })

  test('shows meeting info section', async ({ page }) => {
    await page.goto(meetingUrl)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Informações')).toBeVisible()
    await expect(page.getByText('Criado por:')).toBeVisible()
    await expect(page.getByText('Criado em:')).toBeVisible()
  })

  test('back link works', async ({ page }) => {
    await page.goto(meetingUrl)
    await page.waitForLoadState('networkidle')

    await page.getByText('← Voltar às Reuniões').click()
    await expect(page).toHaveURL('/meetings')
  })
})
