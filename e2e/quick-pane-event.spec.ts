import { test, expect } from './fixtures'

test.describe('Quick Pane Event Communication', () => {
  test.beforeEach(async ({ mockPage }) => {
    await mockPage.goto('http://localhost:1420/')
    // Wait for the app to fully load
    await expect(mockPage.getByText('Hello World')).toBeVisible({
      timeout: 15000,
    })
    // Wait for event listeners to register
    await expect
      .poll(
        async () =>
          mockPage.evaluate(() => window.__testHelpers.getRegisteredChannels()),
        { timeout: 10000, intervals: [500] }
      )
      .toContain('quick-pane-submit')
  })

  test('main window shows "Hello World" by default', async ({ mockPage }) => {
    await expect(
      mockPage.getByRole('heading', { name: 'Hello World' })
    ).toBeVisible()
  })

  test('quick-pane-submit event updates main window content', async ({
    mockPage,
  }) => {
    await mockPage.evaluate(() => {
      window.__testHelpers.emitEvent('quick-pane-submit', {
        text: 'Test entry',
      })
    })

    await expect(
      mockPage.getByRole('heading', { name: /last entry: test entry/i })
    ).toBeVisible({ timeout: 5000 })
  })

  test('multiple quick-pane-submit events update content sequentially', async ({
    mockPage,
  }) => {
    // First entry
    await mockPage.evaluate(() => {
      window.__testHelpers.emitEvent('quick-pane-submit', {
        text: 'First entry',
      })
    })
    await expect(
      mockPage.getByRole('heading', { name: /last entry: first entry/i })
    ).toBeVisible({ timeout: 5000 })

    // Second entry overwrites the first
    await mockPage.evaluate(() => {
      window.__testHelpers.emitEvent('quick-pane-submit', {
        text: 'Second entry',
      })
    })
    await expect(
      mockPage.getByRole('heading', { name: /last entry: second entry/i })
    ).toBeVisible({ timeout: 5000 })
  })

  test('quick-pane-submit with empty text keeps default content', async ({
    mockPage,
  }) => {
    await mockPage.evaluate(() => {
      window.__testHelpers.emitEvent('quick-pane-submit', { text: '' })
    })

    // Empty string is falsy, so the component keeps showing "Hello World"
    await expect(
      mockPage.getByRole('heading', { name: 'Hello World' })
    ).toBeVisible({ timeout: 5000 })
  })

  test('unrelated events do not affect main window content', async ({
    mockPage,
  }) => {
    // Emit an unrelated event
    await mockPage.evaluate(() => {
      window.__testHelpers.emitEvent('some-other-event', { text: 'ignored' })
    })

    // Content should remain "Hello World"
    await expect(
      mockPage.getByRole('heading', { name: 'Hello World' })
    ).toBeVisible()
  })
})
