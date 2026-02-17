import { test, expect } from '@playwright/test'
import { createTestMeeting } from '../helpers/meeting'
import { MEETING_DATA } from '../helpers/fixtures'

test.describe('PDF Generation', () => {
  let meetingUrl: string
  let meetingId: string

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: '.auth/user.json' })
    const page = await context.newPage()
    meetingUrl = await createTestMeeting(page, {
      location: MEETING_DATA.location,
      agendaTitle: MEETING_DATA.agendaTitle,
    })
    meetingId = meetingUrl.split('/').pop()!
    await context.close()
  })

  test('Gerar PDF button on detail page shows inline preview', async ({ page }) => {
    await page.goto(meetingUrl)
    await page.waitForLoadState('networkidle')

    const pdfBtn = page.getByRole('button', { name: 'Gerar PDF' })
    await expect(pdfBtn).toBeVisible()

    await pdfBtn.click()

    // Button text should change while loading
    await expect(page.getByRole('button', { name: /Gerando|Fechar PDF/ })).toBeVisible({
      timeout: 30_000,
    })

    // Once generated, an iframe should appear for preview
    await page.locator('iframe').waitFor({ state: 'visible', timeout: 30_000 })
    await expect(page.locator('iframe')).toBeVisible()

    // "Descarregar PDF" link should appear
    await expect(page.getByRole('link', { name: 'Descarregar PDF' })).toBeVisible()

    // Button should now say "Fechar PDF"
    await expect(page.getByRole('button', { name: 'Fechar PDF' })).toBeVisible()
  })

  test('Fechar PDF button hides the preview', async ({ page }) => {
    await page.goto(meetingUrl)
    await page.waitForLoadState('networkidle')

    // Open PDF preview
    await page.getByRole('button', { name: 'Gerar PDF' }).click()
    await page.locator('iframe').waitFor({ state: 'visible', timeout: 30_000 })

    // Close it
    await page.getByRole('button', { name: 'Fechar PDF' }).click()

    // Iframe and download link should disappear
    await expect(page.locator('iframe')).not.toBeVisible()
    await expect(page.getByRole('link', { name: 'Descarregar PDF' })).not.toBeVisible()

    // Button should revert to "Gerar PDF"
    await expect(page.getByRole('button', { name: 'Gerar PDF' })).toBeVisible()
  })

  test('PDF page shows heading and download button', async ({ page }) => {
    await page.goto(`/meetings/${meetingId}/pdf`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Gerar PDF da Reunião' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Descarregar PDF|Gerando/ })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Voltar à Reunião' })).toBeVisible()
  })

  test('PDF page download button returns a PDF file', async ({ page }) => {
    await page.goto(`/meetings/${meetingId}/pdf`)
    await page.waitForLoadState('networkidle')

    // Wait for auto-download to finish (loading spinner goes away)
    await page.getByRole('button', { name: 'Descarregar PDF' }).waitFor({ timeout: 30_000 })

    // Click download and intercept the response
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      page.getByRole('button', { name: 'Descarregar PDF' }).click(),
    ])

    // Verify it's a PDF
    const filename = download.suggestedFilename()
    expect(filename).toMatch(/\.pdf$/)
  })

  test('PDF API returns valid PDF content-type', async ({ page }) => {
    const response = await page.request.get(`/api/meetings/${meetingId}/pdf`)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('application/pdf')
    expect(response.headers()['content-disposition']).toContain('.pdf')

    const body = await response.body()
    expect(body.length).toBeGreaterThan(0)
    // PDF files start with %PDF
    expect(body.toString('utf-8', 0, 5)).toBe('%PDF-')
  })

  test('Voltar à Reunião link goes back to detail page', async ({ page }) => {
    await page.goto(`/meetings/${meetingId}/pdf`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('link', { name: 'Voltar à Reunião' }).click()
    await expect(page).toHaveURL(meetingUrl)
  })
})
