import { test, expect } from './fixtures'

const CRASH_REPORT_DATA = {
  crash_type: 'rust_panic',
  message: 'test panic message',
  location: 'src/main.rs:42:1',
  backtrace: 'stack trace',
  timestamp: 1234567890,
  app_version: '0.1.0',
}

test.describe('Crash Report Dialog', () => {
  test('crash report dialog appears when crash data exists', async ({
    mockPage,
  }) => {
    await mockPage.addInitScript(data => {
      window.__testHelpers.setCrashReport(data)
    }, CRASH_REPORT_DATA)
    await mockPage.goto('http://localhost:1420/')

    const dialog = mockPage.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByText('Crash Report', { exact: true })
    ).toBeVisible()
  })

  test('crash report dialog shows the crash message', async ({ mockPage }) => {
    await mockPage.addInitScript(data => {
      window.__testHelpers.setCrashReport(data)
    }, CRASH_REPORT_DATA)
    await mockPage.goto('http://localhost:1420/')

    const dialog = mockPage.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('test panic message')).toBeVisible()
  })

  test("clicking Don't Send closes the dialog", async ({ mockPage }) => {
    await mockPage.addInitScript(data => {
      window.__testHelpers.setCrashReport(data)
    }, CRASH_REPORT_DATA)
    await mockPage.goto('http://localhost:1420/')

    const dialog = mockPage.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: "Don't Send" }).click()
    await expect(dialog).toBeHidden()
  })

  test('crash report dialog has a Send Report button', async ({ mockPage }) => {
    await mockPage.addInitScript(data => {
      window.__testHelpers.setCrashReport(data)
    }, CRASH_REPORT_DATA)
    await mockPage.goto('http://localhost:1420/')

    const dialog = mockPage.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: 'Send Report' })
    ).toBeVisible()
  })
})
