import { test, expect } from './fixtures'

const isMacOS = process.platform === 'darwin'
const modifierKey = isMacOS ? 'Meta' : 'Control'

test.describe('Global Keyboard Shortcuts', () => {
  test.beforeEach(async ({ mockPage }) => {
    await mockPage.goto('http://localhost:1420/')
    // Ensure app is fully loaded
    await expect(mockPage.getByText('Hello World')).toBeVisible({
      timeout: 15000,
    })
  })

  test('Ctrl+, opens the Preferences dialog', async ({ mockPage }) => {
    await expect(
      mockPage.getByRole('dialog', { name: /^preferences$/i })
    ).toBeHidden()

    await mockPage.keyboard.press(`${modifierKey}+,`)

    await expect(
      mockPage.getByRole('dialog', { name: /^preferences$/i })
    ).toBeVisible()
  })

  test('Ctrl+1 toggles the left sidebar visibility', async ({ mockPage }) => {
    const leftSidebar = mockPage
      .locator('[data-slot="resizable-panel"]')
      .first()

    // Sidebar starts visible
    await expect(leftSidebar).toBeVisible()

    // Press Ctrl+1 to hide
    await mockPage.keyboard.press(`${modifierKey}+1`)
    await expect(leftSidebar).toBeHidden()

    // Press Ctrl+1 again to show
    await mockPage.keyboard.press(`${modifierKey}+1`)
    await expect(leftSidebar).toBeVisible()
  })

  test('Ctrl+2 toggles the right sidebar visibility', async ({ mockPage }) => {
    const rightSidebar = mockPage
      .locator('[data-slot="resizable-panel"]')
      .last()

    // Sidebar starts visible
    await expect(rightSidebar).toBeVisible()

    // Press Ctrl+2 to hide
    await mockPage.keyboard.press(`${modifierKey}+2`)
    await expect(rightSidebar).toBeHidden()

    // Press Ctrl+2 again to show
    await mockPage.keyboard.press(`${modifierKey}+2`)
    await expect(rightSidebar).toBeVisible()
  })

  test('shortcuts work independently — Ctrl+1 does not affect right sidebar', async ({
    mockPage,
  }) => {
    const leftSidebar = mockPage
      .locator('[data-slot="resizable-panel"]')
      .first()
    const rightSidebar = mockPage
      .locator('[data-slot="resizable-panel"]')
      .last()

    // Both sidebars start visible
    await expect(leftSidebar).toBeVisible()
    await expect(rightSidebar).toBeVisible()

    // Toggle only the left sidebar
    await mockPage.keyboard.press(`${modifierKey}+1`)
    await expect(leftSidebar).toBeHidden()
    await expect(rightSidebar).toBeVisible()
  })

  test('shortcuts work independently — Ctrl+2 does not affect left sidebar', async ({
    mockPage,
  }) => {
    const leftSidebar = mockPage
      .locator('[data-slot="resizable-panel"]')
      .first()
    const rightSidebar = mockPage
      .locator('[data-slot="resizable-panel"]')
      .last()

    // Both sidebars start visible
    await expect(leftSidebar).toBeVisible()
    await expect(rightSidebar).toBeVisible()

    // Toggle only the right sidebar
    await mockPage.keyboard.press(`${modifierKey}+2`)
    await expect(rightSidebar).toBeHidden()
    await expect(leftSidebar).toBeVisible()
  })

  test('pressing "1" without modifier key does not toggle sidebar', async ({
    mockPage,
  }) => {
    const leftSidebar = mockPage
      .locator('[data-slot="resizable-panel"]')
      .first()

    await expect(leftSidebar).toBeVisible()

    // Press "1" without Ctrl/Meta — should not toggle
    await mockPage.keyboard.press('1')
    await expect(leftSidebar).toBeVisible()
  })

  test('Ctrl+, and Ctrl+K can be used in sequence', async ({ mockPage }) => {
    // Open preferences with Ctrl+,
    await mockPage.keyboard.press(`${modifierKey}+,`)
    await expect(
      mockPage.getByRole('dialog', { name: /^preferences$/i })
    ).toBeVisible()

    // Close preferences with Escape
    await mockPage.keyboard.press('Escape')
    await expect(
      mockPage.getByRole('dialog', { name: /^preferences$/i })
    ).toBeHidden()

    // Open command palette with Ctrl+K
    await mockPage.keyboard.press(`${modifierKey}+k`)
    await expect(
      mockPage.getByRole('dialog', { name: /command palette/i })
    ).toBeVisible()
  })
})
