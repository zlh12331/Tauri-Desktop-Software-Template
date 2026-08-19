import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useThemeApplier } from './use-theme-applier'

describe('useThemeApplier', () => {
  let root: HTMLElement
  const addListener = vi.fn()
  const removeListener = vi.fn()

  beforeEach(() => {
    root = document.documentElement
    root.classList.remove('light', 'dark')
    addListener.mockReset()
    removeListener.mockReset()
    // 默认 matchMedia：matches=true（模拟系统偏好 dark）
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: addListener,
      removeEventListener: removeListener,
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('正向用例 — 主题类应用', () => {
    it('light 主题应用 light 类', () => {
      renderHook(() => useThemeApplier('light'))
      expect(root.classList.contains('light')).toBe(true)
    })

    it('dark 主题应用 dark 类', () => {
      renderHook(() => useThemeApplier('dark'))
      expect(root.classList.contains('dark')).toBe(true)
    })

    it('system 主题按系统偏好解析', () => {
      renderHook(() => useThemeApplier('system'))
      // matches=true → dark
      expect(root.classList.contains('dark')).toBe(true)
    })

    it('主题变化时重新应用', () => {
      const { rerender } = renderHook(
        ({ t }: { t: 'light' | 'dark' }) => useThemeApplier(t),
        {
          initialProps: { t: 'light' },
        }
      )
      expect(root.classList.contains('light')).toBe(true)

      rerender({ t: 'dark' })
      expect(root.classList.contains('dark')).toBe(true)
      expect(root.classList.contains('light')).toBe(false)
    })
  })

  describe('正向用例 — 系统偏好监听', () => {
    it('system 主题注册 matchMedia change 监听', () => {
      renderHook(() => useThemeApplier('system'))
      expect(addListener).toHaveBeenCalledTimes(1)
    })

    it('change 事件按 matches 应用 dark/light', () => {
      renderHook(() => useThemeApplier('system'))
      // addEventListener('change', handler) — handler 是第二参
      const handler = addListener.mock.calls[0]?.[1] as (
        e: MediaQueryListEvent
      ) => void
      expect(handler).toBeTypeOf('function')

      handler({ matches: false } as MediaQueryListEvent)
      expect(root.classList.contains('light')).toBe(true)

      handler({ matches: true } as MediaQueryListEvent)
      expect(root.classList.contains('dark')).toBe(true)
    })
  })

  describe('边界用例 — 非 system 主题不监听', () => {
    it('light 主题不注册 change 监听', () => {
      renderHook(() => useThemeApplier('light'))
      expect(addListener).not.toHaveBeenCalled()
    })

    it('dark 主题不注册 change 监听', () => {
      renderHook(() => useThemeApplier('dark'))
      expect(addListener).not.toHaveBeenCalled()
    })

    it('从 system 切到 light 时不再监听', () => {
      const { rerender } = renderHook(
        ({ t }: { t: 'light' | 'dark' | 'system' }) => useThemeApplier(t),
        { initialProps: { t: 'system' } }
      )
      expect(addListener).toHaveBeenCalledTimes(1)

      rerender({ t: 'light' })
      // 前一个 effect 清理时移除监听；新 effect 不注册
      expect(removeListener).toHaveBeenCalledTimes(1)
      expect(addListener).toHaveBeenCalledTimes(1)
    })
  })

  describe('异常用例 — 清理', () => {
    it('卸载时移除 change 监听（system）', () => {
      const { unmount } = renderHook(() => useThemeApplier('system'))
      expect(addListener).toHaveBeenCalledTimes(1)

      unmount()
      expect(removeListener).toHaveBeenCalledTimes(1)
    })

    it('卸载时不移除监听（非 system 从未注册）', () => {
      const { unmount } = renderHook(() => useThemeApplier('dark'))
      expect(addListener).not.toHaveBeenCalled()

      unmount()
      expect(removeListener).not.toHaveBeenCalled()
    })
  })
})
