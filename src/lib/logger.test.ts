import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Console spies — set up before importing the logger module so every
// console.debug / info / warn / error call is captured and suppressed.
// ---------------------------------------------------------------------------
const consoleDebugSpy = vi
  .spyOn(console, 'debug')
  .mockImplementation(() => undefined)
const consoleInfoSpy = vi
  .spyOn(console, 'info')
  .mockImplementation(() => undefined)
const consoleWarnSpy = vi
  .spyOn(console, 'warn')
  .mockImplementation(() => undefined)
const consoleErrorSpy = vi
  .spyOn(console, 'error')
  .mockImplementation(() => undefined)

// ---------------------------------------------------------------------------
// Sentry.logger spies — production-mode logs are routed to Sentry Logs.
// Mock @sentry/react so no real SDK is loaded during tests. The `mock*`
// prefix lets vitest hoist these references inside the vi.mock factory.
// ---------------------------------------------------------------------------
const mockSentryLoggerTrace = vi.fn()
const mockSentryLoggerDebug = vi.fn()
const mockSentryLoggerInfo = vi.fn()
const mockSentryLoggerWarn = vi.fn()
const mockSentryLoggerError = vi.fn()

vi.mock('@sentry/react', () => ({
  logger: {
    trace: mockSentryLoggerTrace,
    debug: mockSentryLoggerDebug,
    info: mockSentryLoggerInfo,
    warn: mockSentryLoggerWarn,
    error: mockSentryLoggerError,
  },
}))

// Import the logger singleton and destructured convenience functions.
const { logger, trace, debug, info, warn, error } = await import('./logger')

/**
 * Regex matching the log prefix produced by `logToConsole`:
 * `[ISO-8601 timestamp] [LEVEL]`  e.g. `[2024-01-15T10:30:00.000Z] [INFO]`
 */
const prefixRegex = (level: string): RegExp =>
  new RegExp(
    `^\\[\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z\\] \\[${level}\\]$`
  )

// ---------------------------------------------------------------------------
// Development mode (import.meta.env.DEV === true — Vitest default)
// ---------------------------------------------------------------------------
describe('Logger — 开发模式', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // 正向用例 — 各级别日志调用正确的 console 方法
  // =========================================================================
  describe('正向用例 — 各级别日志调用正确的 console 方法', () => {
    it('trace 调用 console.debug 并包含 TRACE 标签', () => {
      logger.trace('trace message')
      expect(consoleDebugSpy).toHaveBeenCalledTimes(1)
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('TRACE')),
        'trace message'
      )
    })

    it('debug 调用 console.debug 并包含 DEBUG 标签', () => {
      logger.debug('debug message')
      expect(consoleDebugSpy).toHaveBeenCalledTimes(1)
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('DEBUG')),
        'debug message'
      )
    })

    it('info 调用 console.info 并包含 INFO 标签', () => {
      logger.info('info message')
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1)
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('INFO')),
        'info message'
      )
    })

    it('warn 调用 console.warn 并包含 WARN 标签', () => {
      logger.warn('warn message')
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('WARN')),
        'warn message'
      )
    })

    it('error 调用 console.error 并包含 ERROR 标签', () => {
      logger.error('error message')
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('ERROR')),
        'error message'
      )
    })
  })

  // =========================================================================
  // 正向用例 — context 上下文对象传递
  // =========================================================================
  describe('正向用例 — context 上下文对象传递', () => {
    it('trace 带 context 作为第三个参数传递', () => {
      const ctx = { userId: 123, action: 'click' }
      logger.trace('user action', ctx)
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('TRACE')),
        'user action',
        ctx
      )
    })

    it('debug 带 context 作为第三个参数传递', () => {
      const ctx = { step: 2, total: 10 }
      logger.debug('progress', ctx)
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('DEBUG')),
        'progress',
        ctx
      )
    })

    it('info 带 context 作为第三个参数传递', () => {
      const ctx = { module: 'auth', duration: 42 }
      logger.info('login success', ctx)
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('INFO')),
        'login success',
        ctx
      )
    })

    it('warn 带 context 作为第三个参数传递', () => {
      const ctx = { threshold: 0.9, current: 0.92 }
      logger.warn('memory high', ctx)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('WARN')),
        'memory high',
        ctx
      )
    })

    it('error 带 context 作为第三个参数传递', () => {
      const ctx = { code: 500, stack: 'Error: Internal Server Error' }
      logger.error('server error', ctx)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('ERROR')),
        'server error',
        ctx
      )
    })

    it('所有级别均支持 context 传递', () => {
      const ctx = { request: 'abc' }
      logger.trace('t', ctx)
      logger.debug('d', ctx)
      logger.info('i', ctx)
      logger.warn('w', ctx)
      logger.error('e', ctx)

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('TRACE')),
        't',
        ctx
      )
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('DEBUG')),
        'd',
        ctx
      )
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('INFO')),
        'i',
        ctx
      )
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('WARN')),
        'w',
        ctx
      )
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('ERROR')),
        'e',
        ctx
      )
    })
  })

  // =========================================================================
  // 正向用例 — 导出的便捷函数
  //
  // The source destructures methods off the singleton: `const { trace } = logger`.
  // These are unbound method references — calling them directly loses `this`,
  // so we invoke them via `.call(logger, ...)` to preserve context.
  // =========================================================================
  describe('正向用例 — 导出的便捷函数与 logger 方法行为一致', () => {
    it('导出的 trace 与 logger.trace 是同一函数引用', () => {
      expect(trace).toBe(logger.trace)
    })

    it('导出的 debug 与 logger.debug 是同一函数引用', () => {
      expect(debug).toBe(logger.debug)
    })

    it('导出的 info 与 logger.info 是同一函数引用', () => {
      expect(info).toBe(logger.info)
    })

    it('导出的 warn 与 logger.warn 是同一函数引用', () => {
      expect(warn).toBe(logger.warn)
    })

    it('导出的 error 与 logger.error 是同一函数引用', () => {
      expect(error).toBe(logger.error)
    })

    it('trace 函数绑定 logger 后调用 console.debug', () => {
      trace.call(logger, 'trace fn')
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('TRACE')),
        'trace fn'
      )
    })

    it('debug 函数绑定 logger 后调用 console.debug', () => {
      debug.call(logger, 'debug fn')
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('DEBUG')),
        'debug fn'
      )
    })

    it('info 函数绑定 logger 后调用 console.info', () => {
      info.call(logger, 'info fn')
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('INFO')),
        'info fn'
      )
    })

    it('warn 函数绑定 logger 后调用 console.warn', () => {
      warn.call(logger, 'warn fn')
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('WARN')),
        'warn fn'
      )
    })

    it('error 函数绑定 logger 后调用 console.error', () => {
      error.call(logger, 'error fn')
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('ERROR')),
        'error fn'
      )
    })

    it('便捷函数绑定 logger 后可以接收 context', () => {
      const ctx = { source: 'convenience' }
      info.call(logger, 'fn with ctx', ctx)
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('INFO')),
        'fn with ctx',
        ctx
      )
    })
  })

  // =========================================================================
  // 边界用例 — 空输入、默认值、极端值
  // =========================================================================
  describe('边界用例 — 空输入与默认值', () => {
    it('空字符串消息', () => {
      logger.info('')
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('INFO')),
        ''
      )
    })

    it('不带 context 时仅传递两个参数 (prefix, message)', () => {
      logger.info('no context')
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1)
      const call = consoleInfoSpy.mock.calls[0]
      expect(call).toBeDefined()
      expect(call).toHaveLength(2)
    })

    it('空对象 context 被作为第三个参数传递 (空对象为 truthy)', () => {
      logger.info('empty ctx', {})
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('INFO')),
        'empty ctx',
        {}
      )
    })

    it('超长消息 (10000 字符)', () => {
      const longMsg = 'x'.repeat(10000)
      logger.warn(longMsg)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('WARN')),
        longMsg
      )
    })

    it('包含特殊字符的消息 (换行、制表符、引号、反斜杠)', () => {
      const specialMsg = 'line1\nline2\t"quoted" \\backslash'
      logger.error(specialMsg)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('ERROR')),
        specialMsg
      )
    })

    it('context 包含嵌套对象、数组、null 和 boolean', () => {
      const ctx = {
        nested: { deep: { value: 42 } },
        list: [1, 2, 3],
        flag: true,
        nil: null,
      }
      logger.info('complex ctx', ctx)
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringMatching(prefixRegex('INFO')),
        'complex ctx',
        ctx
      )
    })

    it('所有级别同时调用各自对应的 console 方法', () => {
      logger.trace('t')
      logger.debug('d')
      logger.info('i')
      logger.warn('w')
      logger.error('e')

      // trace + debug 都调用 console.debug
      expect(consoleDebugSpy).toHaveBeenCalledTimes(2)
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1)
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    })
  })

  // =========================================================================
  // 边界用例 — prefix 时间戳格式
  // =========================================================================
  describe('边界用例 — prefix 时间戳格式', () => {
    it('prefix 包含有效的 ISO-8601 时间戳', () => {
      logger.info('check ts')
      const callArgs = consoleInfoSpy.mock.calls[0]
      expect(callArgs).toBeDefined()
      const prefix = callArgs?.[0] as string
      const match = prefix.match(/^\[([^\]]+)\]/)
      expect(match).not.toBeNull()
      const timestamp = match?.[1]
      expect(timestamp).toBeDefined()
      const parsed = new Date(timestamp as string)
      expect(parsed.getTime()).not.toBeNaN()
    })

    it('不同级别日志的 prefix 包含正确的大写标签', () => {
      logger.trace('t')
      logger.debug('d')
      logger.info('i')
      logger.warn('w')
      logger.error('e')

      expect(consoleDebugSpy.mock.calls[0]?.[0]).toMatch(prefixRegex('TRACE'))
      expect(consoleDebugSpy.mock.calls[1]?.[0]).toMatch(prefixRegex('DEBUG'))
      expect(consoleInfoSpy.mock.calls[0]?.[0]).toMatch(prefixRegex('INFO'))
      expect(consoleWarnSpy.mock.calls[0]?.[0]).toMatch(prefixRegex('WARN'))
      expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(prefixRegex('ERROR'))
    })
  })

  // =========================================================================
  // 正向用例 — 开发模式不路由到 Sentry Logs
  //
  // 在开发环境下 logger 仅输出到 console，不应调用 Sentry.logger，避免
  // 本地调试产生无意义的远程日志噪声。
  // =========================================================================
  describe('正向用例 — 开发模式不路由到 Sentry Logs', () => {
    it('所有级别日志均不调用 Sentry.logger', () => {
      logger.trace('trace msg')
      logger.debug('debug msg')
      logger.info('info msg')
      logger.warn('warn msg')
      logger.error('error msg')

      expect(mockSentryLoggerTrace).not.toHaveBeenCalled()
      expect(mockSentryLoggerDebug).not.toHaveBeenCalled()
      expect(mockSentryLoggerInfo).not.toHaveBeenCalled()
      expect(mockSentryLoggerWarn).not.toHaveBeenCalled()
      expect(mockSentryLoggerError).not.toHaveBeenCalled()
    })

    it('带 context 的日志也不路由到 Sentry', () => {
      logger.info('with ctx', { userId: 1 })
      expect(mockSentryLoggerInfo).not.toHaveBeenCalled()
    })
  })
})

// ---------------------------------------------------------------------------
// Production mode (import.meta.env.DEV === false)
// In production, the logger must NOT write to the browser console.
// ---------------------------------------------------------------------------
describe('Logger — 生产模式 (import.meta.env.DEV = false)', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.stubEnv('DEV', false)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('生产模式下 trace 不输出到 console', async () => {
    const { logger: prodLogger } = await import('./logger')
    prodLogger.trace('should not log')
    expect(consoleDebugSpy).not.toHaveBeenCalled()
  })

  it('生产模式下 debug 不输出到 console', async () => {
    const { logger: prodLogger } = await import('./logger')
    prodLogger.debug('should not log')
    expect(consoleDebugSpy).not.toHaveBeenCalled()
  })

  it('生产模式下 info 不输出到 console', async () => {
    const { logger: prodLogger } = await import('./logger')
    prodLogger.info('should not log')
    expect(consoleInfoSpy).not.toHaveBeenCalled()
  })

  it('生产模式下 warn 不输出到 console', async () => {
    const { logger: prodLogger } = await import('./logger')
    prodLogger.warn('should not log')
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('生产模式下 error 不输出到 console', async () => {
    const { logger: prodLogger } = await import('./logger')
    prodLogger.error('should not log')
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('生产模式下所有级别同时调用均不输出', async () => {
    const { logger: prodLogger } = await import('./logger')
    prodLogger.trace('trace')
    prodLogger.debug('debug')
    prodLogger.info('info')
    prodLogger.warn('warn')
    prodLogger.error('error')

    expect(consoleDebugSpy).not.toHaveBeenCalled()
    expect(consoleInfoSpy).not.toHaveBeenCalled()
    expect(consoleWarnSpy).not.toHaveBeenCalled()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('生产模式下带 context 的日志也不输出', async () => {
    const { logger: prodLogger } = await import('./logger')
    prodLogger.error('error with ctx', { code: 500 })
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  // =========================================================================
  // 正向用例 — 生产模式路由到 Sentry Logs
  //
  // 在生产环境下 logger 将日志转发到 Sentry.logger（结构化日志聚合），
  // 每个级别对应同名的 Sentry.logger 方法。
  // =========================================================================
  describe('正向用例 — 各级别路由到正确的 Sentry.logger 方法', () => {
    it('trace 路由到 Sentry.logger.trace', async () => {
      const { logger: prodLogger } = await import('./logger')
      prodLogger.trace('trace msg')
      expect(mockSentryLoggerTrace).toHaveBeenCalledTimes(1)
      expect(mockSentryLoggerTrace).toHaveBeenCalledWith('trace msg', {})
    })

    it('debug 路由到 Sentry.logger.debug', async () => {
      const { logger: prodLogger } = await import('./logger')
      prodLogger.debug('debug msg')
      expect(mockSentryLoggerDebug).toHaveBeenCalledTimes(1)
      expect(mockSentryLoggerDebug).toHaveBeenCalledWith('debug msg', {})
    })

    it('info 路由到 Sentry.logger.info', async () => {
      const { logger: prodLogger } = await import('./logger')
      prodLogger.info('info msg')
      expect(mockSentryLoggerInfo).toHaveBeenCalledTimes(1)
      expect(mockSentryLoggerInfo).toHaveBeenCalledWith('info msg', {})
    })

    it('warn 路由到 Sentry.logger.warn', async () => {
      const { logger: prodLogger } = await import('./logger')
      prodLogger.warn('warn msg')
      expect(mockSentryLoggerWarn).toHaveBeenCalledTimes(1)
      expect(mockSentryLoggerWarn).toHaveBeenCalledWith('warn msg', {})
    })

    it('error 路由到 Sentry.logger.error', async () => {
      const { logger: prodLogger } = await import('./logger')
      prodLogger.error('error msg')
      expect(mockSentryLoggerError).toHaveBeenCalledTimes(1)
      expect(mockSentryLoggerError).toHaveBeenCalledWith('error msg', {})
    })
  })

  describe('正向用例 — context 作为 attributes 传递给 Sentry', () => {
    it('info 带 context 传递给 Sentry.logger.info', async () => {
      const { logger: prodLogger } = await import('./logger')
      const ctx = { module: 'auth', duration: 42 }
      prodLogger.info('login success', ctx)
      expect(mockSentryLoggerInfo).toHaveBeenCalledWith('login success', ctx)
    })

    it('error 带 context 传递给 Sentry.logger.error', async () => {
      const { logger: prodLogger } = await import('./logger')
      const ctx = { code: 500, stack: 'Error: Internal Server Error' }
      prodLogger.error('server error', ctx)
      expect(mockSentryLoggerError).toHaveBeenCalledWith('server error', ctx)
    })

    it('不带 context 时传递空 attributes 对象', async () => {
      const { logger: prodLogger } = await import('./logger')
      prodLogger.warn('no ctx')
      expect(mockSentryLoggerWarn).toHaveBeenCalledWith('no ctx', {})
    })

    it('所有级别同时调用均路由到对应 Sentry.logger 方法', async () => {
      const { logger: prodLogger } = await import('./logger')
      prodLogger.trace('t')
      prodLogger.debug('d')
      prodLogger.info('i')
      prodLogger.warn('w')
      prodLogger.error('e')

      expect(mockSentryLoggerTrace).toHaveBeenCalledWith('t', {})
      expect(mockSentryLoggerDebug).toHaveBeenCalledWith('d', {})
      expect(mockSentryLoggerInfo).toHaveBeenCalledWith('i', {})
      expect(mockSentryLoggerWarn).toHaveBeenCalledWith('w', {})
      expect(mockSentryLoggerError).toHaveBeenCalledWith('e', {})
    })
  })

  describe('边界用例 — 生产模式极端输入', () => {
    it('空字符串消息正确路由', async () => {
      const { logger: prodLogger } = await import('./logger')
      prodLogger.info('')
      expect(mockSentryLoggerInfo).toHaveBeenCalledWith('', {})
    })

    it('超长消息 (10000 字符) 正确路由', async () => {
      const { logger: prodLogger } = await import('./logger')
      const longMsg = 'x'.repeat(10000)
      prodLogger.warn(longMsg)
      expect(mockSentryLoggerWarn).toHaveBeenCalledWith(longMsg, {})
    })

    it('嵌套对象 context 原样传递', async () => {
      const { logger: prodLogger } = await import('./logger')
      const ctx = { nested: { deep: { value: 42 } }, list: [1, 2, 3] }
      prodLogger.info('complex', ctx)
      expect(mockSentryLoggerInfo).toHaveBeenCalledWith('complex', ctx)
    })
  })
})
