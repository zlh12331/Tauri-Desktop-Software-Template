import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

// The hook owns exactly one decision: when to knock. Everything the user sees is
// covered in src/lib/updater.test.ts.
const mockCheckForUpdates = vi.fn().mockResolvedValue('up-to-date')

vi.mock('@/lib/updater', () => ({
  checkForUpdates: (...args: unknown[]) => mockCheckForUpdates(...(args as [])),
}))

const { useAutoUpdater } = await import('./use-auto-updater')

const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms)

describe('useAutoUpdater', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('正向用例', () => {
    it('启动 5 秒后以非交互模式检查一次', async () => {
      const { unmount } = renderHook(() => useAutoUpdater())
      await advance(5000)

      expect(mockCheckForUpdates).toHaveBeenCalledTimes(1)
      expect(mockCheckForUpdates).toHaveBeenCalledWith()
      unmount()
    })

    it('挂载后的前 5 秒不占用启动路径', async () => {
      const { unmount } = renderHook(() => useAutoUpdater())
      await advance(4999)

      expect(mockCheckForUpdates).not.toHaveBeenCalled()
      unmount()
    })
  })

  describe('边界用例 — 定时器清理', () => {
    it('5 秒内卸载则不触发检查', async () => {
      const { unmount } = renderHook(() => useAutoUpdater())
      unmount()
      await advance(5000)

      expect(mockCheckForUpdates).not.toHaveBeenCalled()
    })

    it('检查已触发时卸载，不会再排第二次', async () => {
      const { unmount } = renderHook(() => useAutoUpdater())
      await advance(5000)
      unmount()
      await advance(60_000)

      expect(mockCheckForUpdates).toHaveBeenCalledTimes(1)
    })
  })
})
