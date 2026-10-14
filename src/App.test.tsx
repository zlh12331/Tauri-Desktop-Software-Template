import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act, screen, fireEvent, waitFor } from '@/test/test-utils'
import App from './App'

// ---------------------------------------------------------------------------
// Mocks — App initialization dependencies are injected fakes so startup paths
// (menu build, language init, recovery cleanup) can be asserted deterministically.
// Tauri bindings are mocked globally in src/test/setup.ts.
// All mock fns live in vi.hoisted so the hoisted vi.mock factories can use them.
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  buildAppMenu: vi.fn(),
  setupMenuLanguageListener: vi.fn(),
  initializeLanguage: vi.fn(),
  cleanupOldFiles: vi.fn(),
  isSentryInitialized: vi.fn(),
  captureMessage: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
}))

vi.mock('@/lib/menu', () => ({
  buildAppMenu: (...args: unknown[]) => mocks.buildAppMenu(...(args as [])),
  setupMenuLanguageListener: (...args: unknown[]) =>
    mocks.setupMenuLanguageListener(...(args as [])),
}))

vi.mock('@/i18n/language-init', () => ({
  initializeLanguage: (...args: unknown[]) =>
    mocks.initializeLanguage(...(args as [never])),
}))

vi.mock('@/lib/recovery', () => ({
  cleanupOldFiles: (...args: unknown[]) =>
    mocks.cleanupOldFiles(...(args as [])),
}))

vi.mock('@/lib/sentry', async importOriginal => {
  // 保留实际导出（isSentryEnabled 等被其它模块依赖），仅覆写 isSentryInitialized。
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    isSentryInitialized: (...args: unknown[]) =>
      mocks.isSentryInitialized(...(args as [])),
  }
})

vi.mock('@sentry/react', () => ({
  captureMessage: (...args: unknown[]) =>
    mocks.captureMessage(...(args as [never, never])),
}))

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }))

// Preferences come from a holder the tests can change, because the behaviour under
// test is what App does when the *saved language* changes. Only `usePreferences`
// is consumed inside this tree (App and ThemeProvider).
const prefs = vi.hoisted(() => ({
  current: {
    theme: 'system',
    quick_pane_shortcut: null,
    language: null as string | null,
    crash_reporting_consent: null,
  },
}))
vi.mock('@/queries/preferences', () => ({
  usePreferences: () => ({ data: prefs.current }),
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prefs.current = {
      theme: 'system',
      quick_pane_shortcut: null,
      language: null,
      crash_reporting_consent: null,
    }
    mocks.setupMenuLanguageListener.mockReturnValue(undefined)
    mocks.buildAppMenu.mockResolvedValue(undefined)
    mocks.initializeLanguage.mockResolvedValue(undefined)
    mocks.cleanupOldFiles.mockResolvedValue(undefined)
    mocks.isSentryInitialized.mockReturnValue(true)
    // 测试环境 import.meta.env.DEV 默认 true（vitest）
  })

  it('renders main window layout', async () => {
    await act(async () => {
      render(<App />)
    })
    expect(
      screen.getByRole('heading', { name: /hello world/i })
    ).toBeInTheDocument()
  })

  it('renders title bar with traffic light buttons', async () => {
    await act(async () => {
      render(<App />)
    })
    // Find specifically the window control buttons in the title bar
    const titleBarButtons = screen
      .getAllByRole('button')
      .filter(
        (button: HTMLElement) =>
          button.getAttribute('aria-label')?.includes('window') ||
          button.className.includes('window-control')
      )
    // Should have at least the window control buttons
    expect(titleBarButtons.length).toBeGreaterThan(0)
  })

  describe('正向用例 — 启动初始化', () => {
    it('dev 模式下渲染 Sentry E2E Debug 面板', async () => {
      await act(async () => {
        render(<App />)
      })
      expect(screen.getByText('Sentry E2E Debug')).toBeInTheDocument()
    })
    it('初始化语言、菜单与恢复文件清理', async () => {
      await act(async () => {
        render(<App />)
      })
      await waitFor(() => {
        expect(mocks.initializeLanguage).toHaveBeenCalledWith(null)
      })
      await waitFor(() => {
        expect(mocks.buildAppMenu).toHaveBeenCalled()
      })
      expect(mocks.setupMenuLanguageListener).toHaveBeenCalled()
      await waitFor(() => {
        expect(mocks.cleanupOldFiles).toHaveBeenCalled()
      })
    })
  })

  describe('正向用例 — 语言偏好变化与监听器回收', () => {
    // The startup effect used to depend on the saved language, so switching
    // language re-ran the one-shot steps and attached a second `languageChanged`
    // handler while the first stayed registered — the Nth switch rebuilt the menu
    // N times. These tests drive that path through the preference, not through a
    // remount, because a remount would hide the leak.
    function captureCleanups() {
      const cleanups: ReturnType<typeof vi.fn>[] = []
      mocks.setupMenuLanguageListener.mockImplementation(() => {
        const off = vi.fn()
        cleanups.push(off)
        return off
      })
      return cleanups
    }

    it('语言变化不会重复执行一次性启动步骤', async () => {
      const { rerender } = await act(async () => render(<App />))
      await waitFor(() =>
        expect(mocks.cleanupOldFiles).toHaveBeenCalledTimes(1)
      )

      await act(async () => {
        prefs.current = { ...prefs.current, language: 'zh' }
        rerender(<App />)
      })

      await waitFor(() => {
        expect(mocks.initializeLanguage).toHaveBeenCalledWith('zh')
      })
      expect(mocks.cleanupOldFiles).toHaveBeenCalledTimes(1)
    })

    it('语言变化时上一个菜单监听器被移除', async () => {
      const cleanups = captureCleanups()
      const { rerender } = await act(async () => render(<App />))
      await waitFor(() => expect(cleanups).toHaveLength(1))

      await act(async () => {
        prefs.current = { ...prefs.current, language: 'zh' }
        rerender(<App />)
      })

      await waitFor(() => expect(cleanups).toHaveLength(2))
      expect(cleanups[0]).toHaveBeenCalledTimes(1)
      expect(cleanups[1]).not.toHaveBeenCalled()
    })

    it('卸载时移除当前的菜单监听器', async () => {
      const cleanups = captureCleanups()
      const { unmount } = await act(async () => render(<App />))
      await waitFor(() => expect(cleanups).toHaveLength(1))

      act(() => unmount())

      expect(cleanups[0]).toHaveBeenCalledTimes(1)
    })
  })

  describe('正向用例 — SentryDebugPanel 交互', () => {
    it('点击 JS Error 发送消息并显示 lastEvent', async () => {
      await act(async () => {
        render(<App />)
      })
      fireEvent.click(screen.getByText('JS Error'))
      await waitFor(() => {
        expect(mocks.captureMessage).toHaveBeenCalledWith(
          expect.stringContaining('E2E JS error @'),
          'error'
        )
      })
      expect(screen.getByText(/^Sent: E2E JS error @/)).toBeInTheDocument()
    })

    // 注：Unhandled Rejection 按钮触发 Promise.reject，在 jsdom/Node 层产生
    // 不可抑制的 unhandled rejection，会污染 Vitest 结果。该按钮是 dev-only
    // E2E 调试面板，真实副作用由 e2e/ Playwright spec 覆盖，此处豁免。
  })

  describe('异常用例 — 初始化失败容错', () => {
    it('语言或菜单初始化失败时记录 warn 且不崩溃', async () => {
      mocks.initializeLanguage.mockRejectedValue(new Error('i18n failed'))

      await act(async () => {
        render(<App />)
      })

      await waitFor(() => {
        expect(mocks.logger.warn).toHaveBeenCalledWith(
          'Failed to initialize language or menu',
          { error: expect.any(Error) }
        )
      })
      // App 仍正常渲染
      expect(
        screen.getByRole('heading', { name: /hello world/i })
      ).toBeInTheDocument()
    })

    it('恢复文件清理失败时记录 warn 且不崩溃', async () => {
      mocks.cleanupOldFiles.mockRejectedValue(new Error('disk full'))

      await act(async () => {
        render(<App />)
      })

      await waitFor(() => {
        expect(mocks.logger.warn).toHaveBeenCalledWith(
          'Failed to cleanup old recovery files',
          { error: expect.any(Error) }
        )
      })
      expect(
        screen.getByRole('heading', { name: /hello world/i })
      ).toBeInTheDocument()
    })
  })
})
