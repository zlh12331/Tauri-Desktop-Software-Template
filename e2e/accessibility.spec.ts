import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

const isMacOS = process.platform === 'darwin'
const modifierKey = isMacOS ? 'Meta' : 'Control'

/**
 * Opens the Preferences dialog via the command palette.
 * Returns a locator scoped to the dialog.
 */
async function openPreferences(page: Page) {
  // Wait for the app to fully load before sending keyboard shortcuts.
  await expect(page.getByText('Hello World')).toBeVisible({ timeout: 15000 })
  await page.keyboard.press(`${modifierKey}+k`)
  const commandDialog = page.getByRole('dialog', { name: /command palette/i })
  await expect(commandDialog).toBeVisible()
  await commandDialog.getByPlaceholder(/command|search/i).fill('preferences')
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: /^preferences$/i })
  await expect(dialog).toBeVisible()
  return dialog
}

test.describe('Accessibility (WCAG 2.1 AA)', () => {
  // AxeBuilder analysis + Vite dev server cold start need extra time
  test.setTimeout(60000)

  test.beforeEach(async ({ mockPage }) => {
    await mockPage.goto('http://localhost:1420/', {
      waitUntil: 'domcontentloaded',
    })
  })

  test('main window has no accessibility violations', async ({
    mockPage,
    analyzeA11y,
  }) => {
    await expect(mockPage.getByText('Hello World')).toBeVisible({
      timeout: 15000,
    })
    await analyzeA11y(mockPage)
  })

  test('command palette has no accessibility violations', async ({
    mockPage,
    analyzeA11y,
  }) => {
    await expect(mockPage.getByText('Hello World')).toBeVisible({
      timeout: 15000,
    })
    await mockPage.keyboard.press(`${modifierKey}+k`)
    await expect(
      mockPage.getByRole('dialog', { name: /command palette/i })
    ).toBeVisible()
    await analyzeA11y(mockPage)
  })

  test('preferences dialog has no accessibility violations', async ({
    mockPage,
    analyzeA11y,
  }) => {
    await openPreferences(mockPage)
    await analyzeA11y(mockPage)
  })

  test('preferences appearance tab has no accessibility violations', async ({
    mockPage,
    analyzeA11y,
  }) => {
    const dialog = await openPreferences(mockPage)
    await dialog.getByRole('button', { name: /^appearance$/i }).click()
    // Wait for theme combobox to appear
    await expect(
      dialog.getByText('Choose your preferred color theme', { exact: true })
    ).toBeVisible()
    await analyzeA11y(mockPage)
  })

  test('preferences advanced tab has no accessibility violations', async ({
    mockPage,
    analyzeA11y,
  }) => {
    const dialog = await openPreferences(mockPage)
    await dialog.getByRole('button', { name: /^advanced$/i }).click()
    await expect(
      dialog.getByRole('heading', { name: 'API Configuration' })
    ).toBeVisible()
    await analyzeA11y(mockPage)
  })
})
