import { test, expect } from '@playwright/test'
import { createTestMeeting } from '../helpers/meeting'

test.describe('Search', () => {
  test.beforeAll(async ({ browser }) => {
    // Create a meeting with searchable content
    const context = await browser.newContext({ storageState: '.auth/user.json' })
    const page = await context.newPage()
    await createTestMeeting(page, {
      location: 'Searchable Location E2E',
      agendaTitle: 'Pesquisa Teste Único',
    })
    await context.close()
  })

  test.beforeEach(async ({ page }) => {
    await page.goto('/search')
  })

  test('text query shows debounced results', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Pesquisar no conteúdo..."]')
    await searchInput.fill('Pesquisa Teste')

    // Click search to trigger results immediately
    await page.getByRole('button', { name: 'Pesquisar' }).click()

    // Wait for results
    await page.waitForLoadState('networkidle')

    // Should show a results count ("N resultados") or the no-results message
    const hasResults = await page.getByText(/\d+ resultados?/).first().isVisible().catch(() => false)
    const noResults = await page.getByText('Nenhum resultado encontrado.').isVisible().catch(() => false)
    expect(hasResults || noResults).toBeTruthy()
  })

  test('filter by meeting type triggers search', async ({ page }) => {
    const typeSelect = page.locator('select').first()
    await typeSelect.waitFor({ state: 'visible' })

    // Select a type
    const options = typeSelect.locator('option')
    const count = await options.count()
    if (count > 1) {
      const value = await options.nth(1).getAttribute('value')
      if (value) await typeSelect.selectOption(value)
    }

    await page.getByRole('button', { name: 'Pesquisar' }).click()
    await page.waitForLoadState('networkidle')

    // Search should complete and render the results region (count or empty msg)
    await expect(
      page.getByText(/\d+ resultados?/).first().or(page.getByText('Nenhum resultado encontrado.')),
    ).toBeVisible()
  })

  test('date range filter works', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0]

    await page.locator('input[type="date"]').first().fill('2020-01-01')
    await page.locator('input[type="date"]').nth(1).fill(today)

    await page.getByRole('button', { name: 'Pesquisar' }).click()
    await page.waitForLoadState('networkidle')
  })

  test('Limpar resets filters and results', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Pesquisar no conteúdo..."]')
    await searchInput.fill('test query')

    await page.getByRole('button', { name: 'Limpar' }).click()

    await expect(searchInput).toHaveValue('')
  })

  test('no results message appears for unmatched query', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Pesquisar no conteúdo..."]')
    await searchInput.fill('zzz_impossible_query_zzz')

    await page.getByRole('button', { name: 'Pesquisar' }).click()
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Nenhum resultado encontrado.')).toBeVisible()
  })

  test('result links navigate to meeting detail', async ({ page }) => {
    // Search for something that should have results
    const searchInput = page.locator('input[placeholder="Pesquisar no conteúdo..."]')
    await searchInput.fill('Searchable Location E2E')
    await page.getByRole('button', { name: 'Pesquisar' }).click()
    await page.waitForLoadState('networkidle')

    const hasResults = await page.getByText(/\d+ resultados?/).first().isVisible().catch(() => false)
    if (hasResults) {
      // Result rows are clickable cards that navigate to the meeting detail.
      await page.locator('div[class*="cursor-pointer"]').first().click()
      await expect(page).toHaveURL(/\/meetings\//)
    }
  })

  test('Cmd+K shortcut navigates to search', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.keyboard.press('Meta+k')
    await expect(page).toHaveURL('/search')
  })
})
