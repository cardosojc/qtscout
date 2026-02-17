import { test, expect } from '@playwright/test'
import { TEST_USER } from '../helpers/auth'

test.describe('Dashboard — Home Page', () => {
  test('not authenticated shows "Entre na sua conta"', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    await page.goto('/')
    await expect(page.getByText('Entre na sua conta')).toBeVisible()
    await expect(
      page.getByText('Faça login para aceder ao sistema de atas de reunião.')
    ).toBeVisible()

    await context.close()
  })

  test('authenticated shows welcome message', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(`Bem-vindo, ${TEST_USER.name}`)).toBeVisible()
    await expect(
      page.getByText('Gerencie as atas das suas reuniões de forma fácil e organizada.')
    ).toBeVisible()
  })

  test('nav buttons are visible and link correctly', async ({ page }) => {
    await page.goto('/')

    const newMeetingLink = page.getByRole('link', { name: 'Nova Reunião' }).first()
    await expect(newMeetingLink).toBeVisible()
    await expect(newMeetingLink).toHaveAttribute('href', '/meetings/new')

    const viewMeetingsLink = page.getByRole('link', { name: 'Ver Reuniões' })
    await expect(viewMeetingsLink).toBeVisible()
    await expect(viewMeetingsLink).toHaveAttribute('href', '/meetings')

    const searchLink = page.getByRole('link', { name: 'Pesquisar' }).first()
    await expect(searchLink).toBeVisible()
    await expect(searchLink).toHaveAttribute('href', '/search')
  })

  test('page shows system title and footer', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Sistema de Atas de Reunião' })).toBeVisible()
    await expect(page.getByText('CNE - instituição de utilidade pública')).toBeVisible()
  })
})
