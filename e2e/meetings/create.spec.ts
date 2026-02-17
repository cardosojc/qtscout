import { test, expect } from '@playwright/test'
import { MEETING_DATA } from '../helpers/fixtures'

test.describe('Meeting Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/meetings/new')
    await page.waitForLoadState('networkidle')
  })

  test('create meeting with all fields redirects to detail page', async ({ page }) => {
    // Select meeting type
    const select = page.locator('select').first()
    await select.waitFor({ state: 'visible' })
    const options = select.locator('option')
    const value = await options.nth(1).getAttribute('value')
    if (value) await select.selectOption(value)

    // Fill date
    const today = new Date().toISOString().split('T')[0]
    await page.locator('input[type="date"]').first().fill(today)

    // Fill times
    await page.locator('input[type="time"]').first().fill(MEETING_DATA.startTime)
    await page.locator('input[type="time"]').nth(1).fill(MEETING_DATA.endTime)

    // Fill location
    await page.locator('input[placeholder="Local da reunião"]').fill(MEETING_DATA.location)

    // Submit
    await page.getByRole('button', { name: 'Criar Reunião' }).click()

    // Should redirect to detail page
    await page.waitForURL(/\/meetings\/[a-zA-Z0-9-]+$/)
    await expect(page.getByText(MEETING_DATA.location)).toBeVisible()
  })

  test('meeting type dropdown loads CA and RD', async ({ page }) => {
    const select = page.locator('select').first()
    await select.waitFor({ state: 'visible' })

    const optionsText = await select.locator('option').allTextContents()
    expect(optionsText.some(t => t.includes('Conselho de Agrupamento'))).toBeTruthy()
    expect(optionsText.some(t => t.includes('Reunião de Direção'))).toBeTruthy()
  })

  test('add and remove participants', async ({ page }) => {
    const input = page.locator('input[placeholder="Nome do participante"]')
    await input.fill(MEETING_DATA.participant)
    await page.getByRole('button', { name: 'Adicionar' }).first().click()

    // Participant badge should appear
    await expect(page.getByText(MEETING_DATA.participant)).toBeVisible()

    // Remove participant
    const badge = page.locator('span').filter({ hasText: MEETING_DATA.participant })
    await badge.locator('button').click()

    await expect(page.getByText(MEETING_DATA.participant)).not.toBeVisible()
  })

  test('CA type shows Chefe and Secretário fields', async ({ page }) => {
    const select = page.locator('select').first()
    await select.waitFor({ state: 'visible' })

    // Find CA option
    const options = select.locator('option')
    const count = await options.count()
    for (let i = 0; i < count; i++) {
      const text = await options.nth(i).textContent()
      if (text?.includes('Conselho de Agrupamento')) {
        const val = await options.nth(i).getAttribute('value')
        if (val) await select.selectOption(val)
        break
      }
    }

    await expect(page.locator('input[placeholder="Nome do Chefe de Agrupamento"]')).toBeVisible()
    await expect(page.locator('input[placeholder="Nome do Secretário"]')).toBeVisible()
  })

  test('add agenda items via Enter key', async ({ page }) => {
    const agendaInput = page.locator('input[placeholder="Escreva o ponto e pressione Enter"]')
    await agendaInput.fill(MEETING_DATA.agendaTitle)
    await agendaInput.press('Enter')

    // Agenda item should appear with title
    await expect(page.getByText(MEETING_DATA.agendaTitle)).toBeVisible()
    // Input should be cleared
    await expect(agendaInput).toHaveValue('')
  })

  test('expand agenda item shows editor', async ({ page }) => {
    const agendaInput = page.locator('input[placeholder="Escreva o ponto e pressione Enter"]')
    await agendaInput.fill(MEETING_DATA.agendaTitle)
    await agendaInput.press('Enter')

    // The item auto-expands, so TipTap editor should be visible
    await expect(page.locator('.tiptap, .ProseMirror').first()).toBeVisible()

    // "Recolher" button should be visible (since it's expanded)
    await expect(page.getByRole('button', { name: 'Recolher' })).toBeVisible()
  })

  test('add action items inside agenda', async ({ page }) => {
    const agendaInput = page.locator('input[placeholder="Escreva o ponto e pressione Enter"]')
    await agendaInput.fill(MEETING_DATA.agendaTitle)
    await agendaInput.press('Enter')

    // Fill action item fields
    await page.locator('input[placeholder="Descrição da ação"]').fill(MEETING_DATA.actionDescription)
    await page.locator('input[placeholder="Responsável"]').fill(MEETING_DATA.actionResponsible)

    // Click the orange "Adicionar" button for actions
    const addActionBtn = page.locator('button').filter({ hasText: 'Adicionar' }).last()
    await addActionBtn.click()

    // Action item should appear
    await expect(page.getByText(MEETING_DATA.actionDescription)).toBeVisible()
    await expect(page.getByText(MEETING_DATA.actionResponsible)).toBeVisible()
  })

  test('cancel goes back', async ({ page }) => {
    await page.getByRole('button', { name: 'Cancelar' }).click()

    // Should navigate back (previous page)
    // Since we came from goto, behavior may vary; just check we left the new page
    await expect(page).not.toHaveURL('/meetings/new')
  })
})
