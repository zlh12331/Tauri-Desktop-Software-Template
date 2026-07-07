import { test, expect } from './fixtures'

const isMacOS = process.platform === 'darwin'
const modifierKey = isMacOS ? 'Meta' : 'Control'

test.describe('Window Commands', () => {
  test.beforeEach(async ({ mockPage }) => {
    await mockPage.goto('http://localhost:1420/')
    await expect(mockPage.getByText('Hello World')).toBeVisible({
      timeout: 15000,
    })
  })

  test('Minimize Window command appears in command palette', async ({
    mockPage,
  }) => {
    await mockPage.keyboard.press(`${modifierKey}+k`)
    await mockPage.getByPlaceholder(/search|command/i).fill('minimize')

    await expect(
      mockPage.getByRole('option', { name: /minimize window/i })
    ).toBeVisible()
  })

  test('Close Window command appears in command palette', async ({
    mockPage,
  }) => {
    await mockPage.keyboard.press(`${modifierKey}+k`)
    await mockPage.getByPlaceholder(/search|command/i).fill('close')

    await expect(
      mockPage.getByRole('option', { name: /close window/i })
    ).toBeVisible()
  })

  test('Toggle Maximize command appears in command palette', async ({
    mockPage,
  }) => {
    await mockPage.keyboard.press(`${modifierKey}+k`)
    await mockPage.getByPlaceholder(/search|command/i).fill('maximize')

    await expect(
      mockPage.getByRole('option', { name: /toggle maximize/i })
    ).toBeVisible()
  })

  test('Enter Fullscreen command appears in command palette', async ({
    mockPage,
  }) => {
    await mockPage.keyboard.press(`${modifierKey}+k`)
    await mockPage.getByPlaceholder(/search|command/i).fill('fullscreen')

    await expect(
      mockPage.getByRole('option', { name: /enter fullscreen/i })
    ).toBeVisible()
  })

  test('executing Minimize Window closes the command palette', async ({
    mockPage,
  }) => {
    await mockPage.keyboard.press(`${modifierKey}+k`)
    await mockPage.getByPlaceholder(/search|command/i).fill('minimize')
    await mockPage.keyboard.press('Enter')

    // Command executed successfully — palette closes
    await expect(
      mockPage.getByRole('dialog', { name: /command palette/i })
    ).toBeHidden()
  })

  test('executing Toggle Maximize closes the command palette', async ({
    mockPage,
  }) => {
    await mockPage.keyboard.press(`${modifierKey}+k`)
    await mockPage.getByPlaceholder(/search|command/i).fill('maximize')
    await mockPage.keyboard.press('Enter')

    await expect(
      mockPage.getByRole('dialog', { name: /command palette/i })
    ).toBeHidden()
  })

  test('executing Enter Fullscreen closes the command palette', async ({
    mockPage,
  }) => {
    await mockPage.keyboard.press(`${modifierKey}+k`)
    await mockPage.getByPlaceholder(/search|command/i).fill('fullscreen')
    await mockPage.keyboard.press('Enter')

    await expect(
      mockPage.getByRole('dialog', { name: /command palette/i })
    ).toBeHidden()
  })

  test('all window commands are listed when searching "window"', async ({
    mockPage,
  }) => {
    await mockPage.keyboard.press(`${modifierKey}+k`)
    await mockPage.getByPlaceholder(/search|command/i).fill('window')

    // All window commands should be visible
    await expect(
      mockPage.getByRole('option', { name: /close window/i })
    ).toBeVisible()
    await expect(
      mockPage.getByRole('option', { name: /minimize window/i })
    ).toBeVisible()
    await expect(
      mockPage.getByRole('option', { name: /toggle maximize/i })
    ).toBeVisible()
  })
})
