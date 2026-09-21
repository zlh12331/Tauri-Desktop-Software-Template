import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock the updater + process plugins
// ---------------------------------------------------------------------------
const mockCheck = vi.fn()
const mockRelaunch = vi.fn()
const mockDownloadAndInstall = vi.fn()

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: (...args: unknown[]) => mockCheck(...(args as [])),
}))

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: (...args: unknown[]) => mockRelaunch(...(args as [])),
}))

// ---------------------------------------------------------------------------
// Mock sonner — assert which toast each branch raises
// ---------------------------------------------------------------------------
const mockToast = {
  info: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  loading: vi.fn(() => 'loading-toast-id'),
  dismiss: vi.fn(),
}

vi.mock('sonner', () => ({ toast: mockToast }))

// ---------------------------------------------------------------------------
// Mock i18n (t returns the key) and the logger
// ---------------------------------------------------------------------------
vi.mock('@/i18n/config', () => ({
  default: {
    t: (key: string, options?: Record<string, unknown>) =>
      JSON.stringify({ key, options }),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Stub __APP_VERSION__ (normally provided by Vite define)
vi.stubGlobal('__APP_VERSION__', '0.1.0')

const { checkForUpdates, installPendingUpdate, resetUpdater } =
  await import('@/lib/updater')
const { logger } = await import('@/lib/logger')

type ToastInfoArgs = Parameters<(typeof mockToast)['info']>

/** Latest call arguments of a mock, or undefined when it was never called. */
function lastCall(mock: {
  mock: { calls: unknown[][] }
}): unknown[] | undefined {
  return mock.mock.calls[mock.mock.calls.length - 1]
}

function lastAvailableToast(): ToastInfoArgs[1] {
  return lastCall(mockToast.info)?.[1]
}

function makeUpdate(overrides: Record<string, unknown> = {}) {
  return {
    version: '9.9.9',
    body: 'Release notes',
    downloadAndInstall: mockDownloadAndInstall,
    ...overrides,
  }
}

/** Press a toast button. Throws instead of passing vacuously on a missing button. */
function press(options: unknown, key: 'action' | 'cancel'): () => void {
  const buttons = options as
    | { action?: { onClick?: () => void }; cancel?: { onClick?: () => void } }
    | undefined
  const onClick = buttons?.[key]?.onClick
  if (!onClick) throw new Error(`toast is missing its "${key}" button`)
  return onClick
}

describe('updater', () => {
  beforeEach(() => {
    // resetUpdater() itself dismisses a toast, so clear the records afterwards —
    // otherwise "the Later button dismisses" would pass off that setup call.
    resetUpdater()
    vi.clearAllMocks()
    mockCheck.mockResolvedValue(null)
    mockDownloadAndInstall.mockResolvedValue(undefined)
    mockRelaunch.mockResolvedValue(undefined)
  })

  afterEach(() => {
    resetUpdater()
  })

  describe('正向用例 — 没有可用更新', () => {
    it('静默检查不打扰用户', async () => {
      await expect(checkForUpdates()).resolves.toBe('up-to-date')
      expect(mockToast.success).not.toHaveBeenCalled()
      expect(mockToast.info).not.toHaveBeenCalled()
    })

    it('用户主动检查时报告当前版本', async () => {
      await expect(checkForUpdates({ interactive: true })).resolves.toBe(
        'up-to-date'
      )
      expect(mockToast.success).toHaveBeenCalledWith(
        expect.stringContaining('updater.upToDate')
      )
      // the running version is what "up to date" refers to
      expect(lastCall(mockToast.success)?.[0]).toContain('"0.1.0"')
    })
  })

  describe('正向用例 — 有更新时只征求同意，绝不自作主张', () => {
    it('弹出带安装与稍后按钮的常驻提示', async () => {
      mockCheck.mockResolvedValue(makeUpdate())

      await expect(checkForUpdates({ interactive: true })).resolves.toBe(
        'available'
      )

      expect(mockToast.info).toHaveBeenCalledWith(
        expect.stringContaining('updater.available'),
        expect.objectContaining({
          id: 'update-available',
          duration: 0,
          description: 'Release notes',
        })
      )
      expect(logger.info).toHaveBeenCalledWith('Update available', {
        version: '9.9.9',
      })
      expect(mockDownloadAndInstall).not.toHaveBeenCalled()
      expect(mockRelaunch).not.toHaveBeenCalled()
    })

    it('清单没有写发布说明时不编造描述', async () => {
      mockCheck.mockResolvedValue(makeUpdate({ body: '   ' }))
      await checkForUpdates()
      expect(lastAvailableToast()?.description).toBeUndefined()
    })

    it('重复检查同一版本只留一条提示，不叠加', async () => {
      mockCheck.mockResolvedValue(makeUpdate())
      await checkForUpdates()
      await checkForUpdates({ interactive: true })

      expect(mockToast.info).toHaveBeenCalledTimes(2)
      expect(
        mockToast.info.mock.calls.map(([, options]) => options?.id)
      ).toEqual(['update-available', 'update-available'])
    })

    it('"稍后"只关掉提示，不安装', async () => {
      mockCheck.mockResolvedValue(makeUpdate())
      await checkForUpdates()

      press(lastAvailableToast(), 'cancel')()

      expect(mockToast.dismiss).toHaveBeenCalledTimes(1)
      expect(mockToast.dismiss).toHaveBeenCalledWith('update-available')
      expect(mockDownloadAndInstall).not.toHaveBeenCalled()
    })

    it('"安装更新"才走下载与安装', async () => {
      mockCheck.mockResolvedValue(makeUpdate())
      await checkForUpdates()

      press(lastAvailableToast(), 'action')()

      expect(mockDownloadAndInstall).toHaveBeenCalledTimes(1)
    })
  })

  describe('正向用例 — 安装完成后等待用户重启', () => {
    it('先 loading 再 success，并记录待重启日志', async () => {
      mockCheck.mockResolvedValue(makeUpdate())
      await checkForUpdates()

      await expect(installPendingUpdate()).resolves.toBe(true)

      expect(mockToast.loading).toHaveBeenCalledWith(
        expect.stringContaining('updater.installing')
      )
      expect(mockToast.success).toHaveBeenCalledWith(
        expect.stringContaining('updater.installed'),
        expect.objectContaining({ id: 'loading-toast-id', duration: 0 })
      )
      expect(logger.info).toHaveBeenCalledWith(
        'Update installed successfully, awaiting restart',
        { version: '9.9.9' }
      )
    })

    it('重启只在用户点击后发生', async () => {
      mockCheck.mockResolvedValue(makeUpdate())
      await checkForUpdates()
      await installPendingUpdate()

      expect(mockRelaunch).not.toHaveBeenCalled()

      const successOptions = lastCall(mockToast.success)?.[1]
      press(successOptions, 'action')()

      expect(mockRelaunch).toHaveBeenCalledTimes(1)
    })

    it('下载进度事件写入日志', async () => {
      mockDownloadAndInstall.mockImplementation(
        (cb: (event: unknown) => void) => {
          cb({ event: 'Started', data: { contentLength: 1024 } })
          cb({ event: 'Progress', data: { chunkLength: 512 } })
          cb({ event: 'Finished' })
          return Promise.resolve()
        }
      )
      mockCheck.mockResolvedValue(makeUpdate())
      await checkForUpdates()
      await installPendingUpdate()

      expect(logger.info).toHaveBeenCalledWith('Update download started', {
        contentLength: 1024,
      })
      expect(logger.debug).toHaveBeenCalledWith('Update download progress', {
        chunkLength: 512,
      })
      expect(logger.info).toHaveBeenCalledWith(
        'Update download complete, installing'
      )
    })

    it('安装成功后清空待装更新，第二次调用不再重复安装', async () => {
      mockCheck.mockResolvedValue(makeUpdate())
      await checkForUpdates()
      await installPendingUpdate()

      await expect(installPendingUpdate()).resolves.toBe(false)
      expect(mockDownloadAndInstall).toHaveBeenCalledTimes(1)
    })
  })

  describe('边界用例 — 没有可用更新时不安装', () => {
    it('未检查过就直接安装时返回 false', async () => {
      await expect(installPendingUpdate()).resolves.toBe(false)
      expect(mockDownloadAndInstall).not.toHaveBeenCalled()
      expect(mockToast.loading).not.toHaveBeenCalled()
    })

    it('下载进行中时忽略重复触发', async () => {
      let finishDownload: () => void = () => undefined
      mockDownloadAndInstall.mockImplementation(
        () => new Promise<void>(resolve => (finishDownload = resolve))
      )
      mockCheck.mockResolvedValue(makeUpdate())
      await checkForUpdates()

      const first = installPendingUpdate()
      await expect(installPendingUpdate()).resolves.toBe(false)
      finishDownload()
      await first

      expect(mockDownloadAndInstall).toHaveBeenCalledTimes(1)
    })
  })

  describe('异常用例 — 检查或安装失败', () => {
    it('静默检查遇网络失败只留 debug 日志', async () => {
      mockCheck.mockRejectedValue(new Error('network unavailable'))

      await expect(checkForUpdates()).resolves.toBe('failed')

      expect(logger.debug).toHaveBeenCalledWith(
        'Update check failed (network unavailable?)',
        { error: 'Error: network unavailable' }
      )
      expect(logger.error).not.toHaveBeenCalled()
      expect(mockToast.error).not.toHaveBeenCalled()
    })

    it('用户主动检查失败时明确告知', async () => {
      mockCheck.mockRejectedValue(new Error('endpoint 500'))

      await expect(checkForUpdates({ interactive: true })).resolves.toBe(
        'failed'
      )

      expect(logger.error).toHaveBeenCalledWith('Update check failed', {
        error: 'Error: endpoint 500',
      })
      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringContaining('updater.checkFailed')
      )
    })

    it('签名或磁盘错误报告失败并保留更新以便重试', async () => {
      mockDownloadAndInstall.mockRejectedValue(new Error('invalid signature'))
      mockCheck.mockResolvedValue(makeUpdate())
      await checkForUpdates()

      await expect(installPendingUpdate()).resolves.toBe(false)

      expect(logger.error).toHaveBeenCalledWith('Update installation failed', {
        error: 'Error: invalid signature',
      })
      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringContaining('updater.installFailed'),
        expect.objectContaining({ description: 'Error: invalid signature' })
      )
      expect(mockRelaunch).not.toHaveBeenCalled()

      mockDownloadAndInstall.mockResolvedValue(undefined)
      await expect(installPendingUpdate()).resolves.toBe(true)
    })
  })
})
