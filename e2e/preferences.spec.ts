import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

const isMacOS = process.platform === 'darwin'
const modifierKey = isMacOS ? 'Meta' : 'Control'

test.describe('Preferences dialog', () => {
  test.beforeEach(async ({ mockPage }) => {
    await mockPage.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(mockPage.getByText('Hello World')).toBeVisible({
      timeout: 15000,
    })
  })

  /**
   * Opens the Preferences dialog via the command palette (Ctrl+K /
   * Meta+K on macOS).
   *
   * The title-bar settings button exposes its label through the `title`
   * attribute rather than `aria-label`, which makes role-based lookup
   * unreliable. Opening through the command palette is consistently stable.
   *
   * Returns a locator scoped to the Preferences dialog for further assertions.
   */
  async function openPreferences(page: Page) {
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

  test('opens and shows the title "Preferences"', async ({ mockPage }) => {
    const dialog = await openPreferences(mockPage)

    // The visible "Preferences" title is rendered in the breadcrumb header
    // (the DialogTitle itself is visually hidden via sr-only).
    await expect(
      dialog
        .getByRole('navigation', { name: /breadcrumb/i })
        .getByText('Preferences', { exact: true })
    ).toBeVisible()
  })

  test('shows all three navigation buttons (General, Appearance, Advanced)', async ({
    mockPage,
  }) => {
    const dialog = await openPreferences(mockPage)

    // The preferences sidebar renders navigation buttons (not shadcn Tabs),
    // each labelled with its pane name.
    await expect(
      dialog.getByRole('button', { name: /^general$/i })
    ).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: /^appearance$/i })
    ).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: /^advanced$/i })
    ).toBeVisible()
  })

  test('switching to Appearance tab shows theme selection options (Light, Dark, System)', async ({
    mockPage,
  }) => {
    const dialog = await openPreferences(mockPage)

    await dialog.getByRole('button', { name: /^appearance$/i }).click()

    // The theme field is identified by its unique description text; its
    // combobox opens a Radix Select popover with the theme options.
    const themeField = dialog
      .getByText('Choose your preferred color theme', { exact: true })
      .locator('xpath=..')
    await themeField.getByRole('combobox').click()

    // Select options render in a portal at the document body level.
    await expect(mockPage.getByRole('option', { name: 'Light' })).toBeVisible()
    await expect(mockPage.getByRole('option', { name: 'Dark' })).toBeVisible()
    await expect(mockPage.getByRole('option', { name: 'System' })).toBeVisible()
  })

  test('switching to Advanced tab shows advanced settings content', async ({
    mockPage,
  }) => {
    const dialog = await openPreferences(mockPage)

    await dialog.getByRole('button', { name: /^advanced$/i }).click()

    // The Advanced pane renders an "API Configuration" section (alongside an
    // "Example Advanced Settings" section); both are always present.
    await expect(
      dialog.getByRole('heading', { name: 'API Configuration' })
    ).toBeVisible()
  })

  test.describe('closing the preferences dialog', () => {
    test('can be closed via the Escape key', async ({ mockPage }) => {
      const dialog = await openPreferences(mockPage)

      await mockPage.keyboard.press('Escape')

      await expect(dialog).not.toBeVisible()
    })

    test('can be closed via the Close button', async ({ mockPage }) => {
      const dialog = await openPreferences(mockPage)

      await dialog.getByRole('button', { name: /close/i }).click()

      await expect(dialog).not.toBeVisible()
    })
  })
})
