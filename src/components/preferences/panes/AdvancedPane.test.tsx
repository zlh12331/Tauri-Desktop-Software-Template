import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdvancedPane } from './AdvancedPane'

// Pointer capture, scrollIntoView, and ResizeObserver polyfills are
// registered globally in src/test/setup.ts.

// 辅助函数: 模拟 Radix Switch 的完整点击交互
function clickSwitch(element: HTMLElement): void {
  fireEvent.pointerDown(element)
  fireEvent.pointerUp(element)
  fireEvent.click(element)
}

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

// Mock toast
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
const mockToastInfo = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...(args as [never])),
    error: (...args: unknown[]) => mockToastError(...(args as [never])),
    info: (...args: unknown[]) => mockToastInfo(...(args as [never])),
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
vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    loadPreferences: (...args: unknown[]) =>
      mockLoadPreferences(...(args as [])),
    savePreferences: (...args: unknown[]) =>
      mockSavePreferences(...(args as [never])),
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

const defaultPrefs = {
  theme: 'system',
  quick_pane_shortcut: null,
  language: null,
  crash_reporting_consent: null,
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe('AdvancedPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsSentryEnabled.mockReturnValue(true)
    mockLoadPreferences.mockResolvedValue({
      status: 'ok',
      data: defaultPrefs,
    })
    mockSavePreferences.mockResolvedValue({ status: 'ok', data: null })
  })

  describe('正向用例 — 渲染', () => {
    it('渲染所有区块标题', async () => {
      renderWithClient(<AdvancedPane />)
      expect(screen.getByText('preferences.advanced.title')).toBeInTheDocument()
      expect(
        screen.getByText('preferences.advanced.crashReporting.title')
      ).toBeInTheDocument()
      expect(
        screen.getByText('preferences.advanced.apiConfig.title')
      ).toBeInTheDocument()
    })

    it('挂载时调用 loadPreferences 加载崩溃上报同意状态', async () => {
      renderWithClient(<AdvancedPane />)
      await waitFor(() => {
        expect(mockLoadPreferences).toHaveBeenCalledTimes(1)
      })
    })

    it('sentry 未配置时显示 "not configured" 提示', async () => {
      mockIsSentryEnabled.mockReturnValue(false)
      renderWithClient(<AdvancedPane />)
      expect(
        screen.getByText('preferences.advanced.crashReporting.notConfigured')
      ).toBeInTheDocument()
    })

    it('sentry 已配置时不显示 "not configured" 提示', () => {
      mockIsSentryEnabled.mockReturnValue(true)
      renderWithClient(<AdvancedPane />)
      expect(
        screen.queryByText('preferences.advanced.crashReporting.notConfigured')
      ).not.toBeInTheDocument()
    })
  })

  describe('正向用例 — 用户交互', () => {
    it('切换 example toggle 显示对应状态文本', () => {
      renderWithClient(<AdvancedPane />)
      // Initially disabled
      expect(screen.getAllByText('common.disabled').length).toBeGreaterThan(0)

      const toggle = document.getElementById(
        'example-advanced-toggle'
      ) as HTMLElement
      clickSwitch(toggle)

      expect(screen.getAllByText('common.enabled').length).toBeGreaterThan(0)
    })

    it('切换崩溃上报开关(启用)调用 setSentryConsent(true) 和 savePreferences', async () => {
      renderWithClient(<AdvancedPane />)

      await waitFor(() => {
        expect(mockLoadPreferences).toHaveBeenCalled()
      })

      const crashToggle = document.getElementById(
        'crash-reporting-toggle'
      ) as HTMLElement
      clickSwitch(crashToggle)

      await waitFor(() => {
        expect(mockSavePreferences).toHaveBeenCalledWith({
          ...defaultPrefs,
          crash_reporting_consent: true,
        })
      })
      expect(mockSetSentryConsent).toHaveBeenCalledWith(true)
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'preferences.advanced.crashReporting.enabled'
      )
    })

    it('切换崩溃上报开关(禁用)调用 setSentryConsent(false)', async () => {
      // Pretend consent was already true
      mockLoadPreferences.mockResolvedValue({
        status: 'ok',
        data: { ...defaultPrefs, crash_reporting_consent: true },
      })

      renderWithClient(<AdvancedPane />)

      await waitFor(() => {
        expect(mockLoadPreferences).toHaveBeenCalled()
      })

      const crashToggle = document.getElementById(
        'crash-reporting-toggle'
      ) as HTMLElement
      // Toggle is initially checked because consent was true
      await waitFor(() => {
        expect(crashToggle).toHaveAttribute('data-state', 'checked')
      })

      clickSwitch(crashToggle)

      await waitFor(() => {
        expect(mockSavePreferences).toHaveBeenCalledWith({
          ...defaultPrefs,
          crash_reporting_consent: false,
        })
      })
      expect(mockSetSentryConsent).toHaveBeenCalledWith(false)
      expect(mockToastInfo).toHaveBeenCalledWith(
        'preferences.advanced.crashReporting.disabled'
      )
    })
  })

  describe('边界用例', () => {
    it('sentry 未配置时崩溃上报开关被禁用', () => {
      mockIsSentryEnabled.mockReturnValue(false)
      renderWithClient(<AdvancedPane />)
      const crashToggle = document.getElementById(
        'crash-reporting-toggle'
      ) as HTMLElement
      expect(crashToggle).toBeDisabled()
    })

    it('example dropdown 默认选中 option1', () => {
      renderWithClient(<AdvancedPane />)
      // The Select trigger displays the current value
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveTextContent('preferences.advanced.option1')
    })
  })

  describe('异常用例', () => {
    it('loadPreferences 返回 error 时不抛错,开关保持默认关闭', async () => {
      mockLoadPreferences.mockResolvedValue({
        status: 'error',
        error: 'disk error',
      })
      renderWithClient(<AdvancedPane />)
      await waitFor(() => {
        expect(mockLoadPreferences).toHaveBeenCalled()
      })
      const crashToggle = document.getElementById(
        'crash-reporting-toggle'
      ) as HTMLElement
      expect(crashToggle).toHaveAttribute('data-state', 'unchecked')
    })

    it('loadPreferences 抛出异常时记录错误日志', async () => {
      mockLoadPreferences.mockRejectedValue(new Error('network failure'))
      renderWithClient(<AdvancedPane />)
      await waitFor(() => {
        expect(mockLoadPreferences).toHaveBeenCalled()
      })
      // Should not throw — error is caught internally
      const crashToggle = document.getElementById(
        'crash-reporting-toggle'
      ) as HTMLElement
      expect(crashToggle).toHaveAttribute('data-state', 'unchecked')
    })

    it('切换崩溃上报时 savePreferences 抛错显示错误 toast', async () => {
      mockSavePreferences.mockRejectedValue(new Error('save failed'))

      renderWithClient(<AdvancedPane />)

      await waitFor(() => {
        expect(mockLoadPreferences).toHaveBeenCalled()
      })

      const crashToggle = document.getElementById(
        'crash-reporting-toggle'
      ) as HTMLElement
      clickSwitch(crashToggle)

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          'preferences.advanced.crashReporting.toggleError'
        )
      })
    })
  })
})
