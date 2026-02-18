import { test, expect } from '@playwright/test'
import { TEST_USER } from '../helpers/auth'

test.describe('Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('shows top-level Reuniões link', async ({ page }) => {
    const reunioesLink = page.getByRole('navigation').getByRole('link', { name: 'Reuniões' })
    await expect(reunioesLink).toBeVisible()
    await expect(reunioesLink).toHaveAttribute('href', '/meetings')
  })

  test('shows sub-items when in meetings section', async ({ page }) => {
    // Navigate to meetings to expand sub-items
    await page.getByRole('navigation').getByRole('link', { name: 'Reuniões' }).click()
    await page.waitForLoadState('networkidle')

    // "Nova Reunião" sub-item
    const novaLink = page.getByRole('navigation').getByRole('link', { name: 'Nova Reunião' })
    await expect(novaLink).toBeVisible()
    await expect(novaLink).toHaveAttribute('href', '/meetings/new')

    // "Pesquisar" sub-item with ⌘K badge
    const pesquisarLink = page.getByRole('navigation').getByRole('link', { name: /Pesquisar/ })
    await expect(pesquisarLink).toBeVisible()
    await expect(pesquisarLink).toHaveAttribute('href', '/search')

    const kbd = page.getByRole('navigation').locator('kbd')
    await expect(kbd).toHaveText('⌘K')
  })

  test('shows user name', async ({ page }) => {
    await expect(page.getByText(TEST_USER.name)).toBeVisible()
  })
})
