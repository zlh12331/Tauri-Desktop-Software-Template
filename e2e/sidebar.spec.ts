import { test, expect } from './fixtures'

test.describe('Sidebar toggle', () => {
  test.beforeEach(async ({ mockPage }) => {
    await mockPage.goto('http://localhost:1420/')
  })

  test('left sidebar toggles visible/hidden when clicking the left sidebar toggle button', async ({
    mockPage,
  }) => {
    // Title bar buttons are identified by their `title` attribute.
    // The title changes between "Show" and "Hide" depending on sidebar state.
    const leftSidebarToggle = mockPage.locator(
      'button[title="Show Left Sidebar"], button[title="Hide Left Sidebar"]'
    )
    // Sidebars are rendered as resizable panels. The first panel is the left sidebar.
    const leftSidebar = mockPage
      .locator('[data-slot="resizable-panel"]')
      .first()

    // The sidebar starts visible
    await expect(leftSidebar).toBeVisible()

    // Clicking the toggle hides the sidebar
    await leftSidebarToggle.click()
    await expect(leftSidebar).toBeHidden()

    // Clicking the toggle again shows the sidebar
    await leftSidebarToggle.click()
    await expect(leftSidebar).toBeVisible()
  })

  test('right sidebar toggles visible/hidden when clicking the right sidebar toggle button', async ({
    mockPage,
  }) => {
    const rightSidebarToggle = mockPage.locator(
      'button[title="Show Right Sidebar"], button[title="Hide Right Sidebar"]'
    )
    // The last panel is the right sidebar.
    const rightSidebar = mockPage
      .locator('[data-slot="resizable-panel"]')
      .last()

    // The sidebar starts visible
    await expect(rightSidebar).toBeVisible()

    // Clicking the toggle hides the sidebar
    await rightSidebarToggle.click()
    await expect(rightSidebar).toBeHidden()

    // Clicking the toggle again shows the sidebar
    await rightSidebarToggle.click()
    await expect(rightSidebar).toBeVisible()
  })

  test('both sidebars can be open simultaneously', async ({ mockPage }) => {
    const leftSidebarToggle = mockPage.locator(
      'button[title="Show Left Sidebar"], button[title="Hide Left Sidebar"]'
    )
    const rightSidebarToggle = mockPage.locator(
      'button[title="Show Right Sidebar"], button[title="Hide Right Sidebar"]'
    )
    const leftSidebar = mockPage
      .locator('[data-slot="resizable-panel"]')
      .first()
    const rightSidebar = mockPage
      .locator('[data-slot="resizable-panel"]')
      .last()

    // Ensure both sidebars are visible, toggling only when necessary
    if (await leftSidebar.isHidden()) {
      await leftSidebarToggle.click()
    }
    if (await rightSidebar.isHidden()) {
      await rightSidebarToggle.click()
    }

    // Both sidebars are visible at the same time
    await expect(leftSidebar).toBeVisible()
    await expect(rightSidebar).toBeVisible()
  })
})
