import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { logger } from '@/lib/logger'
import QuickPaneApp from './QuickPaneApp'

// Mock motion — render its `form` as a plain HTML form element
vi.mock('motion/react', () => ({
  motion: { form: 'form' },
}))

// Mock @tauri-apps/api/event — capture the theme listener callback
const mockEmit = vi.fn()
const mockUnlistenEvent = vi.fn()
let themeListener: ((event: { payload: { theme: string } }) => void) | undefined
vi.mock('@tauri-apps/api/event', () => ({
  emit: (...args: unknown[]) => mockEmit(...(args as [never])),
  listen: (
    _event: string,
    handler: (e: { payload: { theme: string } }) => void
  ) => {
    themeListener = handler
    return Promise.resolve(mockUnlistenEvent)
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
vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    dismissQuickPane: (...args: unknown[]) =>
      mockDismissQuickPane(...(args as [])),
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
      expect(mockUnlistenEvent).toHaveBeenCalledTimes(1)
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
