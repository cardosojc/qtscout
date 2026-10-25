import { Page, expect } from '@playwright/test'

// Consecutive days from tomorrow: unique within a run (each run gets a fresh
// database) and inside the current scout year, which the meetings list shows by
// default. Today itself is left to create.spec.
let meetingDayOffset = 0
function uniqueMeetingDate(): string {
  meetingDayOffset += 1
  const day = new Date(Date.now() + meetingDayOffset * 86_400_000)
  return day.toISOString().split('T')[0]
}

export async function createTestMeeting(page: Page, overrides: {
  date?: string
  location?: string
  agendaTitle?: string
} = {}) {
  // Only one meeting per type and day is allowed, so each test meeting gets its
  // own date unless the test pins one.
  const today = overrides.date ?? uniqueMeetingDate()

  await page.goto('/meetings/new')
  await page.waitForLoadState('networkidle')

  // Select meeting type (first available)
  const select = page.locator('select').first()
  await select.waitFor({ state: 'visible' })
  const options = select.locator('option')
  const count = await options.count()
  if (count > 1) {
    const value = await options.nth(1).getAttribute('value')
    if (value) await select.selectOption(value)
  }

  // Fill date
  await page.locator('input[type="date"]').first().fill(today)

  // Fill location
  if (overrides.location) {
    await page.locator('input[placeholder="Local da reunião"]').fill(overrides.location)
  }

  // Add agenda item
  if (overrides.agendaTitle) {
    const agendaInput = page.locator('input[placeholder="Escreva o ponto e pressione Enter"]')
    await agendaInput.fill(overrides.agendaTitle)
    await agendaInput.press('Enter')
  }

  // Submit
  await page.getByRole('button', { name: 'Criar Reunião' }).click()

  // Wait for redirect to the detail page. Exclude /meetings/new (the form URL)
  // so we don't resolve before the post-create redirect actually happens.
  await page.waitForURL(/\/meetings\/(?!new$)[a-zA-Z0-9-]+$/)

  return page.url()
}

export async function deleteTestMeetings(page: Page) {
  await page.goto('/meetings')
  await page.waitForLoadState('networkidle')

  // Delete all visible meetings created by test user
  while (true) {
    const deleteBtn = page.getByRole('button', { name: 'Eliminar' }).first()
    if (!(await deleteBtn.isVisible().catch(() => false))) break

    await deleteBtn.click()

    // Confirm in dialog
    const confirmBtn = page.getByRole('dialog').getByRole('button', { name: 'Eliminar' })
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click()
      await page.waitForTimeout(500)
    } else {
      break
    }
  }
}
