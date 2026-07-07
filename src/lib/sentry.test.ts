import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock @sentry/react
// ---------------------------------------------------------------------------
const mockSentryInit = vi.fn()
const mockSentryClose = vi.fn().mockResolvedValue(undefined)
const mockSentryCaptureException = vi.fn()
const mockSentryCaptureMessage = vi.fn()
const mockSentrySetUser = vi.fn()

vi.mock('@sentry/react', () => ({
  init: mockSentryInit,
  close: mockSentryClose,
  captureException: mockSentryCaptureException,
  captureMessage: mockSentryCaptureMessage,
  setUser: mockSentrySetUser,
  browserTracingIntegration: vi.fn(),
  replayIntegration: vi.fn(),
  feedbackIntegration: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock tauri-bindings — setConsent is called by setSentryConsent
// ---------------------------------------------------------------------------
const mockSetConsent = vi.fn().mockResolvedValue({ status: 'ok', data: null })
vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    setConsent: (...args: unknown[]) =>
      mockSetConsent(...(args as [boolean | null])),
  },
}))

// ---------------------------------------------------------------------------
// 无 DSN 场景 — VITE_SENTRY_DSN 未设置
// ---------------------------------------------------------------------------
describe('sentry — 未配置 DSN', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv('VITE_SENTRY_DSN', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('正向用例 — isSentryEnabled', () => {
    it('DSN 未设置时 isSentryEnabled 返回 false', async () => {
      const { isSentryEnabled } = await import('./sentry')
      expect(isSentryEnabled()).toBe(false)
    })
  })

  describe('正向用例 — isSentryInitialized', () => {
    it('初始状态 isSentryInitialized 返回 false', async () => {
      const { isSentryInitialized } = await import('./sentry')
      expect(isSentryInitialized()).toBe(false)
    })
  })

  describe('正向用例 — initSentry 不执行初始化', () => {
    it('DSN 未设置时不调用 Sentry.init', async () => {
      const { initSentry } = await import('./sentry')
      initSentry()
      expect(mockSentryInit).not.toHaveBeenCalled()
    })

    it('initSentry 后 isSentryInitialized 仍为 false', async () => {
      const { initSentry, isSentryInitialized } = await import('./sentry')
      initSentry()
      expect(isSentryInitialized()).toBe(false)
    })
  })

  describe('正向用例 — captureException 为空操作', () => {
    it('未初始化时不调用 Sentry.captureException', async () => {
      const { captureException } = await import('./sentry')
      captureException(new Error('test'))
      expect(mockSentryCaptureException).not.toHaveBeenCalled()
    })
  })

  describe('正向用例 — captureMessage 为空操作', () => {
    it('未初始化时不调用 Sentry.captureMessage', async () => {
      const { captureMessage } = await import('./sentry')
      captureMessage('test message')
      expect(mockSentryCaptureMessage).not.toHaveBeenCalled()
    })
  })

  describe('正向用例 — closeSentry 为空操作', async () => {
    it('未初始化时不调用 Sentry.close', async () => {
      const { closeSentry } = await import('./sentry')
      await closeSentry()
      expect(mockSentryClose).not.toHaveBeenCalled()
    })
  })
})

// ---------------------------------------------------------------------------
// 有 DSN 场景 — VITE_SENTRY_DSN 已设置
// ---------------------------------------------------------------------------
describe('sentry — 已配置 DSN', () => {
  const TEST_DSN = 'https://example.com@sentry.io/123'

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    localStorage.clear()
    vi.stubEnv('VITE_SENTRY_DSN', TEST_DSN)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('正向用例 — isSentryEnabled', () => {
    it('DSN 已设置时 isSentryEnabled 返回 true', async () => {
      const { isSentryEnabled } = await import('./sentry')
      expect(isSentryEnabled()).toBe(true)
    })
  })

  describe('正向用例 — initSentry', () => {
    it('调用 Sentry.init 并传入正确的 DSN', async () => {
      const { initSentry } = await import('./sentry')
      initSentry()
      expect(mockSentryInit).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: TEST_DSN,
        })
      )
    })

    it('开发模式下 environment 设为 development', async () => {
      const { initSentry } = await import('./sentry')
      initSentry()
      expect(mockSentryInit).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: 'development',
        })
      )
    })

    it('tracesSampleRate 设为 1.0（自托管无配额限制）', async () => {
      const { initSentry } = await import('./sentry')
      initSentry()
      expect(mockSentryInit).toHaveBeenCalledWith(
        expect.objectContaining({
          tracesSampleRate: 1.0,
        })
      )
    })

    it('replaysSessionSampleRate 设为 0', async () => {
      const { initSentry } = await import('./sentry')
      initSentry()
      expect(mockSentryInit).toHaveBeenCalledWith(
        expect.objectContaining({
          replaysSessionSampleRate: 0,
        })
      )
    })

    it('replaysOnErrorSampleRate 设为 1.0（全量捕获错误回放）', async () => {
      const { initSentry } = await import('./sentry')
      initSentry()
      expect(mockSentryInit).toHaveBeenCalledWith(
        expect.objectContaining({
          replaysOnErrorSampleRate: 1.0,
        })
      )
    })

    it('enableLogs 设为 true', async () => {
      const { initSentry } = await import('./sentry')
      initSentry()
      expect(mockSentryInit).toHaveBeenCalledWith(
        expect.objectContaining({
          enableLogs: true,
        })
      )
    })

    it('配置了 beforeSend consent gate 函数', async () => {
      const { initSentry } = await import('./sentry')
      initSentry()
      expect(mockSentryInit).toHaveBeenCalledWith(
        expect.objectContaining({
          beforeSend: expect.any(Function),
        })
      )
    })

    it('初始化后 isSentryInitialized 返回 true', async () => {
      const { initSentry, isSentryInitialized } = await import('./sentry')
      initSentry()
      expect(isSentryInitialized()).toBe(true)
    })
  })

  describe('正向用例 — setSentryConsent / beforeSend consent gate', () => {
    it('默认 consent 为 null — beforeSend 返回 null（事件被丢弃）', async () => {
      const { initSentry } = await import('./sentry')
      initSentry()

      // 获取 beforeSend 函数
      const initCall = mockSentryInit.mock.calls[0]?.[0] as {
        beforeSend: (event: unknown) => unknown
      }
      const fakeEvent = { message: 'test event' }

      // 默认 consent 为 null → 事件被丢弃
      expect(initCall.beforeSend(fakeEvent)).toBeNull()
    })

    it('setSentryConsent(true) 后 beforeSend 返回事件（允许发送）', async () => {
      const { initSentry, setSentryConsent } = await import('./sentry')
      initSentry()
      setSentryConsent(true)

      const initCall = mockSentryInit.mock.calls[0]?.[0] as {
        beforeSend: (event: unknown) => unknown
      }
      const fakeEvent = { message: 'test event' }

      expect(initCall.beforeSend(fakeEvent)).toEqual(fakeEvent)
    })

    it('setSentryConsent(false) 后 beforeSend 返回 null（拒绝发送）', async () => {
      const { initSentry, setSentryConsent } = await import('./sentry')
      initSentry()
      setSentryConsent(false)

      const initCall = mockSentryInit.mock.calls[0]?.[0] as {
        beforeSend: (event: unknown) => unknown
      }
      const fakeEvent = { message: 'test event' }

      expect(initCall.beforeSend(fakeEvent)).toBeNull()
    })

    it('setSentryConsent(null) 重置为未询问状态', async () => {
      const { initSentry, setSentryConsent } = await import('./sentry')
      initSentry()

      // 先同意
      setSentryConsent(true)
      const initCall = mockSentryInit.mock.calls[0]?.[0] as {
        beforeSend: (event: unknown) => unknown
      }
      expect(initCall.beforeSend({ message: 'a' })).toEqual({ message: 'a' })

      // 重置为 null
      setSentryConsent(null)
      expect(initCall.beforeSend({ message: 'b' })).toBeNull()
    })

    it('consent 状态可以在 true → false → true 之间切换', async () => {
      const { initSentry, setSentryConsent } = await import('./sentry')
      initSentry()
      const initCall = mockSentryInit.mock.calls[0]?.[0] as {
        beforeSend: (event: unknown) => unknown
      }
      const event = { message: 'test' }

      setSentryConsent(true)
      expect(initCall.beforeSend(event)).toEqual(event)

      setSentryConsent(false)
      expect(initCall.beforeSend(event)).toBeNull()

      setSentryConsent(true)
      expect(initCall.beforeSend(event)).toEqual(event)
    })
  })

  describe('正向用例 — setSentryConsent 同步到 Rust 端', () => {
    it('setSentryConsent(true) 调用 commands.setConsent(true)', async () => {
      const { initSentry, setSentryConsent } = await import('./sentry')
      initSentry()
      setSentryConsent(true)
      expect(mockSetConsent).toHaveBeenCalledWith(true)
    })

    it('setSentryConsent(false) 调用 commands.setConsent(false)', async () => {
      const { initSentry, setSentryConsent } = await import('./sentry')
      initSentry()
      setSentryConsent(false)
      expect(mockSetConsent).toHaveBeenCalledWith(false)
    })

    it('setSentryConsent(null) 调用 commands.setConsent(null)', async () => {
      const { initSentry, setSentryConsent } = await import('./sentry')
      initSentry()
      setSentryConsent(null)
      expect(mockSetConsent).toHaveBeenCalledWith(null)
    })
  })

  describe('正向用例 — setSentryConsent 设置匿名用户', () => {
    it('setSentryConsent(true) 调用 Sentry.setUser 并设置 id', async () => {
      const { initSentry, setSentryConsent } = await import('./sentry')
      initSentry()
      setSentryConsent(true)
      expect(mockSentrySetUser).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          ip_address: '{{auto}}',
        })
      )
    })

    it('setSentryConsent(true) 持久化匿名 ID 到 localStorage', async () => {
      const { initSentry, setSentryConsent } = await import('./sentry')
      initSentry()
      setSentryConsent(true)
      const storedId = localStorage.getItem('sentry_anon_user_id')
      expect(storedId).toBeTruthy()
      // Subsequent calls reuse the same ID
      mockSentrySetUser.mockClear()
      setSentryConsent(true)
      expect(mockSentrySetUser).toHaveBeenCalledWith(
        expect.objectContaining({ id: storedId })
      )
    })

    it('setSentryConsent(false) 调用 Sentry.setUser(null) 清除用户', async () => {
      const { initSentry, setSentryConsent } = await import('./sentry')
      initSentry()
      setSentryConsent(false)
      expect(mockSentrySetUser).toHaveBeenCalledWith(null)
    })

    it('setSentryConsent(null) 调用 Sentry.setUser(null)', async () => {
      const { initSentry, setSentryConsent } = await import('./sentry')
      initSentry()
      setSentryConsent(null)
      expect(mockSentrySetUser).toHaveBeenCalledWith(null)
    })
  })

  describe('边界用例 — setSentryConsent 未初始化时 setUser 为空操作', () => {
    it('未初始化时 setSentryConsent(true) 不调用 setUser', async () => {
      // No DSN → not initialized
      vi.stubEnv('VITE_SENTRY_DSN', '')
      const { setSentryConsent } = await import('./sentry')
      setSentryConsent(true)
      expect(mockSentrySetUser).not.toHaveBeenCalled()
      vi.unstubAllEnvs()
    })
  })

  describe('边界用例 — 重复初始化', () => {
    it('已初始化时再次调用 initSentry 不重复执行', async () => {
      const { initSentry } = await import('./sentry')
      initSentry()
      initSentry()
      expect(mockSentryInit).toHaveBeenCalledTimes(1)
    })
  })

  describe('正向用例 — closeSentry', () => {
    it('初始化后调用 closeSentry 调用 Sentry.close', async () => {
      const { initSentry, closeSentry } = await import('./sentry')
      initSentry()
      await closeSentry()
      expect(mockSentryClose).toHaveBeenCalledTimes(1)
    })

    it('closeSentry 后 isSentryInitialized 返回 false', async () => {
      const { initSentry, closeSentry, isSentryInitialized } =
        await import('./sentry')
      initSentry()
      await closeSentry()
      expect(isSentryInitialized()).toBe(false)
    })
  })

  describe('边界用例 — 未初始化时 closeSentry', () => {
    it('未初始化时 closeSentry 不调用 Sentry.close', async () => {
      const { closeSentry } = await import('./sentry')
      await closeSentry()
      expect(mockSentryClose).not.toHaveBeenCalled()
    })
  })

  describe('正向用例 — captureException', () => {
    it('初始化后调用 Sentry.captureException', async () => {
      const { initSentry, captureException } = await import('./sentry')
      const error = new Error('test error')
      initSentry()
      captureException(error)
      expect(mockSentryCaptureException).toHaveBeenCalledWith(error)
    })

    it('可捕获 unknown 类型的错误', async () => {
      const { initSentry, captureException } = await import('./sentry')
      initSentry()
      captureException('string error')
      expect(mockSentryCaptureException).toHaveBeenCalledWith('string error')
    })

    it('可捕获对象类型的错误', async () => {
      const { initSentry, captureException } = await import('./sentry')
      initSentry()
      captureException({ code: 500, message: 'server error' })
      expect(mockSentryCaptureException).toHaveBeenCalledWith({
        code: 500,
        message: 'server error',
      })
    })
  })

  describe('正向用例 — captureMessage', () => {
    it('初始化后调用 Sentry.captureMessage', async () => {
      const { initSentry, captureMessage } = await import('./sentry')
      initSentry()
      captureMessage('test message')
      expect(mockSentryCaptureMessage).toHaveBeenCalledWith(
        'test message',
        undefined
      )
    })

    it('支持 fatal 级别', async () => {
      const { initSentry, captureMessage } = await import('./sentry')
      initSentry()
      captureMessage('fatal error', 'fatal')
      expect(mockSentryCaptureMessage).toHaveBeenCalledWith(
        'fatal error',
        'fatal'
      )
    })

    it('支持 error 级别', async () => {
      const { initSentry, captureMessage } = await import('./sentry')
      initSentry()
      captureMessage('error msg', 'error')
      expect(mockSentryCaptureMessage).toHaveBeenCalledWith(
        'error msg',
        'error'
      )
    })

    it('支持 warning 级别', async () => {
      const { initSentry, captureMessage } = await import('./sentry')
      initSentry()
      captureMessage('warning msg', 'warning')
      expect(mockSentryCaptureMessage).toHaveBeenCalledWith(
        'warning msg',
        'warning'
      )
    })

    it('支持 info 级别', async () => {
      const { initSentry, captureMessage } = await import('./sentry')
      initSentry()
      captureMessage('info msg', 'info')
      expect(mockSentryCaptureMessage).toHaveBeenCalledWith('info msg', 'info')
    })

    it('支持 debug 级别', async () => {
      const { initSentry, captureMessage } = await import('./sentry')
      initSentry()
      captureMessage('debug msg', 'debug')
      expect(mockSentryCaptureMessage).toHaveBeenCalledWith(
        'debug msg',
        'debug'
      )
    })
  })

  describe('边界用例 — close 后 capture 为空操作', () => {
    it('closeSentry 后 captureException 不执行', async () => {
      const { initSentry, closeSentry, captureException } =
        await import('./sentry')
      initSentry()
      await closeSentry()
      captureException(new Error('after close'))
      expect(mockSentryCaptureException).not.toHaveBeenCalled()
    })

    it('closeSentry 后 captureMessage 不执行', async () => {
      const { initSentry, closeSentry, captureMessage } =
        await import('./sentry')
      initSentry()
      await closeSentry()
      captureMessage('after close')
      expect(mockSentryCaptureMessage).not.toHaveBeenCalled()
    })
  })
})

// ---------------------------------------------------------------------------
// 生产模式场景 — DEV = false
// ---------------------------------------------------------------------------
describe('sentry — 生产模式 (DEV=false)', () => {
  const TEST_DSN = 'https://example.com@sentry.io/456'

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv('VITE_SENTRY_DSN', TEST_DSN)
    vi.stubEnv('DEV', false)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('正向用例 — 生产环境配置', () => {
    it('生产模式下 environment 设为 production', async () => {
      const { initSentry } = await import('./sentry')
      initSentry()
      expect(mockSentryInit).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: 'production',
        })
      )
    })
  })
})
