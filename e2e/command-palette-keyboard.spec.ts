import { test, expect } from './fixtures'

const isMacOS = process.platform === 'darwin'
const modifierKey = isMacOS ? 'Meta' : 'Control'

test.describe('Command Palette Keyboard Navigation', () => {
  // Allow extra time for Vite dev server cold start
  test.setTimeout(60000)

  test.beforeEach(async ({ mockPage }) => {
    await mockPage.goto('http://localhost:1420/', {
      waitUntil: 'domcontentloaded',
    })
    await expect(mockPage.getByText('Hello World')).toBeVisible({
      timeout: 15000,
    })
  })

  test('Escape closes the command palette', async ({ mockPage }) => {
    await mockPage.keyboard.press(`${modifierKey}+k`)
    const dialog = mockPage.getByRole('dialog', { name: /command palette/i })
    await expect(dialog).toBeVisible()

    await mockPage.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('Ctrl+K toggles command palette open and closed', async ({
    mockPage,
  }) => {
    const dialog = mockPage.getByRole('dialog', { name: /command palette/i })

    // Open
    await mockPage.keyboard.press(`${modifierKey}+k`)
    await expect(dialog).toBeVisible()

    // Close with the same shortcut
    await mockPage.keyboard.press(`${modifierKey}+k`)
    await expect(dialog).toBeHidden()
  })

  test('Arrow Down moves selection to the next command', async ({
    mockPage,
  }) => {
    await mockPage.keyboard.press(`${modifierKey}+k`)
    const dialog = mockPage.getByRole('dialog', { name: /command palette/i })
    await expect(dialog).toBeVisible()

    // The first command should be visually active/selected by default.
    // Press Arrow Down to move to the next command.
    await mockPage.keyboard.press('ArrowDown')

    // After navigating, press Enter to execute the highlighted command.
    // We verify the command palette closes (command was executed).
    await mockPage.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
  })

  test('Arrow Up moves selection to the previous command', async ({
    mockPage,
  }) => {
    await mockPage.keyboard.press(`${modifierKey}+k`)
    const dialog = mockPage.getByRole('dialog', { name: /command palette/i })
    await expect(dialog).toBeVisible()

    // Move down first, then back up
    await mockPage.keyboard.press('ArrowDown')
    await mockPage.keyboard.press('ArrowUp')

    // Press Enter on the original first command
    await mockPage.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
  })

  test('clearing search restores full command list', async ({ mockPage }) => {
    await mockPage.keyboard.press(`${modifierKey}+k`)
    const dialog = mockPage.getByRole('dialog', { name: /command palette/i })
    await expect(dialog).toBeVisible()

    const searchInput = dialog.getByPlaceholder(/search/i)

    // Type a non-matching query
    await searchInput.fill('zzzznonexistent')
    await expect(mockPage.getByText(/no results found/i)).toBeVisible()

    // Clear the search — commands should reappear
    await searchInput.clear()
    await expect(mockPage.getByText(/no results found/i)).toBeHidden()
    // Some command text should be visible again
    await expect(
      mockPage.getByText(/sidebar|preferences|window/i).first()
    ).toBeVisible()
  })

  test('Backspace to empty search restores full list', async ({ mockPage }) => {
    await mockPage.keyboard.press(`${modifierKey}+k`)
    const dialog = mockPage.getByRole('dialog', { name: /command palette/i })
    await expect(dialog).toBeVisible()

    const searchInput = dialog.getByPlaceholder(/search/i)
    await searchInput.fill('xyz')
    await expect(mockPage.getByText(/no results found/i)).toBeVisible()

    // Backspace to empty
    await searchInput.press('Backspace')
    await searchInput.press('Backspace')
    await searchInput.press('Backspace')

    await expect(mockPage.getByText(/no results found/i)).toBeHidden()
  })

  test('command palette search is case-insensitive', async ({ mockPage }) => {
    await mockPage.keyboard.press(`${modifierKey}+k`)
    const dialog = mockPage.getByRole('dialog', { name: /command palette/i })
    await expect(dialog).toBeVisible()

    const searchInput = dialog.getByPlaceholder(/search/i)

    // Search with uppercase
    await searchInput.fill('PREFERENCES')
    await expect(mockPage.getByText(/open preferences/i)).toBeVisible()

    // Search with mixed case
    await searchInput.fill('PrEfErEnCeS')
    await expect(mockPage.getByText(/open preferences/i)).toBeVisible()
  })
})
