import { test, expect } from '@playwright/test'
import { TEST_USER } from '../helpers/auth'

test.describe('Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('all sidebar links work', async ({ page }) => {
    // "Reuniões" link
    const reunioesLink = page.getByRole('navigation').getByRole('link', { name: 'Reuniões' })
    await expect(reunioesLink).toBeVisible()
    await expect(reunioesLink).toHaveAttribute('href', '/meetings')

    // "Nova Reunião" link
    const novaLink = page.getByRole('navigation').getByRole('link', { name: 'Nova Reunião' })
    await expect(novaLink).toBeVisible()
    await expect(novaLink).toHaveAttribute('href', '/meetings/new')

    // "Pesquisar" link
    const pesquisarLink = page.getByRole('navigation').getByRole('link', { name: /Pesquisar/ })
    await expect(pesquisarLink).toBeVisible()
    await expect(pesquisarLink).toHaveAttribute('href', '/search')
  })

  test('shows user name', async ({ page }) => {
    await expect(page.getByText(TEST_USER.name)).toBeVisible()
  })

  test('shows ⌘K badge on search link', async ({ page }) => {
    const kbd = page.getByRole('navigation').locator('kbd')
    // Badge may be hidden on small screens, check it exists
    await expect(kbd).toHaveText('⌘K')
  })
})
