import type { Locator } from '@playwright/test'
import { test, expect } from './fixtures'

const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Element has no layout box')
  return box
}

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

  test('left sidebar keeps a percentage width and grows when its handle is dragged', async ({
    mockPage,
  }) => {
    const leftSidebar = mockPage
      .locator('[data-slot="resizable-panel"]')
      .first()
    const group = mockPage.locator('[data-slot="resizable-panel-group"]')
    const leftHandle = mockPage
      .locator('[data-slot="resizable-handle"]')
      .first()

    // react-resizable-panels v4 reads a bare number as pixels, so a `defaultSize`
    // regression would leave a 20px panel clamped up to `minSize` (15%) — still
    // "visible", so only a measurement against the 20% default catches it.
    const groupWidth = (await boxOf(group)).width
    const initialWidth = (await boxOf(leftSidebar)).width
    const initialRatio = initialWidth / groupWidth
    expect(initialRatio).toBeGreaterThan(0.18)
    expect(initialRatio).toBeLessThan(0.22)

    const handle = await boxOf(leftHandle)
    const handleX = handle.x + handle.width / 2
    const handleY = handle.y + handle.height / 2

    await mockPage.mouse.move(handleX, handleY)
    await mockPage.mouse.down()
    await mockPage.mouse.move(handleX + 120, handleY, { steps: 12 })
    await mockPage.mouse.up()

    await expect
      .poll(async () => (await boxOf(leftSidebar)).width, {
        message: 'Left panel should follow the handle to the right',
      })
      .toBeGreaterThan(initialWidth + 80)
  })
})
