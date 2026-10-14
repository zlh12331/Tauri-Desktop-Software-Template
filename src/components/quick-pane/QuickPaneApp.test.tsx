import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { logger } from '@/lib/logger'
import QuickPaneApp from './QuickPaneApp'

// Mock motion — render its `form` as a plain HTML form element
vi.mock('motion/react', () => ({
  motion: { form: 'form' },
}))

// Mock @tauri-apps/api/event — capture the theme and language listeners, and count
// the unlisten calls per event so cleanup is attributable.
const mockEmit = vi.fn()
let themeListener: ((event: { payload: { theme: string } }) => void) | undefined
let languageListener:
  ((event: { payload: { language: string } }) => void) | undefined
const unlistenByEvent = new Map<string, ReturnType<typeof vi.fn>>()
vi.mock('@tauri-apps/api/event', () => ({
  emit: (...args: unknown[]) => mockEmit(...(args as [never])),
  listen: (event: string, handler: (e: { payload: never }) => void) => {
    if (event === 'theme-changed') {
      themeListener = handler as (e: { payload: { theme: string } }) => void
    } else if (event === 'language-changed') {
      languageListener = handler as (e: {
        payload: { language: string }
      }) => void
    }
    const off = vi.fn()
    unlistenByEvent.set(event, off)
    return Promise.resolve(off)
  },
}))

// Mock @tauri-apps/api/window — capture the focus-change callback
const mockFocusUnlisten = vi.fn()
let focusListener:
  ((payload: { payload: boolean }) => Promise<void> | void) | undefined
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onFocusChanged: (cb: (p: { payload: boolean }) => void) => {
      focusListener = cb
      return Promise.resolve(mockFocusUnlisten)
    },
  }),
}))

// Mock tauri bindings
const mockDismissQuickPane = vi.fn()
const mockLoadPreferences = vi.fn()
vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    dismissQuickPane: (...args: unknown[]) =>
      mockDismissQuickPane(...(args as [])),
    loadPreferences: (...args: unknown[]) =>
      mockLoadPreferences(...(args as [])),
  },
}))

// Mock the language initialiser — the pane's job is to call it with the saved
// preference on mount and again whenever the main window announces a change;
// what initializeLanguage itself does is covered in i18n/language-init.test.ts.
const mockInitializeLanguage = vi.fn()
vi.mock('@/i18n', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  initializeLanguage: (...args: unknown[]) =>
    mockInitializeLanguage(...(args as [string | null])),
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

// Mock the theme-applier hook (DOM side-effect; real logic covered in its own suite)
vi.mock('@/hooks/use-theme-applier', () => ({
  useThemeApplier: () => undefined,
}))

// Mock i18n config to avoid full i18next init
vi.mock('@/i18n/config', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockDismissQuickPane.mockResolvedValue({ status: 'ok' })
  mockLoadPreferences.mockResolvedValue({
    status: 'ok',
    data: { theme: 'system', language: null },
  })
  mockInitializeLanguage.mockResolvedValue(undefined)
  unlistenByEvent.clear()
  localStorage.clear()
})

// Helper to resolve async effect work (theme/focus listeners + dismiss)
const flush = () => new Promise<void>(r => setTimeout(r, 0))

describe('QuickPaneApp', () => {
  it('renders the input with the placeholder translation', () => {
    render(<QuickPaneApp />)
    expect(
      screen.getByPlaceholderText('quickPane.placeholder')
    ).toBeInTheDocument()
  })

  describe('theme-changed listener', () => {
    it('applies a valid theme from the event payload', async () => {
      render(<QuickPaneApp />)
      // valid theme → setTheme path (no crash, listener handles it)
      await act(async () => {
        themeListener?.({ payload: { theme: 'dark' } })
      })
      expect(
        screen.getByPlaceholderText('quickPane.placeholder')
      ).toBeInTheDocument()
    })

    it('ignores an invalid theme value', async () => {
      render(<QuickPaneApp />)
      // invalid theme → isValidTheme returns false → no setTheme call
      await act(async () => {
        themeListener?.({ payload: { theme: 'blue' } })
      })
      expect(
        screen.getByPlaceholderText('quickPane.placeholder')
      ).toBeInTheDocument()
    })

    it('unsubscribes the theme listener on unmount', async () => {
      const { unmount } = render(<QuickPaneApp />)
      unmount()
      await flush()
      expect(unlistenByEvent.get('theme-changed')).toHaveBeenCalledTimes(1)
    })
  })

  describe('language-changed listener', () => {
    // The pane renders from its own i18n instance, and only `en` is bundled
    // synchronously. Before this effect it never asked for another language, so
    // a Chinese-speaking user got an English placeholder forever.
    it('挂载时按保存的语言偏好初始化面板语言', async () => {
      mockLoadPreferences.mockResolvedValue({
        status: 'ok',
        data: { theme: 'system', language: 'zh' },
      })

      await act(async () => {
        render(<QuickPaneApp />)
      })

      expect(mockInitializeLanguage).toHaveBeenCalledWith('zh')
    })

    it('读取偏好失败时退回系统检测（null）', async () => {
      mockLoadPreferences.mockResolvedValue({
        status: 'error',
        error: { kind: 'Io', message: 'no file' },
      })

      await act(async () => {
        render(<QuickPaneApp />)
      })

      expect(mockInitializeLanguage).toHaveBeenCalledWith(null)
    })

    it('收到主窗口的语言切换时重新初始化', async () => {
      await act(async () => {
        render(<QuickPaneApp />)
      })
      mockInitializeLanguage.mockClear()

      await act(async () => {
        languageListener?.({ payload: { language: 'zh' } })
      })

      expect(mockInitializeLanguage).toHaveBeenCalledWith('zh')
    })

    it('语言初始化失败时记录 warn 而不抛出', async () => {
      mockInitializeLanguage.mockRejectedValue(new Error('bundle missing'))

      await act(async () => {
        render(<QuickPaneApp />)
      })

      await waitFor(() => {
        expect(logger.warn).toHaveBeenCalledWith(
          'Quick pane failed to apply language',
          { error: expect.any(Error), language: null }
        )
      })
    })

    it('卸载时移除语言监听器', async () => {
      const { unmount } = render(<QuickPaneApp />)
      await flush()

      act(() => unmount())

      expect(unlistenByEvent.get('language-changed')).toHaveBeenCalledTimes(1)
    })
  })

  describe('focus change', () => {
    it('re-syncs theme and focuses the input when the window gains focus', async () => {
      localStorage.setItem('ui-theme', 'light')
      render(<QuickPaneApp />)
      const input = screen.getByPlaceholderText(
        'quickPane.placeholder'
      ) as HTMLInputElement
      focusListener?.({ payload: true })
      await waitFor(() => expect(input).toHaveFocus())
      expect(mockDismissQuickPane).not.toHaveBeenCalled()
    })

    it('dismisses the quick pane when the window loses focus', async () => {
      render(<QuickPaneApp />)
      focusListener?.({ payload: false })
      await waitFor(() => expect(mockDismissQuickPane).toHaveBeenCalledTimes(1))
    })

    it('unsubscribes the focus listener on unmount', async () => {
      const { unmount } = render(<QuickPaneApp />)
      unmount()
      await flush()
      expect(mockFocusUnlisten).toHaveBeenCalledTimes(1)
    })
  })

  describe('Escape key', () => {
    it('prevents default and dismisses on Escape', async () => {
      render(<QuickPaneApp />)
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        cancelable: true,
      })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
      window.dispatchEvent(event)
      await waitFor(() => expect(mockDismissQuickPane).toHaveBeenCalledTimes(1))
      expect(preventDefaultSpy).toHaveBeenCalledTimes(1)
    })

    it('does not dismiss on other keys', async () => {
      render(<QuickPaneApp />)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
      await flush()
      expect(mockDismissQuickPane).not.toHaveBeenCalled()
    })

    it('removes the keydown listener on unmount', async () => {
      const { unmount } = render(<QuickPaneApp />)
      unmount()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await flush()
      expect(mockDismissQuickPane).not.toHaveBeenCalled()
    })
  })

  describe('submit', () => {
    it('emits the trimmed text and clears the input on non-empty submit', async () => {
      const user = userEvent.setup()
      render(<QuickPaneApp />)
      const input = screen.getByPlaceholderText('quickPane.placeholder')
      await user.type(input, '  hello world  ')
      await user.keyboard('{Enter}')

      await waitFor(() => expect(mockEmit).toHaveBeenCalledTimes(1))
      expect(mockEmit).toHaveBeenCalledWith('quick-pane-submit', {
        text: 'hello world',
      })
      expect(input).toHaveValue('')
      expect(mockDismissQuickPane).toHaveBeenCalledTimes(1)
    })

    it('does not emit when the text is empty or whitespace-only', async () => {
      const user = userEvent.setup()
      render(<QuickPaneApp />)
      const input = screen.getByPlaceholderText('quickPane.placeholder')
      await user.type(input, '   ')
      await user.keyboard('{Enter}')

      await flush()
      expect(mockEmit).not.toHaveBeenCalled()
      expect(mockDismissQuickPane).toHaveBeenCalledTimes(1)
    })
  })

  describe('dismissQuickPane error handling', () => {
    it('logs an error when the dismiss command fails', async () => {
      mockDismissQuickPane.mockResolvedValue({
        status: 'error',
        error: { kind: 'Io', message: 'boom' },
      })
      render(<QuickPaneApp />)
      focusListener?.({ payload: false })
      await waitFor(() => expect(mockDismissQuickPane).toHaveBeenCalledTimes(1))
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to dismiss quick pane',
        { error: { kind: 'Io', message: 'boom' } }
      )
    })
  })
})
