import { test, expect } from '@playwright/test'

test.describe('Theme Toggle', () => {
  test('toggle adds dark class to html element', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const html = page.locator('html')
    const toggleBtn = page.locator('button[aria-label="Toggle theme"]')

    // Get initial state
    const initialClasses = await html.getAttribute('class') ?? ''
    const wasDark = initialClasses.includes('dark')

    // Click toggle
    await toggleBtn.click()

    // Class should have changed
    if (wasDark) {
      await expect(html).not.toHaveClass(/dark/)
    } else {
      await expect(html).toHaveClass(/dark/)
    }

    // Click toggle again to revert
    await toggleBtn.click()

    if (wasDark) {
      await expect(html).toHaveClass(/dark/)
    } else {
      await expect(html).not.toHaveClass(/dark/)
    }
  })

  test('theme persists across navigation', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const html = page.locator('html')
    const toggleBtn = page.locator('button[aria-label="Toggle theme"]')

    // Set to dark mode
    const initialClasses = await html.getAttribute('class') ?? ''
    if (!initialClasses.includes('dark')) {
      await toggleBtn.click()
    }
    await expect(html).toHaveClass(/dark/)

    // Navigate to another page
    await page.goto('/meetings')
    await page.waitForLoadState('networkidle')

    // Should still be dark
    await expect(page.locator('html')).toHaveClass(/dark/)

    // Reset back to light for other tests
    await page.locator('button[aria-label="Toggle theme"]').click()
  })
})
