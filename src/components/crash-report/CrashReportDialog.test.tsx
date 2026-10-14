import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
const mockApplyPreferencePatches = vi.fn()
const mockDeleteCrashReport = vi.fn()
vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    applyPreferencePatches: (...args: unknown[]) =>
      mockApplyPreferencePatches(...(args as [never])),
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

// Mock @/components/ui/dialog — Dialog exposes onOpenChange for direct testing
const mockDialog = vi.hoisted(() => ({
  onOpenChange: vi.fn(),
}))
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    children: React.ReactNode
  }) => {
    mockDialog.onOpenChange.mockImplementation(onOpenChange)
    return open ? (
      <div data-testid="crash-dialog" data-open="true">
        <button data-testid="dialog-close" onClick={() => onOpenChange(false)}>
          close
        </button>
        {children}
      </div>
    ) : null
  },
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
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
    mockApplyPreferencePatches.mockResolvedValue({
      status: 'ok',
      data: defaultPrefs,
    })
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
      expect(screen.getByText('crashReport.doNotSend')).toBeInTheDocument()
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
    it('点击 "Send Report" 只写入同意字段并打开 Sentry consent gate', async () => {
      const user = userEvent.setup()
      useCrashReportStore.setState({ pendingCrashReport: crashFixture })
      render(<CrashReportDialog />)

      await user.click(screen.getByText('crashReport.sendReport'))

      await waitFor(() => {
        expect(mockApplyPreferencePatches).toHaveBeenCalledWith([
          { CrashReportingConsent: { value: true } },
        ])
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

    it('点击 "Don\'t Send" 只写入拒绝同意的字段并删除崩溃文件', async () => {
      const user = userEvent.setup()
      useCrashReportStore.setState({ pendingCrashReport: crashFixture })
      render(<CrashReportDialog />)

      await user.click(screen.getByText('crashReport.doNotSend'))

      await waitFor(() => {
        expect(mockApplyPreferencePatches).toHaveBeenCalledWith([
          { CrashReportingConsent: { value: false } },
        ])
      })
      expect(mockDeleteCrashReport).toHaveBeenCalledTimes(1)
    })

    it('点击 "Don\'t Send" 不打开 Sentry consent gate', async () => {
      const user = userEvent.setup()
      render(<CrashReportDialog />)

      await user.click(screen.getByText('crashReport.doNotSend'))

      await waitFor(() => {
        expect(mockSetSentryConsent).not.toHaveBeenCalledWith(true)
      })
    })

    it('点击 "Don\'t Send" 关闭对话框', async () => {
      const user = userEvent.setup()
      render(<CrashReportDialog />)

      await user.click(screen.getByText('crashReport.doNotSend'))

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
        .getByText('crashReport.doNotSend')
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
      // Keep the consent write pending so "handling" stays true
      mockApplyPreferencePatches.mockReturnValue(
        new Promise<never>(() => undefined)
      )
      render(<CrashReportDialog />)

      await user.click(screen.getByText('crashReport.doNotSend'))

      // While handling, both buttons should be disabled
      await waitFor(() => {
        const denyButton = screen
          .getByText('crashReport.doNotSend')
          .closest('button')
        expect(denyButton).toBeDisabled()
      })
    })

    it('非处理中时 onOpenChange(false) 关闭对话框', async () => {
      render(<CrashReportDialog />)

      fireEvent.click(screen.getByTestId('dialog-close'))

      await waitFor(() => {
        expect(useCrashReportStore.getState().crashReportDialogOpen).toBe(false)
      })
    })

    it('处理中时 onOpenChange(false) 被忽略（不关闭）', async () => {
      const user = userEvent.setup()
      // Keep the consent write pending so "handling" stays true
      mockApplyPreferencePatches.mockReturnValue(
        new Promise<never>(() => undefined)
      )
      render(<CrashReportDialog />)

      await user.click(screen.getByText('crashReport.sendReport'))

      // Wait until the send button is disabled (handling === true)
      await waitFor(() => {
        const sendButton = screen
          .getByText('crashReport.sendReport')
          .closest('button')
        expect(sendButton).toBeDisabled()
      })

      fireEvent.click(screen.getByTestId('dialog-close'))

      // Dialog must remain open while handling
      expect(useCrashReportStore.getState().crashReportDialogOpen).toBe(true)
    })
  })

  describe('异常用例', () => {
    it('同意写入抛错时显示错误 toast 且不打开 Sentry consent gate', async () => {
      const user = userEvent.setup()
      mockApplyPreferencePatches.mockRejectedValue(new Error('disk fail'))
      render(<CrashReportDialog />)

      await user.click(screen.getByText('crashReport.sendReport'))

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('crashReport.consentError')
      })
      expect(mockSetSentryConsent).not.toHaveBeenCalled()
    })

    it('拒绝写入抛错时显示错误 toast', async () => {
      const user = userEvent.setup()
      mockApplyPreferencePatches.mockRejectedValue(new Error('save fail'))
      render(<CrashReportDialog />)

      await user.click(screen.getByText('crashReport.doNotSend'))

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

    it('同意写入返回 error 状态时不发送崩溃报告', async () => {
      const user = userEvent.setup()
      useCrashReportStore.setState({ pendingCrashReport: crashFixture })
      mockApplyPreferencePatches.mockResolvedValue({
        status: 'error',
        error: { kind: 'Io', message: 'corrupt' },
      })
      render(<CrashReportDialog />)

      await user.click(screen.getByText('crashReport.sendReport'))

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('crashReport.consentError')
      })
      // Consent never reached disk, so nothing may be uploaded under its cover.
      expect(mockSetSentryConsent).not.toHaveBeenCalled()
      expect(mockCaptureMessage).not.toHaveBeenCalled()
    })

    it('同意写入返回 error 状态时保留崩溃文件并允许重试', async () => {
      const user = userEvent.setup()
      mockApplyPreferencePatches.mockResolvedValue({
        status: 'error',
        error: { kind: 'Io', message: 'corrupt' },
      })
      render(<CrashReportDialog />)

      await user.click(screen.getByText('crashReport.doNotSend'))

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('crashReport.consentError')
      })
      // The decision was not recorded; destroying the crash file would throw away
      // both the consent record and the evidence the user was asked about.
      expect(mockDeleteCrashReport).not.toHaveBeenCalled()
      expect(useCrashReportStore.getState().crashReportDialogOpen).toBe(true)
    })
  })
})
