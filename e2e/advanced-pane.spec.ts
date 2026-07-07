import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

const isMacOS = process.platform === 'darwin'
const modifierKey = isMacOS ? 'Meta' : 'Control'

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

test.describe('Advanced Preferences Pane', () => {
  test.beforeEach(async ({ mockPage }) => {
    await mockPage.goto('http://localhost:1420/', {
      waitUntil: 'domcontentloaded',
    })
  })

  test('shows Example Advanced Settings section', async ({ mockPage }) => {
    const dialog = await openPreferences(mockPage)
    await dialog.getByRole('button', { name: /^advanced$/i }).click()

    await expect(
      dialog.getByRole('heading', { name: 'Example Advanced Settings' })
    ).toBeVisible()
  })

  test('advanced toggle switches state', async ({ mockPage }) => {
    const dialog = await openPreferences(mockPage)
    await dialog.getByRole('button', { name: /^advanced$/i }).click()

    const toggle = dialog.locator('#example-advanced-toggle')
    await expect(toggle).not.toBeChecked()

    await toggle.click()
    await expect(toggle).toBeChecked()

    await toggle.click()
    await expect(toggle).not.toBeChecked()
  })

  test('advanced dropdown shows 3 options and can switch', async ({
    mockPage,
  }) => {
    const dialog = await openPreferences(mockPage)
    await dialog.getByRole('button', { name: /^advanced$/i }).click()

    // Open the native select dropdown
    const dropdown = dialog.getByRole('combobox')
    await dropdown.click()

    // Verify all 3 options are present
    await expect(
      mockPage.getByRole('option', { name: 'Example Option 1' })
    ).toBeVisible()
    await expect(
      mockPage.getByRole('option', { name: 'Example Option 2' })
    ).toBeVisible()
    await expect(
      mockPage.getByRole('option', { name: 'Example Option 3' })
    ).toBeVisible()

    // Select Option 2
    await mockPage.getByRole('option', { name: 'Example Option 2' }).click()

    // Verify the trigger now shows Option 2
    await expect(dropdown).toContainText('Example Option 2')
  })

  test('crash reporting section is visible', async ({ mockPage }) => {
    const dialog = await openPreferences(mockPage)
    await dialog.getByRole('button', { name: /^advanced$/i }).click()

    await expect(
      dialog.getByRole('heading', { name: 'Crash Reporting' })
    ).toBeVisible()
    await expect(
      dialog.getByText('Send crash reports to help improve the app', {
        exact: true,
      })
    ).toBeVisible()
  })

  test('crash reporting toggle can be enabled', async ({ mockPage }) => {
    const dialog = await openPreferences(mockPage)
    await dialog.getByRole('button', { name: /^advanced$/i }).click()

    const toggle = dialog.locator('#crash-reporting-toggle')
    await expect(toggle).not.toBeChecked()

    await toggle.click()

    // Should show success toast
    await expect(
      mockPage.getByText('Crash reporting enabled', { exact: true })
    ).toBeVisible({ timeout: 5000 })

    // Toggle should now be checked
    await expect(toggle).toBeChecked()
  })

  test('crash reporting toggle can be disabled after enabling', async ({
    mockPage,
  }) => {
    const dialog = await openPreferences(mockPage)
    await dialog.getByRole('button', { name: /^advanced$/i }).click()

    const toggle = dialog.locator('#crash-reporting-toggle')

    // Enable first
    await toggle.click()
    await expect(toggle).toBeChecked()

    // Disable
    await toggle.click()

    // Should show info toast
    await expect(
      mockPage.getByText('Crash reporting disabled', { exact: true })
    ).toBeVisible({ timeout: 5000 })

    await expect(toggle).not.toBeChecked()
  })

  test('API Configuration form shows all fields', async ({ mockPage }) => {
    const dialog = await openPreferences(mockPage)
    await dialog.getByRole('button', { name: /^advanced$/i }).click()

    await expect(
      dialog.getByText('API Endpoint', { exact: true })
    ).toBeVisible()
    await expect(dialog.getByText('API Key', { exact: true })).toBeVisible()
    await expect(
      dialog.getByText('Timeout (seconds)', { exact: true })
    ).toBeVisible()
    await expect(dialog.getByText('Retry Count', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Debug Mode', { exact: true })).toBeVisible()
  })

  test('API config form validation: invalid endpoint shows error', async ({
    mockPage,
  }) => {
    const dialog = await openPreferences(mockPage)
    await dialog.getByRole('button', { name: /^advanced$/i }).click()

    // Enter an invalid endpoint (not a URL)
    await dialog.getByPlaceholder('https://api.example.com').fill('not-a-url')

    // Form uses onSubmit mode — submit to trigger validation
    await dialog.getByRole('button', { name: 'Save Configuration' }).click()

    // Validation error should appear
    await expect(
      dialog.getByText('Must be a valid URL', { exact: true })
    ).toBeVisible()
  })

  test('API config form validation: short API key shows error', async ({
    mockPage,
  }) => {
    const dialog = await openPreferences(mockPage)
    await dialog.getByRole('button', { name: /^advanced$/i }).click()

    await dialog.getByPlaceholder('Enter your API key').fill('short')

    // Form uses onSubmit mode — submit to trigger validation
    await dialog.getByRole('button', { name: 'Save Configuration' }).click()

    await expect(
      dialog.getByText('API key must be at least 10 characters', {
        exact: true,
      })
    ).toBeVisible()
  })

  test('API config form submit with valid data shows success toast', async ({
    mockPage,
  }) => {
    const dialog = await openPreferences(mockPage)
    await dialog.getByRole('button', { name: /^advanced$/i }).click()

    // Fill valid data
    await dialog
      .getByPlaceholder('https://api.example.com')
      .fill('https://api.example.com')
    await dialog
      .getByPlaceholder('Enter your API key')
      .fill('valid-api-key-12345')

    // Submit the form
    await dialog.getByRole('button', { name: 'Save Configuration' }).click()

    // Wait for success toast (form simulates async save with 800ms delay)
    await expect(
      mockPage.getByText('API configuration saved successfully', {
        exact: true,
      })
    ).toBeVisible({ timeout: 5000 })
  })
})
