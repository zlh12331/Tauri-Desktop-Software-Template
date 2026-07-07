import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

// Mock the dialog store
const mockSetPreferencesOpen = vi.fn()
vi.mock('@/store/dialog-store', () => ({
  useDialogStore: {
    getState: () => ({
      setPreferencesOpen: mockSetPreferencesOpen,
    }),
  },
}))

// Mock notifications
const mockNotify = vi.fn()
vi.mock('@/lib/notifications', () => ({
  notify: (...args: unknown[]) =>
    mockNotify(...(args as [string, unknown, unknown])),
}))

const { useCommandContext } = await import('./use-command-context')

describe('useCommandContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('正向用例 — 返回稳定的命令上下文', () => {
    it('returns an object with openPreferences and showToast', () => {
      const { result } = renderHook(() => useCommandContext())

      expect(result.current).toHaveProperty('openPreferences')
      expect(result.current).toHaveProperty('showToast')
      expect(typeof result.current.openPreferences).toBe('function')
      expect(typeof result.current.showToast).toBe('function')
    })

    it('returns a stable reference across multiple renders', () => {
      const { result, rerender } = renderHook(() => useCommandContext())

      const first = result.current
      rerender()
      const second = result.current

      expect(second).toBe(first)
    })

    it('returns the same reference across multiple hook instances', () => {
      const { result: a } = renderHook(() => useCommandContext())
      const { result: b } = renderHook(() => useCommandContext())

      expect(b.current).toBe(a.current)
    })
  })

  describe('正向用例 — openPreferences', () => {
    it('calls setPreferencesOpen with true on the dialog store', () => {
      const { result } = renderHook(() => useCommandContext())

      result.current.openPreferences()

      expect(mockSetPreferencesOpen).toHaveBeenCalledTimes(1)
      expect(mockSetPreferencesOpen).toHaveBeenCalledWith(true)
    })

    it('returns whatever setPreferencesOpen returns', () => {
      mockSetPreferencesOpen.mockReturnValueOnce('opened')
      const { result } = renderHook(() => useCommandContext())

      const ret = result.current.openPreferences()
      expect(ret).toBe('opened')
    })
  })

  describe('正向用例 — showToast', () => {
    it('calls notify with the message and default info type', () => {
      const { result } = renderHook(() => useCommandContext())

      result.current.showToast('hello')

      expect(mockNotify).toHaveBeenCalledWith('hello', undefined, {
        type: 'info',
      })
    })

    it('passes a custom notification type through to notify', () => {
      const { result } = renderHook(() => useCommandContext())

      result.current.showToast('saved', 'success')

      expect(mockNotify).toHaveBeenCalledWith('saved', undefined, {
        type: 'success',
      })
    })

    it('passes the error type through to notify', () => {
      const { result } = renderHook(() => useCommandContext())

      result.current.showToast('failed', 'error')

      expect(mockNotify).toHaveBeenCalledWith('failed', undefined, {
        type: 'error',
      })
    })
  })

  describe('边界用例', () => {
    it('showToast defaults to info when type is undefined', () => {
      const { result } = renderHook(() => useCommandContext())

      result.current.showToast('message', undefined)

      expect(mockNotify).toHaveBeenCalledWith('message', undefined, {
        type: 'info',
      })
    })

    it('openPreferences does not require any arguments', () => {
      const { result } = renderHook(() => useCommandContext())

      expect(() => result.current.openPreferences()).not.toThrow()
      expect(mockSetPreferencesOpen).toHaveBeenCalledWith(true)
    })
  })

  describe('异常用例 — store 调用失败隔离', () => {
    it('propagates setPreferencesOpen errors to the caller', () => {
      mockSetPreferencesOpen.mockImplementation(() => {
        throw new Error('store not ready')
      })
      const { result } = renderHook(() => useCommandContext())

      expect(() => result.current.openPreferences()).toThrow('store not ready')
    })
  })
})
