/**
 * Global type declarations for E2E test helpers injected by the Tauri mock.
 */

interface CrashReportData {
  crash_type: string
  message: string
  location: string | null
  backtrace: string
  timestamp: number
  app_version: string
}

interface TestHelpers {
  setCrashReport: (data: CrashReportData) => void
  getPreferences: () => Record<string, unknown>
  setPreferences: (prefs: Record<string, unknown>) => void
  emitEvent: (event: string, payload: unknown) => void
  getRegisteredChannels: () => string[]
  getInvokeLog: () => string[]
}

interface Window {
  __testHelpers: TestHelpers
}
