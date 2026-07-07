import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { CrashReportData } from '@/lib/tauri-bindings'

// Mock sentry wrapper
const mockSetSentryConsent = vi.fn()
const mockIsSentryEnabled = vi.fn()

vi.mock('@/lib/sentry', () => ({
  setSentryConsent: (...args: unknown[]) =>
    mockSetSentryConsent(...(args as [boolean | null])),
  isSentryEnabled: () => mockIsSentryEnabled(),
}))

// Mock crash report store (hook form with selector)
const mockSetCrashReportDialogOpen = vi.fn()
const mockSetPendingCrashReport = vi.fn()

vi.mock('@/store/crash-report-store', () => ({
  useCrashReportStore: (
    selector: (state: Record<string, unknown>) => unknown
  ) =>
    selector({
      setCrashReportDialogOpen: mockSetCrashReportDialogOpen,
      setPendingCrashReport: mockSetPendingCrashReport,
    }),
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  },
}))

// Mock tauri bindings
const mockLoadPreferences = vi.fn()
const mockReadCrashReport = vi.fn()
const mockDeleteCrashReport = vi.fn()

vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    loadPreferences: (...args: unknown[]) =>
      mockLoadPreferences(...(args as [])),
    readCrashReport: (...args: unknown[]) =>
      mockReadCrashReport(...(args as [])),
    deleteCrashReport: (...args: unknown[]) =>
      mockDeleteCrashReport(...(args as [])),
  },
}))

const { useCrashReporting } = await import('./use-crash-reporting')
const { logger } = await import('@/lib/logger')

const crashFixture: CrashReportData = {
  crash_type: 'rust_panic',
  message: 'panicked at src/main.rs:42',
  location: 'src/main.rs:42:13',
  backtrace: 'stack...',
  timestamp: 1700000000,
  app_version: '0.1.0',
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('useCrashReporting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsSentryEnabled.mockReturnValue(true)
    mockLoadPreferences.mockResolvedValue({
      status: 'ok',
      data: { crash_reporting_consent: null },
    })
    mockReadCrashReport.mockResolvedValue({ status: 'ok', data: null })
    mockDeleteCrashReport.mockResolvedValue({ status: 'ok', data: null })
  })

  describe('正向用例 — Sentry 未启用', () => {
    it('cleans up crash files and skips Sentry when DSN is not configured', async () => {
      mockIsSentryEnabled.mockReturnValue(false)

      renderHook(() => useCrashReporting())
      await flush()

      expect(mockDeleteCrashReport).toHaveBeenCalledTimes(1)
      expect(mockSetSentryConsent).not.toHaveBeenCalled()
      expect(mockReadCrashReport).not.toHaveBeenCalled()
    })
  })

  describe('正向用例 — 已同意且崩溃上报', () => {
    it('opens Sentry consent gate when consent is true', async () => {
      mockLoadPreferences.mockResolvedValue({
        status: 'ok',
        data: { crash_reporting_consent: true },
      })
      mockReadCrashReport.mockResolvedValue({ status: 'ok', data: null })

      renderHook(() => useCrashReporting())
      await flush()

      expect(mockSetSentryConsent).toHaveBeenCalledWith(true)
    })

    it('deletes the crash file when consent is true (Rust Sentry already sent the event)', async () => {
      mockLoadPreferences.mockResolvedValue({
        status: 'ok',
        data: { crash_reporting_consent: true },
      })
      mockReadCrashReport.mockResolvedValue({
        status: 'ok',
        data: crashFixture,
      })

      renderHook(() => useCrashReporting())
      await flush()

      // Rust Sentry already sent the panic event at crash time (CONSENT_STATE
      // was initialized from preferences). Frontend just deletes the crash file.
      expect(mockDeleteCrashReport).toHaveBeenCalledTimes(1)
      expect(mockSetPendingCrashReport).not.toHaveBeenCalled()
      expect(mockSetCrashReportDialogOpen).not.toHaveBeenCalled()
    })

    it('does nothing when consent is true but no crash file exists', async () => {
      mockLoadPreferences.mockResolvedValue({
        status: 'ok',
        data: { crash_reporting_consent: true },
      })
      mockReadCrashReport.mockResolvedValue({ status: 'ok', data: null })

      renderHook(() => useCrashReporting())
      await flush()

      expect(mockDeleteCrashReport).not.toHaveBeenCalled()
    })
  })

  describe('正向用例 — 未决定同意 (consent null)', () => {
    it('shows the consent dialog with crash details when consent is null', async () => {
      mockLoadPreferences.mockResolvedValue({
        status: 'ok',
        data: { crash_reporting_consent: null },
      })
      mockReadCrashReport.mockResolvedValue({
        status: 'ok',
        data: crashFixture,
      })

      renderHook(() => useCrashReporting())
      await flush()

      expect(mockSetPendingCrashReport).toHaveBeenCalledWith(crashFixture)
      expect(mockSetCrashReportDialogOpen).toHaveBeenCalledWith(true)
      expect(mockDeleteCrashReport).not.toHaveBeenCalled()
    })
  })

  describe('正向用例 — 拒绝同意 (consent false)', () => {
    it('deletes the crash report silently when consent is false', async () => {
      mockLoadPreferences.mockResolvedValue({
        status: 'ok',
        data: { crash_reporting_consent: false },
      })
      mockReadCrashReport.mockResolvedValue({
        status: 'ok',
        data: crashFixture,
      })

      renderHook(() => useCrashReporting())
      await flush()

      expect(mockSetSentryConsent).toHaveBeenCalledWith(false)
      expect(mockDeleteCrashReport).toHaveBeenCalledTimes(1)
      expect(mockSetCrashReportDialogOpen).not.toHaveBeenCalled()
      expect(mockSetPendingCrashReport).not.toHaveBeenCalled()
    })
  })

  describe('异常用例 — API 调用失败', () => {
    it('logs a warning when loadPreferences throws', async () => {
      mockLoadPreferences.mockRejectedValue(new Error('disk error'))

      renderHook(() => useCrashReporting())
      await flush()

      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to load preferences for crash reporting',
        { error: expect.any(Error) }
      )
    })

    it('treats consent as null when loadPreferences returns an error status', async () => {
      mockLoadPreferences.mockResolvedValue({
        status: 'error',
        error: 'corrupt file',
      })
      mockReadCrashReport.mockResolvedValue({
        status: 'ok',
        data: crashFixture,
      })

      renderHook(() => useCrashReporting())
      await flush()

      // consent stays null → consent dialog path
      expect(mockSetPendingCrashReport).toHaveBeenCalledWith(crashFixture)
      expect(mockSetCrashReportDialogOpen).toHaveBeenCalledWith(true)
    })

    it('logs a warning when readCrashReport throws', async () => {
      mockReadCrashReport.mockRejectedValue(new Error('read failed'))

      renderHook(() => useCrashReporting())
      await flush()

      expect(logger.warn).toHaveBeenCalledWith('Failed to check crash report', {
        error: expect.any(Error),
      })
    })

    it('swallows deleteCrashReport errors when Sentry is disabled', async () => {
      mockIsSentryEnabled.mockReturnValue(false)
      mockDeleteCrashReport.mockRejectedValue(new Error('no file'))

      renderHook(() => useCrashReporting())
      await flush()

      expect(mockDeleteCrashReport).toHaveBeenCalledTimes(1)
      // Should not throw / reject unhandled
      expect(logger.warn).not.toHaveBeenCalled()
    })
  })

  describe('边界用例', () => {
    it('does not open consent gate when consent is null', async () => {
      mockLoadPreferences.mockResolvedValue({
        status: 'ok',
        data: { crash_reporting_consent: null },
      })

      renderHook(() => useCrashReporting())
      await flush()

      expect(mockSetSentryConsent).not.toHaveBeenCalled()
    })

    it('closes consent gate when consent is false', async () => {
      mockLoadPreferences.mockResolvedValue({
        status: 'ok',
        data: { crash_reporting_consent: false },
      })

      renderHook(() => useCrashReporting())
      await flush()

      expect(mockSetSentryConsent).toHaveBeenCalledWith(false)
    })
  })
})
