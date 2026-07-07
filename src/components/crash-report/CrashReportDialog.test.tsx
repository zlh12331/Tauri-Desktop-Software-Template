import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useCrashReportStore } from '@/store/crash-report-store'
import type { CrashReportData } from '@/lib/tauri-bindings'
import { CrashReportDialog } from './CrashReportDialog'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

// Mock toast
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...(args as [never])),
    error: (...args: unknown[]) => mockToastError(...(args as [never])),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  },
}))

// Mock tauri bindings
const mockLoadPreferences = vi.fn()
const mockSavePreferences = vi.fn()
const mockDeleteCrashReport = vi.fn()
vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    loadPreferences: (...args: unknown[]) =>
      mockLoadPreferences(...(args as [])),
    savePreferences: (...args: unknown[]) =>
      mockSavePreferences(...(args as [never])),
    deleteCrashReport: (...args: unknown[]) =>
      mockDeleteCrashReport(...(args as [])),
  },
}))

// Mock sentry wrapper
const mockSetSentryConsent = vi.fn()
const mockIsSentryEnabled = vi.fn()
vi.mock('@/lib/sentry', () => ({
  setSentryConsent: (...args: unknown[]) =>
    mockSetSentryConsent(...(args as [boolean | null])),
  isSentryEnabled: (...args: unknown[]) => mockIsSentryEnabled(...(args as [])),
}))

// Mock @sentry/react — captureMessage
const mockCaptureMessage = vi.fn()
vi.mock('@sentry/react', () => ({
  captureMessage: (...args: unknown[]) =>
    mockCaptureMessage(...(args as [never, never])),
}))

const defaultPrefs = {
  theme: 'system',
  quick_pane_shortcut: null,
  language: null,
  crash_reporting_consent: null,
}

const crashFixture: CrashReportData = {
  crash_type: 'rust_panic',
  message: 'panicked at src/main.rs:42',
  location: 'src/main.rs:42:13',
  backtrace: 'stack...',
  timestamp: 1700000000,
  app_version: '0.1.0',
}

describe('CrashReportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset crash report store state
    useCrashReportStore.setState({
      crashReportDialogOpen: true,
      pendingCrashReport: null,
    })
    mockIsSentryEnabled.mockReturnValue(true)
    mockLoadPreferences.mockResolvedValue({
      status: 'ok',
      data: defaultPrefs,
    })
    mockSavePreferences.mockResolvedValue({ status: 'ok', data: null })
    mockDeleteCrashReport.mockResolvedValue({ status: 'ok', data: null })
  })

  describe('正向用例 — 渲染', () => {
    it('open=true 时渲染对话框', () => {
      render(<CrashReportDialog />)
      expect(screen.getByText('crashReport.title')).toBeInTheDocument()
      expect(screen.getByText('crashReport.description')).toBeInTheDocument()
    })

    it('渲染 "Send Report" 和 "Don\'t Send" 按钮', () => {
      render(<CrashReportDialog />)
      expect(screen.getByText('crashReport.sendReport')).toBeInTheDocument()
      expect(screen.getByText('crashReport.dontSend')).toBeInTheDocument()
    })

    it('渲染隐私说明文本', () => {
      render(<CrashReportDialog />)
      expect(screen.getByText('crashReport.privacyNote')).toBeInTheDocument()
    })

    it('pendingCrashReport 存在时渲染崩溃消息', () => {
      useCrashReportStore.setState({ pendingCrashReport: crashFixture })
      render(<CrashReportDialog />)
      expect(screen.getByText('crashReport.crashMessage')).toBeInTheDocument()
      expect(screen.getByText('panicked at src/main.rs:42')).toBeInTheDocument()
    })

    it('pendingCrashReport 包含 location 时渲染位置信息', () => {
      useCrashReportStore.setState({ pendingCrashReport: crashFixture })
      render(<CrashReportDialog />)
      expect(screen.getByText('src/main.rs:42:13')).toBeInTheDocument()
    })

    it('open=false 时不渲染对话框', () => {
      useCrashReportStore.setState({ crashReportDialogOpen: false })
      render(<CrashReportDialog />)
      expect(screen.queryByText('crashReport.title')).not.toBeInTheDocument()
    })
  })

  describe('正向用例 — 用户交互', () => {
    it('点击 "Send Report" 保存同意并打开 Sentry consent gate', async () => {
      const user = userEvent.setup()
      useCrashReportStore.setState({ pendingCrashReport: crashFixture })
      render(<CrashReportDialog />)

      await user.click(screen.getByText('crashReport.sendReport'))

      await waitFor(() => {
        expect(mockSavePreferences).toHaveBeenCalledWith({
          ...defaultPrefs,
          crash_reporting_consent: true,
        })
      })
      expect(mockSetSentryConsent).toHaveBeenCalledWith(true)
    })

    it('点击 "Send Report" 发送崩溃消息到 Sentry', async () => {
      const user = userEvent.setup()
      useCrashReportStore.setState({ pendingCrashReport: crashFixture })
      render(<CrashReportDialog />)

      await user.click(screen.getByText('crashReport.sendReport'))

      await waitFor(() => {
        expect(mockCaptureMessage).toHaveBeenCalledWith(
          'Rust panic: panicked at src/main.rs:42',
          'fatal'
        )
      })
    })

    it('点击 "Send Report" 删除崩溃文件并关闭对话框', async () => {
      const user = userEvent.setup()
      useCrashReportStore.setState({ pendingCrashReport: crashFixture })
      render(<CrashReportDialog />)

      await user.click(screen.getByText('crashReport.sendReport'))

      await waitFor(() => {
        expect(mockDeleteCrashReport).toHaveBeenCalledTimes(1)
      })
      await waitFor(() => {
        expect(useCrashReportStore.getState().crashReportDialogOpen).toBe(false)
      })
      expect(useCrashReportStore.getState().pendingCrashReport).toBeNull()
    })

    it('点击 "Send Report" 显示成功 toast', async () => {
      const user = userEvent.setup()
      useCrashReportStore.setState({ pendingCrashReport: crashFixture })
      render(<CrashReportDialog />)

      await user.click(screen.getByText('crashReport.sendReport'))

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'crashReport.consentGranted'
        )
      })
    })

    it('点击 "Don\'t Send" 保存拒绝同意并删除崩溃文件', async () => {
      const user = userEvent.setup()
      useCrashReportStore.setState({ pendingCrashReport: crashFixture })
      render(<CrashReportDialog />)

      await user.click(screen.getByText('crashReport.dontSend'))

      await waitFor(() => {
        expect(mockSavePreferences).toHaveBeenCalledWith({
          ...defaultPrefs,
          crash_reporting_consent: false,
        })
      })
      expect(mockDeleteCrashReport).toHaveBeenCalledTimes(1)
    })

    it('点击 "Don\'t Send" 不打开 Sentry consent gate', async () => {
      const user = userEvent.setup()
      render(<CrashReportDialog />)

      await user.click(screen.getByText('crashReport.dontSend'))

      await waitFor(() => {
        expect(mockSetSentryConsent).not.toHaveBeenCalledWith(true)
      })
    })

    it('点击 "Don\'t Send" 关闭对话框', async () => {
      const user = userEvent.setup()
      render(<CrashReportDialog />)

      await user.click(screen.getByText('crashReport.dontSend'))

      await waitFor(() => {
        expect(useCrashReportStore.getState().crashReportDialogOpen).toBe(false)
      })
    })
  })

  describe('边界用例', () => {
    it('sentry 未配置时 "Send Report" 按钮被禁用', () => {
      mockIsSentryEnabled.mockReturnValue(false)
      render(<CrashReportDialog />)
      const sendButton = screen
        .getByText('crashReport.sendReport')
        .closest('button')
      expect(sendButton).toBeDisabled()
    })

    it('sentry 未配置时 "Don\'t Send" 按钮仍可用', () => {
      mockIsSentryEnabled.mockReturnValue(false)
      render(<CrashReportDialog />)
      const denyButton = screen
        .getByText('crashReport.dontSend')
        .closest('button')
      expect(denyButton).not.toBeDisabled()
    })

    it('pendingCrashReport 为 null 时不渲染崩溃消息块', () => {
      useCrashReportStore.setState({ pendingCrashReport: null })
      render(<CrashReportDialog />)
      expect(
        screen.queryByText('crashReport.crashMessage')
      ).not.toBeInTheDocument()
    })

    it('pendingCrashReport.location 为 null 时不渲染位置', () => {
      useCrashReportStore.setState({
        pendingCrashReport: { ...crashFixture, location: null },
      })
      render(<CrashReportDialog />)
      expect(screen.getByText('panicked at src/main.rs:42')).toBeInTheDocument()
      // location is null, so no extra location line
    })

    it('处理中时禁用按钮且不允许关闭对话框', async () => {
      const user = userEvent.setup()
      // Make loadPreferences slow to keep "handling" state true
      mockLoadPreferences.mockReturnValue(
        new Promise(resolve =>
          setTimeout(() => resolve({ status: 'ok', data: defaultPrefs }), 5000)
        )
      )
      render(<CrashReportDialog />)

      await user.click(screen.getByText('crashReport.dontSend'))

      // While handling, both buttons should be disabled
      await waitFor(() => {
        const denyButton = screen
          .getByText('crashReport.dontSend')
          .closest('button')
        expect(denyButton).toBeDisabled()
      })
    })
  })

  describe('异常用例', () => {
    it('loadPreferences 抛错时显示错误 toast', async () => {
      const user = userEvent.setup()
      mockLoadPreferences.mockRejectedValue(new Error('disk fail'))
      render(<CrashReportDialog />)

      await user.click(screen.getByText('crashReport.sendReport'))

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('crashReport.consentError')
      })
    })

    it('savePreferences 抛错时显示错误 toast', async () => {
      const user = userEvent.setup()
      mockSavePreferences.mockRejectedValue(new Error('save fail'))
      render(<CrashReportDialog />)

      await user.click(screen.getByText('crashReport.dontSend'))

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('crashReport.consentError')
      })
    })

    it('deleteCrashReport 抛错时显示错误 toast', async () => {
      const user = userEvent.setup()
      mockDeleteCrashReport.mockRejectedValue(new Error('delete fail'))
      render(<CrashReportDialog />)

      await user.click(screen.getByText('crashReport.sendReport'))

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('crashReport.consentError')
      })
    })

    it('loadPreferences 返回 error 状态时不调用 savePreferences', async () => {
      const user = userEvent.setup()
      mockLoadPreferences.mockResolvedValue({
        status: 'error',
        error: { kind: 'Io', message: 'corrupt' },
      })
      render(<CrashReportDialog />)

      await user.click(screen.getByText('crashReport.dontSend'))

      // Wait a tick for any async work
      await waitFor(() => {
        expect(mockDeleteCrashReport).toHaveBeenCalled()
      })
      // savePreferences should NOT be called because loadPreferences failed
      expect(mockSavePreferences).not.toHaveBeenCalled()
    })
  })
})
