import { test, expect } from './fixtures'

test.describe('App Launch', () => {
  test.use({ navigationTimeout: 30000 })

  test.beforeEach(async ({ mockPage }) => {
    await mockPage.goto('http://localhost:1420/')
  })

  test('app launches and renders the main window', async ({ mockPage }) => {
    await expect(mockPage.locator('body')).toBeVisible({ timeout: 15000 })
  })

  test('title bar is visible with correct content', async ({ mockPage }) => {
    // The title bar shows a centered "Tauri App" label
    await expect(mockPage.getByText('Tauri App')).toBeVisible({
      timeout: 15000,
    })

    // Title bar buttons are identified by their `title` attribute.
    // Sidebar visibility defaults to true, so the toggle buttons read "Hide ...".
    const leftSidebarButton = mockPage.locator(
      'button[title="Show Left Sidebar"], button[title="Hide Left Sidebar"]'
    )
    const settingsButton = mockPage.locator('button[title="Settings"]')
    const rightSidebarButton = mockPage.locator(
      'button[title="Show Right Sidebar"], button[title="Hide Right Sidebar"]'
    )

    await expect(leftSidebarButton).toBeVisible({ timeout: 15000 })
    await expect(settingsButton).toBeVisible({ timeout: 15000 })
    await expect(rightSidebarButton).toBeVisible({ timeout: 15000 })
  })

  test('app shows the default content area', async ({ mockPage }) => {
    const helloWorldHeading = mockPage.getByRole('heading', {
      name: 'Hello World',
    })
    await expect(helloWorldHeading).toBeVisible({ timeout: 15000 })
  })
})
