import { test, expect } from '@playwright/test'
import { createTestMeeting } from '../helpers/meeting'

test.describe('Meeting Delete', () => {
  test('delete with confirm removes meeting', async ({ page }) => {
    // Create a meeting to delete
    await createTestMeeting(page, { location: 'Para Eliminar E2E' })

    await page.goto('/meetings')
    await page.waitForLoadState('networkidle')

    // Find and click delete on the meeting
    const deleteBtn = page.getByRole('button', { name: 'Eliminar' }).first()
    await deleteBtn.click()

    // Confirm deletion in dialog
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Eliminar reunião')).toBeVisible()

    await dialog.getByRole('button', { name: 'Eliminar' }).click()

    // Success toast should appear
    await expect(page.getByText('Reunião eliminada com sucesso')).toBeVisible()
  })

  test('cancel delete keeps meeting visible', async ({ page }) => {
    // Create a meeting
    await createTestMeeting(page, { location: 'Não Eliminar E2E' })

    await page.goto('/meetings')
    await page.waitForLoadState('networkidle')

    // Click delete
    const deleteBtn = page.getByRole('button', { name: 'Eliminar' }).first()
    await deleteBtn.click()

    // Cancel in dialog
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Cancelar' }).click()

    // Dialog should close
    await expect(dialog).not.toBeVisible()

    // Meeting should still be there
    await expect(page.getByRole('button', { name: 'Eliminar' }).first()).toBeVisible()
  })
})
