import { test, expect } from './fixtures'
import type { Page, Locator } from '@playwright/test'

const isMacOS = process.platform === 'darwin'
const modifierKey = isMacOS ? 'Meta' : 'Control'

test.describe('Theme and Language Settings', () => {
  test.beforeEach(async ({ mockPage }) => {
    await mockPage.goto('http://localhost:1420/', {
      waitUntil: 'domcontentloaded',
    })
  })

  /**
   * Opens the Preferences dialog via the command palette (Ctrl+K on
   * Windows/Linux, Meta+K on macOS).
   *
   * The title-bar settings button exposes its label through the `title`
   * attribute rather than `aria-label`, which makes role-based lookup
   * unreliable. Opening through the command palette is consistently stable.
   *
   * Returns a locator scoped to the Preferences dialog for further assertions.
   */
  async function openPreferences(page: Page): Promise<Locator> {
    // Wait for the app to fully load before sending keyboard shortcuts.
    await expect(page.getByText('Hello World')).toBeVisible({ timeout: 15000 })
    await page.keyboard.press(`${modifierKey}+k`)

    const commandDialog = page.getByRole('dialog', { name: /command palette/i })
    await expect(commandDialog).toBeVisible()
    await commandDialog.getByPlaceholder(/command|search/i).fill('preferences')
    await page.keyboard.press('Enter')

    // The Preferences DialogTitle is visually hidden (sr-only) but still
    // provides the dialog's accessible name ("Preferences").
    const dialog = page.getByRole('dialog', { name: /^preferences$/i })
    await expect(dialog).toBeVisible()
    return dialog
  }

  /**
   * Locates the theme combobox within the Appearance pane.
   *
   * The Appearance pane renders two shadcn Select components (language and
   * theme). The theme field is identified by its unique description text,
   * then the combobox (SelectTrigger) within that field is returned.
   */
  function themeCombobox(dialog: Locator): Locator {
    return dialog
      .getByText('Choose your preferred color theme', { exact: true })
      .locator('xpath=..')
      .getByRole('combobox')
  }

  /**
   * Locates the language combobox within the Appearance pane.
   */
  function languageCombobox(dialog: Locator): Locator {
    return dialog
      .getByText('Choose your preferred display language', { exact: true })
      .locator('xpath=..')
      .getByRole('combobox')
  }

  test('Appearance tab shows theme selection', async ({ mockPage }) => {
    const dialog = await openPreferences(mockPage)

    // Switch to the Appearance pane via the sidebar navigation button.
    await dialog.getByRole('button', { name: /^appearance$/i }).click()

    // Verify the theme combobox (shadcn Select trigger) is visible.
    await expect(themeCombobox(dialog)).toBeVisible()
  })

  test('Selecting Dark theme applies dark theme', async ({ mockPage }) => {
    const dialog = await openPreferences(mockPage)

    await dialog.getByRole('button', { name: /^appearance$/i }).click()

    // Open the theme dropdown and select Dark. The options render in a
    // portaled popover at the document body level.
    await themeCombobox(dialog).click()
    await mockPage.getByRole('option', { name: 'Dark' }).click()

    // Verify the document element receives the dark theme class.
    const className = await mockPage.evaluate(
      () => document.documentElement.className
    )
    expect(className).toContain('dark')
  })

  test('Selecting Light theme reverts', async ({ mockPage }) => {
    const dialog = await openPreferences(mockPage)

    await dialog.getByRole('button', { name: /^appearance$/i }).click()

    // First apply Dark, then switch back to Light.
    await themeCombobox(dialog).click()
    await mockPage.getByRole('option', { name: 'Dark' }).click()

    await themeCombobox(dialog).click()
    await mockPage.getByRole('option', { name: 'Light' }).click()

    // Verify the dark class has been removed from the document element.
    const className = await mockPage.evaluate(
      () => document.documentElement.className
    )
    expect(className).not.toContain('dark')
  })

  test('Language selection dropdown is visible', async ({ mockPage }) => {
    const dialog = await openPreferences(mockPage)

    await dialog.getByRole('button', { name: /^appearance$/i }).click()

    // Verify the language combobox (shadcn Select trigger) is visible.
    await expect(languageCombobox(dialog)).toBeVisible()
  })

  test('Selecting Chinese updates UI text', async ({ mockPage }) => {
    const dialog = await openPreferences(mockPage)

    await dialog.getByRole('button', { name: /^appearance$/i }).click()

    // Open the language dropdown and select Chinese. The option label uses
    // the native name "中文".
    await languageCombobox(dialog).click()
    await mockPage.getByRole('option', { name: /中文|chinese/i }).click()

    // i18n uses lazy loading — the Chinese locale chunk is fetched via
    // dynamic import() after selection. The languageChanged event sets
    // document.documentElement.lang immediately, which is a reliable
    // indicator that the language switch took effect.
    await expect(mockPage.locator('html')).toHaveAttribute('lang', 'zh', {
      timeout: 10000,
    })

    // Verify the UI text has been updated to Chinese by checking the
    // breadcrumb header now reads "偏好设置".
    await expect(
      mockPage
        .getByRole('navigation', { name: /breadcrumb/i })
        .getByText('偏好设置', { exact: true })
    ).toBeVisible({ timeout: 15000 })
  })
})
