import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

const isMacOS = process.platform === 'darwin'
const modifierKey = isMacOS ? 'Meta' : 'Control'

async function openPreferences(page: Page) {
  // Wait for the app to fully load before sending keyboard shortcuts.
  // Without this, Ctrl+K may be pressed before the shortcut handler is registered.
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

test.describe('General Preferences Pane', () => {
  test.beforeEach(async ({ mockPage }) => {
    await mockPage.goto('http://localhost:1420/', {
      waitUntil: 'domcontentloaded',
    })
  })

  test('shows Keyboard Shortcuts section with quick pane shortcut', async ({
    mockPage,
  }) => {
    const dialog = await openPreferences(mockPage)

    // General is the default active pane
    await expect(
      dialog.getByRole('heading', { name: 'Keyboard Shortcuts' })
    ).toBeVisible()
    await expect(
      dialog.getByText('Quick Pane Shortcut', { exact: true })
    ).toBeVisible()
    await expect(
      dialog.getByText(
        'Global keyboard shortcut to toggle the quick pane from any application',
        { exact: true }
      )
    ).toBeVisible()
  })

  test('shows System section with launch at startup toggle', async ({
    mockPage,
  }) => {
    const dialog = await openPreferences(mockPage)

    await expect(dialog.getByRole('heading', { name: 'System' })).toBeVisible()
    await expect(
      dialog.getByText('Launch at Startup', { exact: true })
    ).toBeVisible()
  })

  test('shows Example Settings section with text input and toggle', async ({
    mockPage,
  }) => {
    const dialog = await openPreferences(mockPage)

    await expect(
      dialog.getByRole('heading', { name: 'Example Settings' })
    ).toBeVisible()
    await expect(
      dialog.getByText('Example Text Setting', { exact: true })
    ).toBeVisible()
    await expect(
      dialog.getByText('Example Toggle Setting', { exact: true })
    ).toBeVisible()
  })

  test('example text input accepts user input', async ({ mockPage }) => {
    const dialog = await openPreferences(mockPage)

    const textInput = dialog.getByPlaceholder('Enter example text')
    await expect(textInput).toBeVisible()

    await textInput.fill('Test value 123')
    await expect(textInput).toHaveValue('Test value 123')
  })

  test('example toggle switches between Enabled and Disabled', async ({
    mockPage,
  }) => {
    const dialog = await openPreferences(mockPage)

    // The toggle starts enabled (label shows "Enabled")
    await expect(dialog.locator('#example-toggle')).toBeChecked()

    // Click to disable
    await dialog.locator('#example-toggle').click()
    await expect(dialog.locator('#example-toggle')).not.toBeChecked()

    // Click to re-enable
    await dialog.locator('#example-toggle').click()
    await expect(dialog.locator('#example-toggle')).toBeChecked()
  })

  test('autostart toggle is visible and toggleable', async ({ mockPage }) => {
    const dialog = await openPreferences(mockPage)

    // The Switch component forwards the id prop to the underlying button
    const autostartSwitch = dialog.locator('#autostart-toggle')
    await expect(autostartSwitch).toBeVisible()

    // Mock returns false for isAutostartEnabled, so it starts unchecked
    await expect(autostartSwitch).not.toBeChecked()

    // Click to enable
    await autostartSwitch.click()
    await expect(autostartSwitch).toBeChecked()
  })

  test('shortcut picker is visible with default value', async ({
    mockPage,
  }) => {
    const dialog = await openPreferences(mockPage)

    // The shortcut picker button displays the current shortcut.
    // On Windows it shows "Ctrl+Shift+.", on macOS "⌘⇧."
    const shortcutButton = dialog.getByRole('button', {
      name: /ctrl|⌘|command/i,
    })
    await expect(shortcutButton).toBeVisible()
  })
})
