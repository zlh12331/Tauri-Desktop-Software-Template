import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

// Mock useCommandContext
const mockCommandContext = { openPreferences: vi.fn(), showToast: vi.fn() }
vi.mock('./use-command-context', () => ({
  useCommandContext: () => mockCommandContext,
}))

// Mock useKeyboardShortcuts
const mockUseKeyboardShortcuts = vi.fn()
vi.mock('./use-keyboard-shortcuts', () => ({
  useKeyboardShortcuts: (...args: unknown[]) =>
    mockUseKeyboardShortcuts(...(args as [unknown])),
}))

// Mock the UI store
const mockSetLastQuickPaneEntry = vi.fn()
vi.mock('@/store/ui-store', () => ({
  useUIStore: {
    getState: () => ({
      setLastQuickPaneEntry: mockSetLastQuickPaneEntry,
    }),
  },
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    trace: vi.fn(),
  },
}))

// Mock @tauri-apps/api/event listen
let listenCallback: ((event: { payload: { text: string } }) => void) | null =
  null
const mockUnlisten = vi.fn()
const mockListen = vi.fn()

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => mockListen(...(args as [string, unknown])),
}))

const { useMainWindowEventListeners } =
  await import('./useMainWindowEventListeners')
const { logger } = await import('@/lib/logger')

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('useMainWindowEventListeners', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listenCallback = null
    mockUnlisten.mockClear()
    mockListen.mockImplementation(
      (_event: string, cb: (event: { payload: { text: string } }) => void) => {
        listenCallback = cb
        return Promise.resolve(mockUnlisten)
      }
    )
  })

  describe('正向用例 — 组合子 hooks', () => {
    it('calls useCommandContext and useKeyboardShortcuts', () => {
      renderHook(() => useMainWindowEventListeners())

      expect(mockUseKeyboardShortcuts).toHaveBeenCalledTimes(1)
      expect(mockUseKeyboardShortcuts).toHaveBeenCalledWith(mockCommandContext)
    })
  })

  describe('正向用例 — quick-pane-submit 事件监听', () => {
    it('registers a listener for the quick-pane-submit event', () => {
      renderHook(() => useMainWindowEventListeners())

      expect(mockListen).toHaveBeenCalledWith(
        'quick-pane-submit',
        expect.any(Function)
      )
    })

    it('updates the store with the submitted text when the event fires', async () => {
      renderHook(() => useMainWindowEventListeners())
      await flush()

      expect(listenCallback).not.toBeNull()
      listenCallback?.({ payload: { text: 'search query' } })

      expect(mockSetLastQuickPaneEntry).toHaveBeenCalledWith('search query')
    })

    it('logs a debug message when a quick pane submit event arrives', async () => {
      renderHook(() => useMainWindowEventListeners())
      await flush()

      listenCallback?.({ payload: { text: 'note text' } })

      expect(logger.debug).toHaveBeenCalledWith(
        'Quick pane submit event received',
        { text: 'note text' }
      )
    })

    it('handles multiple consecutive submit events', async () => {
      renderHook(() => useMainWindowEventListeners())
      await flush()

      listenCallback?.({ payload: { text: 'first' } })
      listenCallback?.({ payload: { text: 'second' } })

      expect(mockSetLastQuickPaneEntry).toHaveBeenNthCalledWith(1, 'first')
      expect(mockSetLastQuickPaneEntry).toHaveBeenNthCalledWith(2, 'second')
    })
  })

  describe('边界用例 — 清理副作用', () => {
    it('calls unlisten on unmount after the listener has resolved', async () => {
      const { unmount } = renderHook(() => useMainWindowEventListeners())
      await flush()

      unmount()
      expect(mockUnlisten).toHaveBeenCalledTimes(1)
    })
  })

  describe('异常用例 — listen 注册失败', () => {
    it('logs an error when listen rejects', async () => {
      mockListen.mockRejectedValue(new Error('event system unavailable'))

      renderHook(() => useMainWindowEventListeners())
      await flush()

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to setup quick-pane-submit listener',
        { error: expect.any(Error) }
      )
    })

    it('does not throw when listen rejects', async () => {
      mockListen.mockRejectedValue(new Error('boom'))

      expect(() =>
        renderHook(() => useMainWindowEventListeners())
      ).not.toThrow()
      await flush()
    })
  })

  describe('边界用例 — 卸载发生在 listen 解析之前', () => {
    it('calls the returned unlisten immediately if the component unmounted', async () => {
      // Defer the listen resolution so unmount happens first
      let resolveListen: (value: unknown) => void = () => undefined
      mockListen.mockImplementation(
        (
          _event: string,
          cb: (event: { payload: { text: string } }) => void
        ) => {
          listenCallback = cb
          return new Promise(resolve => {
            resolveListen = resolve
          })
        }
      )

      const { unmount } = renderHook(() => useMainWindowEventListeners())
      unmount()

      // Now resolve the listen promise after unmount
      resolveListen(mockUnlisten)
      await flush()

      // The hook should call unlistenFn because isMounted is false
      expect(mockUnlisten).toHaveBeenCalledTimes(1)
    })
  })
})
