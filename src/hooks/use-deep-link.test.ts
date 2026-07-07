import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

// Mock the deep-link plugin
const mockGetCurrent = vi.fn<() => Promise<string[] | null | undefined>>()
const mockOnOpenUrl =
  vi.fn<(cb: (urls: string[]) => void) => Promise<() => void>>()
let openUrlCallback: ((urls: string[]) => void) | null = null
const mockUnlisten = vi.fn()

vi.mock('@tauri-apps/plugin-deep-link', () => ({
  getCurrent: (...args: unknown[]) => mockGetCurrent(...(args as [])),
  onOpenUrl: (...args: unknown[]) =>
    mockOnOpenUrl(...(args as [(urls: string[]) => void])),
}))

// Mock the dialog store
const mockSetPreferencesOpen = vi.fn()
const mockSetCommandPaletteOpen = vi.fn()

vi.mock('@/store/dialog-store', () => ({
  useDialogStore: {
    getState: () => ({
      setPreferencesOpen: mockSetPreferencesOpen,
      setCommandPaletteOpen: mockSetCommandPaletteOpen,
    }),
  },
}))

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  },
}))

const { useDeepLink } = await import('./use-deep-link')
const { logger } = await import('@/lib/logger')

// Helper to flush the async IIFE inside the effect
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('useDeepLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    openUrlCallback = null
    mockGetCurrent.mockResolvedValue([])
    mockOnOpenUrl.mockImplementation(cb => {
      openUrlCallback = cb
      return Promise.resolve(mockUnlisten)
    })
  })

  describe('正向用例 — 初始深链接 (getCurrent)', () => {
    it('opens preferences dialog for a preferences deep link', async () => {
      mockGetCurrent.mockResolvedValue(['tauri-app://preferences'])

      renderHook(() => useDeepLink())
      await flush()

      expect(mockSetPreferencesOpen).toHaveBeenCalledWith(true)
      expect(mockSetCommandPaletteOpen).not.toHaveBeenCalled()
    })

    it('opens command palette for a command-palette deep link', async () => {
      mockGetCurrent.mockResolvedValue(['tauri-app://command-palette'])

      renderHook(() => useDeepLink())
      await flush()

      expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(true)
      expect(mockSetPreferencesOpen).not.toHaveBeenCalled()
    })

    it('handles preferences route with a trailing slash', async () => {
      mockGetCurrent.mockResolvedValue(['tauri-app://preferences/'])

      renderHook(() => useDeepLink())
      await flush()

      expect(mockSetPreferencesOpen).toHaveBeenCalledWith(true)
    })

    it('handles command-palette route with a trailing slash', async () => {
      mockGetCurrent.mockResolvedValue(['tauri-app://command-palette/'])

      renderHook(() => useDeepLink())
      await flush()

      expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(true)
    })

    it('handles only the first URL when multiple are returned', async () => {
      mockGetCurrent.mockResolvedValue([
        'tauri-app://preferences',
        'tauri-app://command-palette',
      ])

      renderHook(() => useDeepLink())
      await flush()

      expect(mockSetPreferencesOpen).toHaveBeenCalledWith(true)
      expect(mockSetCommandPaletteOpen).not.toHaveBeenCalled()
    })
  })

  describe('正向用例 — 运行时深链接 (onOpenUrl)', () => {
    it('navigates to preferences when a future deep link arrives', async () => {
      renderHook(() => useDeepLink())
      await flush()

      expect(openUrlCallback).not.toBeNull()
      openUrlCallback?.(['tauri-app://preferences'])
      expect(mockSetPreferencesOpen).toHaveBeenCalledWith(true)
    })

    it('navigates to command palette when a future deep link arrives', async () => {
      renderHook(() => useDeepLink())
      await flush()

      openUrlCallback?.(['tauri-app://command-palette'])
      expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(true)
    })

    it('handles multiple URLs in a single onOpenUrl event', async () => {
      renderHook(() => useDeepLink())
      await flush()

      openUrlCallback?.([
        'tauri-app://preferences',
        'tauri-app://command-palette',
      ])

      expect(mockSetPreferencesOpen).toHaveBeenCalledWith(true)
      expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(true)
    })
  })

  describe('边界用例 — 空输入与未知路由', () => {
    it('does nothing when getCurrent returns an empty array', async () => {
      mockGetCurrent.mockResolvedValue([])

      renderHook(() => useDeepLink())
      await flush()

      expect(mockSetPreferencesOpen).not.toHaveBeenCalled()
      expect(mockSetCommandPaletteOpen).not.toHaveBeenCalled()
    })

    it('does nothing when getCurrent returns null', async () => {
      mockGetCurrent.mockResolvedValue(null)

      renderHook(() => useDeepLink())
      await flush()

      expect(mockSetPreferencesOpen).not.toHaveBeenCalled()
    })

    it('does nothing when the first URL is an empty string', async () => {
      mockGetCurrent.mockResolvedValue([''])

      renderHook(() => useDeepLink())
      await flush()

      expect(mockSetPreferencesOpen).not.toHaveBeenCalled()
      expect(logger.warn).not.toHaveBeenCalled()
    })

    it('logs a warning for an unknown deep link route', async () => {
      mockGetCurrent.mockResolvedValue(['tauri-app://unknown'])

      renderHook(() => useDeepLink())
      await flush()

      expect(logger.warn).toHaveBeenCalledWith('Unknown deep link route', {
        url: 'tauri-app://unknown',
        route: 'unknown',
      })
      expect(mockSetPreferencesOpen).not.toHaveBeenCalled()
      expect(mockSetCommandPaletteOpen).not.toHaveBeenCalled()
    })

    it('does not navigate for an unknown route via onOpenUrl', async () => {
      renderHook(() => useDeepLink())
      await flush()

      openUrlCallback?.(['tauri-app://some-other-route'])
      expect(mockSetPreferencesOpen).not.toHaveBeenCalled()
      expect(mockSetCommandPaletteOpen).not.toHaveBeenCalled()
    })
  })

  describe('异常用例 — API 调用失败', () => {
    it('logs a warning when getCurrent throws', async () => {
      mockGetCurrent.mockRejectedValue(new Error('plugin not available'))

      renderHook(() => useDeepLink())
      await flush()

      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to get initial deep link',
        { error: expect.any(Error) }
      )
    })

    it('still registers the onOpenUrl listener even if getCurrent fails', async () => {
      mockGetCurrent.mockRejectedValue(new Error('boom'))

      renderHook(() => useDeepLink())
      await flush()

      expect(openUrlCallback).not.toBeNull()
    })

    it('logs a warning when onOpenUrl registration throws', async () => {
      mockOnOpenUrl.mockRejectedValue(new Error('register failed'))

      renderHook(() => useDeepLink())
      await flush()

      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to register deep link listener',
        { error: expect.any(Error) }
      )
    })

    it('does not register an unlisten when onOpenUrl fails', async () => {
      mockOnOpenUrl.mockRejectedValue(new Error('register failed'))

      const { unmount } = renderHook(() => useDeepLink())
      await flush()
      unmount()

      // unlisten was never assigned, so cleanup should be a no-op
      expect(mockUnlisten).not.toHaveBeenCalled()
    })
  })

  describe('边界用例 — 清理副作用', () => {
    it('calls unlisten on unmount', async () => {
      const { unmount } = renderHook(() => useDeepLink())
      await flush()

      unmount()
      expect(mockUnlisten).toHaveBeenCalledTimes(1)
    })

    it('does not call unlisten before the listener resolves', () => {
      const { unmount } = renderHook(() => useDeepLink())
      // Unmount immediately, before flush
      unmount()
      expect(mockUnlisten).not.toHaveBeenCalled()
    })
  })
})
