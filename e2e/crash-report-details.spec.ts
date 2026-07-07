import { test, expect } from './fixtures'

const CRASH_REPORT_DATA = {
  crash_type: 'rust_panic',
  message: 'index out of bounds: len is 3 but index is 5',
  location: 'src/main.rs:42:13',
  backtrace:
    'stack backtrace:\n  0: rust_begin_unwind\n  1: core::panicking::panic',
  timestamp: 1700000000,
  app_version: '1.2.3',
}

test.describe('Crash Report Details and Send Flow', () => {
  test.beforeEach(async ({ mockPage }) => {
    await mockPage.addInitScript(data => {
      window.__testHelpers.setCrashReport(data)
    }, CRASH_REPORT_DATA)
    await mockPage.goto('http://localhost:1420/', {
      waitUntil: 'domcontentloaded',
    })
  })

  test('dialog shows the crash message with full text', async ({
    mockPage,
  }) => {
    const dialog = mockPage.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByText('index out of bounds: len is 3 but index is 5', {
        exact: true,
      })
    ).toBeVisible()
  })

  test('dialog shows crash location', async ({ mockPage }) => {
    const dialog = mockPage.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('src/main.rs:42:13')).toBeVisible()
  })

  test('dialog shows privacy note', async ({ mockPage }) => {
    const dialog = mockPage.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByText(
        /Crash reports include error details, stack traces, and app version/i
      )
    ).toBeVisible()
  })

  test('dialog shows description text', async ({ mockPage }) => {
    const dialog = mockPage.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByText(/The application encountered a crash/i)
    ).toBeVisible()
  })

  test('clicking Send Report closes the dialog', async ({ mockPage }) => {
    const dialog = mockPage.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Send Report' }).click()

    await expect(dialog).toBeHidden()
  })

  test('Send Report shows consent granted toast', async ({ mockPage }) => {
    const dialog = mockPage.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Send Report' }).click()

    // After sending, a toast should confirm consent was granted
    await expect(
      mockPage.getByText(/Future crashes will be reported automatically/i)
    ).toBeVisible({ timeout: 5000 })
  })

  test("Don't Send closes the dialog without showing toast", async ({
    mockPage,
  }) => {
    const dialog = mockPage.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: "Don't Send" }).click()

    await expect(dialog).toBeHidden()
    // No consent toast should appear
    await expect(
      mockPage.getByText(/Future crashes will be reported automatically/i)
    ).toBeHidden()
  })
})

test.describe('Crash Report Absence', () => {
  test('no crash dialog when crash data is null', async ({ mockPage }) => {
    // Ensure no crash data is set (default mock state is null)
    await mockPage.goto('http://localhost:1420/')

    // Wait for app to load
    await expect(mockPage.getByText('Hello World')).toBeVisible({
      timeout: 15000,
    })

    // No dialog should be visible
    const dialogs = mockPage.getByRole('dialog')
    await expect(dialogs).toHaveCount(0)
  })
})
