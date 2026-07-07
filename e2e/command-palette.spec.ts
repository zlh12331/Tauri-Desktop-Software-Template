import { test, expect } from './fixtures'

const isMacOS = process.platform === 'darwin'
const modifierKey = isMacOS ? 'Meta' : 'Control'

test.describe('Command Palette', () => {
  test.beforeEach(async ({ mockPage }) => {
    await mockPage.goto('http://localhost:1420/')
  })

  test('opens with keyboard shortcut (Ctrl+K on Windows/Linux, Meta+K on macOS)', async ({
    mockPage,
  }) => {
    await expect(
      mockPage.getByRole('dialog', { name: /command palette/i })
    ).toBeHidden()

    await mockPage.keyboard.press(`${modifierKey}+k`)

    await expect(
      mockPage.getByRole('dialog', { name: /command palette/i })
    ).toBeVisible()
  })

  test('search input is visible and focused when opened', async ({
    mockPage,
  }) => {
    await mockPage.keyboard.press(`${modifierKey}+k`)

    const searchInput = mockPage.getByPlaceholder(/search/i)
    await expect(searchInput).toBeVisible()
    await expect(searchInput).toBeFocused()
  })

  test('typing in search filters commands', async ({ mockPage }) => {
    await mockPage.keyboard.press(`${modifierKey}+k`)

    const searchInput = mockPage.getByPlaceholder(/search/i)
    await searchInput.fill('sidebar')

    // Sidebar-related commands are filtered and shown. cmdk filters by the
    // command value/label, so non-matching commands (e.g. "Close Window")
    // are no longer rendered. toBeVisible() auto-waits for the list update.
    await expect(mockPage.getByText(/left sidebar/i).first()).toBeVisible()
    await expect(mockPage.getByText(/right sidebar/i).first()).toBeVisible()
  })

  test('shows "No results found" for non-matching search', async ({
    mockPage,
  }) => {
    await mockPage.keyboard.press(`${modifierKey}+k`)

    const searchInput = mockPage.getByPlaceholder(/search/i)
    await searchInput.fill('zzzznonexistentcommand')

    await expect(mockPage.getByText(/no results found/i)).toBeVisible()
  })

  test('navigating to a command and pressing Enter executes it', async ({
    mockPage,
  }) => {
    await mockPage.keyboard.press(`${modifierKey}+k`)

    const searchInput = mockPage.getByPlaceholder(/search/i)
    await searchInput.fill('preferences')

    const preferencesCommand = mockPage.getByText(/open preferences/i)
    await expect(preferencesCommand).toBeVisible()

    await mockPage.keyboard.press('Enter')

    await expect(
      mockPage.getByRole('dialog', { name: /command palette/i })
    ).toBeHidden()
    await expect(
      mockPage.getByRole('heading', { name: /preferences/i })
    ).toBeVisible()
  })
})
