import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mock @tauri-apps/plugin-updater — check() returns an update descriptor
// ---------------------------------------------------------------------------
const mockCheck = vi.fn()

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: (...args: unknown[]) => mockCheck(...(args as [])),
}))

// ---------------------------------------------------------------------------
// Mock @tauri-apps/plugin-process — relaunch()
// ---------------------------------------------------------------------------
const mockRelaunch = vi.fn()

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: (...args: unknown[]) => mockRelaunch(...(args as [])),
}))

// ---------------------------------------------------------------------------
// Mock @/lib/logger
// ---------------------------------------------------------------------------
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const { useAutoUpdater } = await import('./use-auto-updater')
const { logger } = await import('@/lib/logger')

// 用 fake timers 推进 5 秒延迟检查，并 flush 期间所有微任务。
const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms)

// Build a fake update descriptor whose downloadAndInstall invokes the progress
// callback with Started/Progress/Finished events.
function makeUpdate() {
  return {
    version: '9.9.9',
    downloadAndInstall: (cb: (event: unknown) => void) => {
      cb({ event: 'Started', data: { contentLength: 1024 } })
      cb({ event: 'Progress', data: { chunkLength: 512 } })
      cb({ event: 'Finished' })
      return Promise.resolve()
    },
  }
}

describe('useAutoUpdater', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockCheck.mockResolvedValue(null)
    mockRelaunch.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('正向用例 — 更新可用时下载并重启', () => {
    it('有可用更新时调用 downloadAndInstall 与 relaunch', async () => {
      const update = makeUpdate()
      mockCheck.mockResolvedValue(update)

      const { unmount } = renderHook(() => useAutoUpdater())
      // 触发 5 秒后的延迟检查并 flush 异步链
      await advance(5000)

      expect(mockCheck).toHaveBeenCalledTimes(1)
      // downloadAndInstall 成功后才会继续到 relaunch，以此验证下载分支已被执行
      expect(mockRelaunch).toHaveBeenCalledTimes(1)
      unmount()
    })

    it('下载进度回调记录 Started / Progress / Finished 日志', async () => {
      const update = makeUpdate()
      mockCheck.mockResolvedValue(update)

      const { unmount } = renderHook(() => useAutoUpdater())
      await advance(5000)

      expect(logger.info).toHaveBeenCalledWith('Update download started', {
        contentLength: 1024,
      })
      expect(logger.debug).toHaveBeenCalledWith('Update download progress', {
        chunkLength: 512,
      })
      expect(logger.info).toHaveBeenCalledWith(
        'Update download complete, installing'
      )
      unmount()
    })

    it('更新成功安装后记录 relaunching 与 available 日志', async () => {
      const update = makeUpdate()
      mockCheck.mockResolvedValue(update)

      const { unmount } = renderHook(() => useAutoUpdater())
      await advance(5000)

      expect(logger.info).toHaveBeenCalledWith(
        'Update installed successfully, relaunching'
      )
      expect(logger.info).toHaveBeenCalledWith('Update available', {
        version: '9.9.9',
      })
      unmount()
    })
  })

  describe('边界用例 — 无更新', () => {
    it('check 返回 null 时不下载也不重启', async () => {
      mockCheck.mockResolvedValue(null)

      const { unmount } = renderHook(() => useAutoUpdater())
      await advance(5000)

      expect(mockCheck).toHaveBeenCalledTimes(1)
      expect(mockRelaunch).not.toHaveBeenCalled()
      expect(logger.info).not.toHaveBeenCalledWith(
        'Update available',
        expect.anything()
      )
      unmount()
    })
  })

  describe('异常用例 — 检查或安装失败', () => {
    it('check 抛错时记录 debug 日志且不崩溃', async () => {
      mockCheck.mockRejectedValue(new Error('network unavailable'))

      const { unmount } = renderHook(() => useAutoUpdater())
      await advance(5000)

      expect(logger.debug).toHaveBeenCalledWith(
        'Update check failed (network unavailable?)',
        { error: String(new Error('network unavailable')) }
      )
      expect(mockRelaunch).not.toHaveBeenCalled()
      unmount()
    })

    it('downloadAndInstall 抛错时记录 error 日志', async () => {
      const update = {
        version: '9.9.9',
        downloadAndInstall: () => Promise.reject(new Error('install failed')),
      }
      mockCheck.mockResolvedValue(update)

      const { unmount } = renderHook(() => useAutoUpdater())
      await advance(5000)

      expect(logger.error).toHaveBeenCalledWith('Update installation failed', {
        error: String(new Error('install failed')),
      })
      expect(mockRelaunch).not.toHaveBeenCalled()
      unmount()
    })
  })

  describe('边界用例 — 卸载取消守卫', () => {
    it('卸载后取消定时器，5 秒检查不再触发', async () => {
      mockCheck.mockResolvedValue(null)

      const { unmount } = renderHook(() => useAutoUpdater())
      // 在定时器触发前卸载：cleanup 设置 cancelled 并 clearTimeout
      unmount()
      await advance(5000)

      expect(mockCheck).not.toHaveBeenCalled()
    })
  })

  describe('边界用例 — 异步链进行中卸载的取消守卫', () => {
    it('check 进行中卸载：cancelled 守卫跳过后续逻辑（行 32）', async () => {
      let resolveCheck: (v: unknown) => void = () => undefined
      mockCheck.mockImplementation(() => new Promise(r => (resolveCheck = r)))

      const { unmount } = renderHook(() => useAutoUpdater())
      // 触发 5 秒延迟检查，check 此刻 pending
      await advance(5000)
      // 在 check 解析前卸载，设置 cancelled=true
      unmount()
      resolveCheck(null)
      await advance(0)

      expect(mockRelaunch).not.toHaveBeenCalled()
      expect(logger.info).not.toHaveBeenCalledWith(
        'Update available',
        expect.anything()
      )
    })

    it('downloadAndInstall 完成后卸载：cancelled 守卫跳过 relaunch（行 56）', async () => {
      let resolveDownload: () => void = () => undefined
      const update = {
        version: '9.9.9',
        downloadAndInstall: () => new Promise<void>(r => (resolveDownload = r)),
      }
      mockCheck.mockResolvedValue(update)

      const { unmount } = renderHook(() => useAutoUpdater())
      await advance(5000)
      // downloadAndInstall 此刻 pending，先卸载再让其完成
      unmount()
      resolveDownload()
      await advance(0)

      expect(mockRelaunch).not.toHaveBeenCalled()
      expect(logger.info).not.toHaveBeenCalledWith(
        'Update installed successfully, relaunching'
      )
    })

    it('downloadAndInstall 失败时卸载：cancelled 守卫跳过 error 日志（行 60）', async () => {
      let rejectDownload: (e: Error) => void = () => undefined
      const update = {
        version: '9.9.9',
        downloadAndInstall: () =>
          new Promise<void>((_, rej) => (rejectDownload = rej)),
      }
      mockCheck.mockResolvedValue(update)

      const { unmount } = renderHook(() => useAutoUpdater())
      await advance(5000)
      // downloadAndInstall 此刻 pending，先卸载再使其失败
      unmount()
      rejectDownload(new Error('install failed'))
      await advance(0)

      expect(logger.error).not.toHaveBeenCalled()
    })

    it('check 失败时卸载：cancelled 守卫跳过 debug 日志（行 67）', async () => {
      let rejectCheck: (e: Error) => void = () => undefined
      mockCheck.mockImplementation(
        () => new Promise<void>((_, rej) => (rejectCheck = rej))
      )

      const { unmount } = renderHook(() => useAutoUpdater())
      await advance(5000)
      // check 此刻 pending，先卸载再使其失败
      unmount()
      rejectCheck(new Error('network unavailable'))
      await advance(0)

      expect(logger.debug).not.toHaveBeenCalled()
    })
  })
})
