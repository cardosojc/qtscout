import { test, expect } from '@playwright/test'
import { createTestMeeting } from '../helpers/meeting'
import { MEETING_DATA } from '../helpers/fixtures'

test.describe('Meetings List', () => {
  test('shows meetings page with heading', async ({ page }) => {
    await page.goto('/meetings')
    await expect(page.getByRole('heading', { name: 'Reuniões' })).toBeVisible()
  })

  test('empty state shows "Criar Primeira Reunião" link', async ({ page }) => {
    // Navigate to meetings — if no meetings exist, should show empty state
    // (this depends on test data; the test checks the structure is correct)
    await page.goto('/meetings')
    await page.waitForLoadState('networkidle')

    const emptyMsg = page.getByText('Ainda não há reuniões criadas.')
    const meetingCards = page.locator('text=Ver').first()

    // Either we have meetings or the empty state
    const hasEmpty = await emptyMsg.isVisible().catch(() => false)
    const hasMeetings = await meetingCards.isVisible().catch(() => false)

    expect(hasEmpty || hasMeetings).toBeTruthy()

    if (hasEmpty) {
      await expect(page.getByRole('link', { name: 'Criar Primeira Reunião' })).toBeVisible()
    }
  })

  test('meeting card has action buttons', async ({ page }) => {
    // Create a meeting first
    await createTestMeeting(page, { location: MEETING_DATA.location })

    await page.goto('/meetings')
    await page.waitForLoadState('networkidle')

    // Should have action buttons on the first meeting card
    await expect(page.getByRole('link', { name: 'Ver' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Editar' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'PDF' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Eliminar' }).first()).toBeVisible()
  })

  test('Nova Reunião button links to create page', async ({ page }) => {
    await page.goto('/meetings')

    const newBtn = page.getByRole('link', { name: 'Nova Reunião' }).first()
    await expect(newBtn).toBeVisible()
    await newBtn.click()
    await expect(page).toHaveURL('/meetings/new')
  })
})
