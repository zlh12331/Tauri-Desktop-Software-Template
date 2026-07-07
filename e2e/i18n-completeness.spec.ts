import { test, expect } from './fixtures'
import type { Page, Locator } from '@playwright/test'

const isMacOS = process.platform === 'darwin'
const modifierKey = isMacOS ? 'Meta' : 'Control'

async function openPreferences(page: Page): Promise<Locator> {
  await page.keyboard.press(`${modifierKey}+k`)
  const commandDialog = page.getByRole('dialog', { name: /command palette/i })
  await expect(commandDialog).toBeVisible()
  await commandDialog.getByPlaceholder(/command|search/i).fill('preferences')
  await page.keyboard.press('Enter')
  // Match dialog in both English ("Preferences") and Chinese ("偏好设置")
  const dialog = page.getByRole('dialog', {
    name: /^preferences$|^偏好设置$/i,
  })
  await expect(dialog).toBeVisible()
  return dialog
}

/**
 * Locates the language combobox within the Appearance pane.
 *
 * Uses the first combobox in the dialog, which is always the language
 * selector (rendered before the theme selector). This is language-
 * independent, so it works after switching to Chinese.
 */
function languageCombobox(dialog: Locator): Locator {
  return dialog.getByRole('combobox').first()
}

test.describe('Internationalization Completeness', () => {
  // Allow extra time for Vite dev server cold start + i18n lazy loading
  test.setTimeout(60000)

  test.beforeEach(async ({ mockPage }) => {
    await mockPage.goto('http://localhost:1420/', {
      waitUntil: 'domcontentloaded',
    })
    await expect(mockPage.getByText('Hello World')).toBeVisible({
      timeout: 15000,
    })
  })

  test('default UI text is in English', async ({ mockPage }) => {
    // Main window heading
    await expect(
      mockPage.getByRole('heading', { name: 'Hello World' })
    ).toBeVisible()

    // Open command palette — title should be in English
    await mockPage.keyboard.press(`${modifierKey}+k`)
    await expect(
      mockPage.getByRole('dialog', { name: /command palette/i })
    ).toBeVisible()
  })

  test('preferences dialog uses English labels by default', async ({
    mockPage,
  }) => {
    const dialog = await openPreferences(mockPage)

    // Pane labels should be in English
    await expect(
      dialog.getByRole('button', { name: /^general$/i })
    ).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: /^appearance$/i })
    ).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: /^advanced$/i })
    ).toBeVisible()

    // Breadcrumb should show "Preferences" in English
    await expect(
      mockPage
        .getByRole('navigation', { name: /breadcrumb/i })
        .getByText('Preferences', { exact: true })
    ).toBeVisible()
  })

  test('language dropdown is visible in Appearance pane', async ({
    mockPage,
  }) => {
    const dialog = await openPreferences(mockPage)
    await dialog.getByRole('button', { name: /^appearance$/i }).click()

    await expect(languageCombobox(dialog)).toBeVisible()
  })

  test('language dropdown lists English and Chinese options', async ({
    mockPage,
  }) => {
    const dialog = await openPreferences(mockPage)
    await dialog.getByRole('button', { name: /^appearance$/i }).click()

    await languageCombobox(dialog).click()

    await expect(
      mockPage.getByRole('option', { name: /english/i })
    ).toBeVisible()
    await expect(
      mockPage.getByRole('option', { name: /中文|chinese/i })
    ).toBeVisible()
  })

  test('language dropdown defaults to System Default', async ({ mockPage }) => {
    const dialog = await openPreferences(mockPage)
    await dialog.getByRole('button', { name: /^appearance$/i }).click()

    const combobox = languageCombobox(dialog)
    await expect(combobox).toContainText(/system default/i)
  })

  test('selecting Chinese updates the dropdown display', async ({
    mockPage,
  }) => {
    const dialog = await openPreferences(mockPage)
    await dialog.getByRole('button', { name: /^appearance$/i }).click()

    await languageCombobox(dialog).click()
    await mockPage.getByRole('option', { name: /中文|chinese/i }).click()

    // The combobox should now display "中文"
    await expect(languageCombobox(dialog)).toContainText(/中文/)
  })

  test('selecting English after Chinese restores dropdown display', async ({
    mockPage,
  }) => {
    const dialog = await openPreferences(mockPage)
    await dialog.getByRole('button', { name: /^appearance$/i }).click()

    // Switch to Chinese
    await languageCombobox(dialog).click()
    await mockPage.getByRole('option', { name: /中文|chinese/i }).click()
    await expect(languageCombobox(dialog)).toContainText(/中文/)

    // Switch back to English
    await languageCombobox(dialog).click()
    await mockPage.getByRole('option', { name: /english/i }).click()

    // The combobox should now display "English"
    await expect(languageCombobox(dialog)).toContainText(/english/i)
  })

  test('command palette search works with English text', async ({
    mockPage,
  }) => {
    await mockPage.keyboard.press(`${modifierKey}+k`)
    const searchInput = mockPage.getByPlaceholder(/command|search/i)
    await searchInput.fill('preferences')

    await expect(
      mockPage.getByRole('option', { name: /preferences/i })
    ).toBeVisible()
  })
})
