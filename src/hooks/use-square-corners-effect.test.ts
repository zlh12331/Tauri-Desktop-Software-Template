import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mock @tauri-apps/plugin-os — platform() drives usePlatform()
// ---------------------------------------------------------------------------
const mockPlatform = vi.fn<() => 'macos' | 'windows' | 'linux'>()

vi.mock('@tauri-apps/plugin-os', () => ({
  platform: (...args: unknown[]) => mockPlatform(...(args as [])),
}))

// ---------------------------------------------------------------------------
// Mock @tauri-apps/api/window — getCurrentWindow() returns a fake window
// ---------------------------------------------------------------------------
let resizeCallback: (() => void) | null = null
const mockUnlisten = vi.fn()
const mockOnResized = vi.fn((cb: () => void): Promise<() => void> => {
  resizeCallback = cb
  return Promise.resolve(mockUnlisten)
})
const mockIsFullscreen = vi.fn<() => Promise<boolean>>()

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    isFullscreen: (...args: unknown[]) => mockIsFullscreen(...(args as [])),
    onResized: (...args: unknown[]) => mockOnResized(...(args as [() => void])),
  }),
}))

// ---------------------------------------------------------------------------
// Mock @/store/ui-store — selector-style hook with a mutable state bag
// ---------------------------------------------------------------------------
const mockSetSquareCorners = vi.fn()
const uiState = {
  setSquareCorners: mockSetSquareCorners,
  squareCorners: false,
}

vi.mock('@/store/ui-store', () => ({
  useUIStore: (selector: (s: typeof uiState) => unknown) => selector(uiState),
}))

const { useSquareCornersEffect } = await import('./useSquareCornersEffect')
const { __resetPlatformCache } = await import('./use-platform')

// Flush async chains inside the effect
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0))

describe('useSquareCornersEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resizeCallback = null
    uiState.squareCorners = false
    // 复位 platform 缓存，使每个测试可独立设置平台
    __resetPlatformCache()
    mockIsFullscreen.mockResolvedValue(false)
  })

  describe('正向用例 — macOS 始终圆角', () => {
    it('macos 平台直接设置 squareCorners 为 false 且不查询窗口', async () => {
      mockPlatform.mockReturnValue('macos')

      renderHook(() => useSquareCornersEffect())
      await flush()

      expect(mockSetSquareCorners).toHaveBeenCalledWith(false)
      expect(mockIsFullscreen).not.toHaveBeenCalled()
    })
  })

  describe('正向用例 — Windows/Linux 全屏时方角', () => {
    it('windows 全屏时设置 squareCorners 为 true', async () => {
      mockPlatform.mockReturnValue('windows')
      mockIsFullscreen.mockResolvedValue(true)

      renderHook(() => useSquareCornersEffect())
      await flush()

      expect(mockSetSquareCorners).toHaveBeenCalledWith(true)
      expect(mockIsFullscreen).toHaveBeenCalledTimes(1)
    })

    it('windows 非全屏时设置 squareCorners 为 false', async () => {
      mockPlatform.mockReturnValue('windows')
      mockIsFullscreen.mockResolvedValue(false)

      renderHook(() => useSquareCornersEffect())
      await flush()

      expect(mockSetSquareCorners).toHaveBeenCalledWith(false)
    })

    it('linux 全屏时设置 squareCorners 为 true', async () => {
      mockPlatform.mockReturnValue('linux')
      mockIsFullscreen.mockResolvedValue(true)

      renderHook(() => useSquareCornersEffect())
      await flush()

      expect(mockSetSquareCorners).toHaveBeenCalledWith(true)
    })

    it('linux 非全屏时设置 squareCorners 为 false', async () => {
      mockPlatform.mockReturnValue('linux')
      mockIsFullscreen.mockResolvedValue(false)

      renderHook(() => useSquareCornersEffect())
      await flush()

      expect(mockSetSquareCorners).toHaveBeenCalledWith(false)
    })
  })

  describe('边界用例 — 窗口尺寸变化重新评估', () => {
    it('onResized 触发后根据新全屏状态更新 squareCorners', async () => {
      mockPlatform.mockReturnValue('windows')
      mockIsFullscreen.mockResolvedValue(false)

      renderHook(() => useSquareCornersEffect())
      await flush()
      expect(mockSetSquareCorners).toHaveBeenCalledWith(false)

      // 模拟进入全屏后窗口 resize
      mockIsFullscreen.mockResolvedValue(true)
      resizeCallback?.()
      await flush()

      expect(mockSetSquareCorners).toHaveBeenCalledWith(true)
    })

    it('onResized 回调注册在前且 cleanup 时调用 unlisten', async () => {
      mockPlatform.mockReturnValue('windows')
      mockIsFullscreen.mockResolvedValue(false)

      const { unmount } = renderHook(() => useSquareCornersEffect())
      await flush()
      expect(mockOnResized).toHaveBeenCalledTimes(1)

      unmount()
      await flush()

      expect(mockUnlisten).toHaveBeenCalledTimes(1)
    })
  })

  describe('边界用例 — 卸载取消守卫', () => {
    it('isFullscreen 返回前卸载：cancelled 守卫跳过 setSquareCorners', async () => {
      mockPlatform.mockReturnValue('windows')
      // isFullscreen 保持 pending，卸载后再 resolve
      let resolveFs: (v: boolean) => void = () => undefined
      mockIsFullscreen.mockImplementation(
        () => new Promise(r => (resolveFs = r))
      )

      const { unmount } = renderHook(() => useSquareCornersEffect())
      await flush()
      unmount()
      resolveFs(false)
      await flush()

      // 卸载后取消，不应再调用 setSquareCorners
      expect(mockSetSquareCorners).not.toHaveBeenCalled()
    })

    it('onResized 触发时若已取消：cancelled 守卫跳过 updateCorners', async () => {
      mockPlatform.mockReturnValue('windows')
      mockIsFullscreen.mockResolvedValue(false)

      const { unmount } = renderHook(() => useSquareCornersEffect())
      await flush()
      // 先卸载取消监听，再触发 resize 回调
      unmount()
      await flush()
      mockSetSquareCorners.mockClear()
      resizeCallback?.()
      await flush()

      expect(mockSetSquareCorners).not.toHaveBeenCalled()
    })
  })

  describe('正向用例 — store 状态同步到 DOM', () => {
    it('squareCorners 为 false 时移除 square-corners 类', () => {
      mockPlatform.mockReturnValue('windows')
      mockIsFullscreen.mockResolvedValue(false)
      document.documentElement.classList.add('square-corners')

      renderHook(() => useSquareCornersEffect())

      expect(
        document.documentElement.classList.contains('square-corners')
      ).toBe(false)
    })

    it('squareCorners 为 true 时添加 square-corners 类', () => {
      mockPlatform.mockReturnValue('windows')
      mockIsFullscreen.mockResolvedValue(true)
      uiState.squareCorners = true

      const { rerender } = renderHook(() => useSquareCornersEffect())

      // 通过重新渲染触发依赖 [squareCorners] 的同步 effect
      act(() => {
        rerender()
      })

      expect(
        document.documentElement.classList.contains('square-corners')
      ).toBe(true)
    })
  })
})
