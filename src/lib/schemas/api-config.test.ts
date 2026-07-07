import { describe, it, expect } from 'vitest'
import {
  createApiConfigSchema,
  defaultApiConfigMessages,
  apiConfigSchema,
  apiConfigDefaults,
  type ApiConfigMessages,
  type ApiConfigFormValues,
} from './api-config'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** A fully valid config used as the baseline for positive tests. */
const validData: ApiConfigFormValues = {
  endpoint: 'https://api.example.com',
  apiKey: 'sk-1234567890abcdef',
  timeoutSeconds: 30,
  retryCount: 3,
  debugMode: false,
}

/**
 * Helper: create test data with optional field overrides.
 * Returns `unknown` because `safeParse` accepts `unknown` and some overrides
 * intentionally use incorrect types for negative tests.
 */
const makeData = (overrides: Record<string, unknown> = {}): unknown => ({
  ...validData,
  ...overrides,
})

/** Custom (localized) error messages for i18n testing. */
const customMessages: ApiConfigMessages = {
  endpointInvalid: '端点必须是有效的 URL',
  apiKeyMin: 'API 密钥至少 10 个字符',
  timeoutMin: '超时至少 1 秒',
  timeoutMax: '超时不超过 300 秒',
  retryMin: '重试次数至少 0',
  retryMax: '重试次数不超过 10',
}

// ---------------------------------------------------------------------------
// createApiConfigSchema — schema factory
// ---------------------------------------------------------------------------
describe('createApiConfigSchema', () => {
  // =========================================================================
  // 正向用例 — 有效配置通过验证
  // =========================================================================
  describe('正向用例 — 有效配置通过验证', () => {
    it('完整有效配置通过验证', () => {
      const result = apiConfigSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('解析成功后返回完整数据', () => {
      const result = apiConfigSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validData)
      }
    })

    it('HTTPS URL 通过验证', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ endpoint: 'https://api.openai.com' })
      )
      expect(result.success).toBe(true)
    })

    it('HTTP URL 通过验证', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ endpoint: 'http://localhost:3000' })
      )
      expect(result.success).toBe(true)
    })

    it('带路径的 URL 通过验证', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ endpoint: 'https://api.example.com/v1/chat' })
      )
      expect(result.success).toBe(true)
    })

    it('带端口号的 URL 通过验证', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ endpoint: 'https://api.example.com:8080' })
      )
      expect(result.success).toBe(true)
    })

    it('带查询参数的 URL 通过验证', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ endpoint: 'https://api.example.com?key=abc' })
      )
      expect(result.success).toBe(true)
    })

    it('debugMode 为 true 时通过验证', () => {
      const result = apiConfigSchema.safeParse(makeData({ debugMode: true }))
      expect(result.success).toBe(true)
    })

    it('debugMode 为 false 时通过验证', () => {
      const result = apiConfigSchema.safeParse(makeData({ debugMode: false }))
      expect(result.success).toBe(true)
    })

    it('浮点数 timeoutSeconds 通过验证', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ timeoutSeconds: 30.5 })
      )
      expect(result.success).toBe(true)
    })

    it('浮点数 retryCount 通过验证', () => {
      const result = apiConfigSchema.safeParse(makeData({ retryCount: 3.5 }))
      expect(result.success).toBe(true)
    })

    it('未知字段被剥离 (Zod 默认 strip 行为)', () => {
      const result = apiConfigSchema.safeParse({
        ...validData,
        extraField: 'should be stripped',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).not.toHaveProperty('extraField')
        expect(result.data).toEqual(validData)
      }
    })
  })

  // =========================================================================
  // 边界用例 — 边界值
  // =========================================================================
  describe('边界用例 — 边界值', () => {
    it('apiKey 恰好 10 个字符时通过 (最小长度边界)', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ apiKey: '1234567890' })
      )
      expect(result.success).toBe(true)
    })

    it('apiKey 11 个字符时通过 (刚好高于最小长度)', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ apiKey: '12345678901' })
      )
      expect(result.success).toBe(true)
    })

    it('timeoutSeconds = 1 时通过 (最小值边界)', () => {
      const result = apiConfigSchema.safeParse(makeData({ timeoutSeconds: 1 }))
      expect(result.success).toBe(true)
    })

    it('timeoutSeconds = 300 时通过 (最大值边界)', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ timeoutSeconds: 300 })
      )
      expect(result.success).toBe(true)
    })

    it('retryCount = 0 时通过 (最小值边界)', () => {
      const result = apiConfigSchema.safeParse(makeData({ retryCount: 0 }))
      expect(result.success).toBe(true)
    })

    it('retryCount = 10 时通过 (最大值边界)', () => {
      const result = apiConfigSchema.safeParse(makeData({ retryCount: 10 }))
      expect(result.success).toBe(true)
    })

    it('所有字段同时取边界值时通过', () => {
      const result = apiConfigSchema.safeParse({
        endpoint: 'https://a.io',
        apiKey: '1234567890',
        timeoutSeconds: 1,
        retryCount: 0,
        debugMode: false,
      })
      expect(result.success).toBe(true)
    })

    it('所有字段同时取最大边界值时通过', () => {
      const result = apiConfigSchema.safeParse({
        endpoint: 'https://api.example.com',
        apiKey: 'k'.repeat(100),
        timeoutSeconds: 300,
        retryCount: 10,
        debugMode: true,
      })
      expect(result.success).toBe(true)
    })
  })

  // =========================================================================
  // 异常用例 — 无效值 (类型正确但值不合法)
  // =========================================================================
  describe('异常用例 — 无效值', () => {
    it('空字符串 endpoint 报错并返回 endpointInvalid 消息', () => {
      const result = apiConfigSchema.safeParse(makeData({ endpoint: '' }))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          defaultApiConfigMessages.endpointInvalid
        )
        expect(result.error.issues[0]?.path).toEqual(['endpoint'])
      }
    })

    it('非 URL 字符串 endpoint 报错', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ endpoint: 'not-a-url' })
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          defaultApiConfigMessages.endpointInvalid
        )
        expect(result.error.issues[0]?.path).toEqual(['endpoint'])
      }
    })

    it('缺少协议的 endpoint 报错', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ endpoint: '://example.com' })
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          defaultApiConfigMessages.endpointInvalid
        )
      }
    })

    it('空字符串 apiKey 报错并返回 apiKeyMin 消息', () => {
      const result = apiConfigSchema.safeParse(makeData({ apiKey: '' }))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          defaultApiConfigMessages.apiKeyMin
        )
        expect(result.error.issues[0]?.path).toEqual(['apiKey'])
      }
    })

    it('apiKey 9 个字符报错 (刚好低于最小长度)', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ apiKey: '123456789' })
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          defaultApiConfigMessages.apiKeyMin
        )
        expect(result.error.issues[0]?.path).toEqual(['apiKey'])
      }
    })

    it('apiKey 1 个字符报错', () => {
      const result = apiConfigSchema.safeParse(makeData({ apiKey: 'x' }))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          defaultApiConfigMessages.apiKeyMin
        )
      }
    })

    it('timeoutSeconds = 0 报错并返回 timeoutMin 消息', () => {
      const result = apiConfigSchema.safeParse(makeData({ timeoutSeconds: 0 }))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          defaultApiConfigMessages.timeoutMin
        )
        expect(result.error.issues[0]?.path).toEqual(['timeoutSeconds'])
      }
    })

    it('timeoutSeconds = -1 报错 (负数)', () => {
      const result = apiConfigSchema.safeParse(makeData({ timeoutSeconds: -1 }))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          defaultApiConfigMessages.timeoutMin
        )
      }
    })

    it('timeoutSeconds = 301 报错 (刚好超过最大值)', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ timeoutSeconds: 301 })
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          defaultApiConfigMessages.timeoutMax
        )
        expect(result.error.issues[0]?.path).toEqual(['timeoutSeconds'])
      }
    })

    it('timeoutSeconds = 99999 报错 (远超最大值)', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ timeoutSeconds: 99999 })
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          defaultApiConfigMessages.timeoutMax
        )
      }
    })

    it('retryCount = -1 报错并返回 retryMin 消息', () => {
      const result = apiConfigSchema.safeParse(makeData({ retryCount: -1 }))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          defaultApiConfigMessages.retryMin
        )
        expect(result.error.issues[0]?.path).toEqual(['retryCount'])
      }
    })

    it('retryCount = 11 报错 (刚好超过最大值)', () => {
      const result = apiConfigSchema.safeParse(makeData({ retryCount: 11 }))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          defaultApiConfigMessages.retryMax
        )
        expect(result.error.issues[0]?.path).toEqual(['retryCount'])
      }
    })

    it('retryCount = -100 报错 (远低于最小值)', () => {
      const result = apiConfigSchema.safeParse(makeData({ retryCount: -100 }))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          defaultApiConfigMessages.retryMin
        )
      }
    })
  })

  // =========================================================================
  // 异常用例 — 类型错误 (字段类型不匹配)
  // =========================================================================
  describe('异常用例 — 类型错误', () => {
    it('endpoint 为数字时报错', () => {
      const result = apiConfigSchema.safeParse(makeData({ endpoint: 12345 }))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['endpoint'])
      }
    })

    it('endpoint 为 boolean 时报错', () => {
      const result = apiConfigSchema.safeParse(makeData({ endpoint: true }))
      expect(result.success).toBe(false)
    })

    it('apiKey 为数字时报错', () => {
      const result = apiConfigSchema.safeParse(makeData({ apiKey: 1234567890 }))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['apiKey'])
      }
    })

    it('timeoutSeconds 为字符串时报错', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ timeoutSeconds: '30' })
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['timeoutSeconds'])
      }
    })

    it('timeoutSeconds 为 boolean 时报错', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ timeoutSeconds: true })
      )
      expect(result.success).toBe(false)
    })

    it('retryCount 为字符串时报错', () => {
      const result = apiConfigSchema.safeParse(makeData({ retryCount: '3' }))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['retryCount'])
      }
    })

    it('debugMode 为字符串时报错', () => {
      const result = apiConfigSchema.safeParse(makeData({ debugMode: 'true' }))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['debugMode'])
      }
    })

    it('debugMode 为数字时报错', () => {
      const result = apiConfigSchema.safeParse(makeData({ debugMode: 1 }))
      expect(result.success).toBe(false)
    })

    it('endpoint 为 null 时报错', () => {
      const result = apiConfigSchema.safeParse(makeData({ endpoint: null }))
      expect(result.success).toBe(false)
    })

    it('timeoutSeconds 为 null 时报错', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ timeoutSeconds: null })
      )
      expect(result.success).toBe(false)
    })

    it('debugMode 为 null 时报错', () => {
      const result = apiConfigSchema.safeParse(makeData({ debugMode: null }))
      expect(result.success).toBe(false)
    })

    it('apiKey 为数组时报错', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ apiKey: ['1', '2', '3'] })
      )
      expect(result.success).toBe(false)
    })

    it('endpoint 为对象时报错', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ endpoint: { href: 'https://example.com' } })
      )
      expect(result.success).toBe(false)
    })
  })

  // =========================================================================
  // 异常用例 — 缺少必填字段
  // =========================================================================
  describe('异常用例 — 缺少必填字段', () => {
    it('缺少 endpoint 时报错', () => {
      const result = apiConfigSchema.safeParse({
        apiKey: 'sk-1234567890abcdef',
        timeoutSeconds: 30,
        retryCount: 3,
        debugMode: false,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['endpoint'])
      }
    })

    it('缺少 apiKey 时报错', () => {
      const result = apiConfigSchema.safeParse({
        endpoint: 'https://api.example.com',
        timeoutSeconds: 30,
        retryCount: 3,
        debugMode: false,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['apiKey'])
      }
    })

    it('缺少 timeoutSeconds 时报错', () => {
      const result = apiConfigSchema.safeParse({
        endpoint: 'https://api.example.com',
        apiKey: 'sk-1234567890abcdef',
        retryCount: 3,
        debugMode: false,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['timeoutSeconds'])
      }
    })

    it('缺少 retryCount 时报错', () => {
      const result = apiConfigSchema.safeParse({
        endpoint: 'https://api.example.com',
        apiKey: 'sk-1234567890abcdef',
        timeoutSeconds: 30,
        debugMode: false,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['retryCount'])
      }
    })

    it('缺少 debugMode 时报错', () => {
      const result = apiConfigSchema.safeParse({
        endpoint: 'https://api.example.com',
        apiKey: 'sk-1234567890abcdef',
        timeoutSeconds: 30,
        retryCount: 3,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['debugMode'])
      }
    })

    it('传入空对象时报错', () => {
      const result = apiConfigSchema.safeParse({})
      expect(result.success).toBe(false)
      if (!result.success) {
        // All 5 fields should be missing
        expect(result.error.issues.length).toBeGreaterThanOrEqual(5)
      }
    })

    it('传入 null 时报错', () => {
      const result = apiConfigSchema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('传入 undefined 时报错', () => {
      const result = apiConfigSchema.safeParse(undefined)
      expect(result.success).toBe(false)
    })

    it('传入数组时报错', () => {
      const result = apiConfigSchema.safeParse([
        'https://api.example.com',
        'key',
        30,
        3,
        false,
      ])
      expect(result.success).toBe(false)
    })

    it('传入原始字符串时报错', () => {
      const result = apiConfigSchema.safeParse('not-an-object')
      expect(result.success).toBe(false)
    })
  })

  // =========================================================================
  // 异常用例 — 极端值
  // =========================================================================
  describe('异常用例 — 极端值', () => {
    it('timeoutSeconds = Infinity 报错 (超过最大值)', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ timeoutSeconds: Infinity })
      )
      expect(result.success).toBe(false)
    })

    it('timeoutSeconds = -Infinity 报错 (低于最小值)', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ timeoutSeconds: -Infinity })
      )
      expect(result.success).toBe(false)
    })

    it('timeoutSeconds = NaN 报错', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ timeoutSeconds: NaN })
      )
      expect(result.success).toBe(false)
    })

    it('retryCount = NaN 报错', () => {
      const result = apiConfigSchema.safeParse(makeData({ retryCount: NaN }))
      expect(result.success).toBe(false)
    })

    it('retryCount = Infinity 报错 (超过最大值)', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ retryCount: Infinity })
      )
      expect(result.success).toBe(false)
    })

    it('超长 apiKey (10000 字符) 通过验证', () => {
      const result = apiConfigSchema.safeParse(
        makeData({ apiKey: 'k'.repeat(10000) })
      )
      expect(result.success).toBe(true)
    })

    it('超长 endpoint URL 通过验证', () => {
      const longPath = 'a'.repeat(2000)
      const result = apiConfigSchema.safeParse(
        makeData({ endpoint: `https://api.example.com/${longPath}` })
      )
      expect(result.success).toBe(true)
    })
  })

  // =========================================================================
  // 自定义错误消息 (i18n)
  // =========================================================================
  describe('自定义错误消息 (i18n)', () => {
    const customSchema = createApiConfigSchema(customMessages)

    it('无效 URL 返回自定义 endpointInvalid 消息', () => {
      const result = customSchema.safeParse(makeData({ endpoint: 'bad' }))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          customMessages.endpointInvalid
        )
      }
    })

    it('空 endpoint 返回自定义 endpointInvalid 消息', () => {
      const result = customSchema.safeParse(makeData({ endpoint: '' }))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          customMessages.endpointInvalid
        )
      }
    })

    it('短 apiKey 返回自定义 apiKeyMin 消息', () => {
      const result = customSchema.safeParse(makeData({ apiKey: 'short' }))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(customMessages.apiKeyMin)
      }
    })

    it('低 timeout 返回自定义 timeoutMin 消息', () => {
      const result = customSchema.safeParse(makeData({ timeoutSeconds: 0 }))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(customMessages.timeoutMin)
      }
    })

    it('高 timeout 返回自定义 timeoutMax 消息', () => {
      const result = customSchema.safeParse(makeData({ timeoutSeconds: 999 }))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(customMessages.timeoutMax)
      }
    })

    it('低 retryCount 返回自定义 retryMin 消息', () => {
      const result = customSchema.safeParse(makeData({ retryCount: -1 }))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(customMessages.retryMin)
      }
    })

    it('高 retryCount 返回自定义 retryMax 消息', () => {
      const result = customSchema.safeParse(makeData({ retryCount: 99 }))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(customMessages.retryMax)
      }
    })

    it('自定义消息 schema 的有效配置仍然通过验证', () => {
      const result = customSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('不同消息对象生成不同 schema 实例', () => {
      const schemaA = createApiConfigSchema(defaultApiConfigMessages)
      const schemaB = createApiConfigSchema(customMessages)
      const resultA = schemaA.safeParse(makeData({ endpoint: 'bad' }))
      const resultB = schemaB.safeParse(makeData({ endpoint: 'bad' }))

      expect(resultA.success).toBe(false)
      expect(resultB.success).toBe(false)
      if (!resultA.success && !resultB.success) {
        expect(resultA.error.issues[0]?.message).not.toBe(
          resultB.error.issues[0]?.message
        )
      }
    })
  })
})

// ---------------------------------------------------------------------------
// defaultApiConfigMessages — 默认消息常量
// ---------------------------------------------------------------------------
describe('defaultApiConfigMessages', () => {
  it('包含所有必需的消息字段', () => {
    expect(defaultApiConfigMessages).toHaveProperty('endpointInvalid')
    expect(defaultApiConfigMessages).toHaveProperty('apiKeyMin')
    expect(defaultApiConfigMessages).toHaveProperty('timeoutMin')
    expect(defaultApiConfigMessages).toHaveProperty('timeoutMax')
    expect(defaultApiConfigMessages).toHaveProperty('retryMin')
    expect(defaultApiConfigMessages).toHaveProperty('retryMax')
  })

  it('所有消息为非空字符串', () => {
    const messages: string[] = [
      defaultApiConfigMessages.endpointInvalid,
      defaultApiConfigMessages.apiKeyMin,
      defaultApiConfigMessages.timeoutMin,
      defaultApiConfigMessages.timeoutMax,
      defaultApiConfigMessages.retryMin,
      defaultApiConfigMessages.retryMax,
    ]
    for (const msg of messages) {
      expect(typeof msg).toBe('string')
      expect(msg.length).toBeGreaterThan(0)
    }
  })

  it('endpointInvalid 消息包含 URL 相关描述', () => {
    expect(defaultApiConfigMessages.endpointInvalid.toLowerCase()).toContain(
      'url'
    )
  })

  it('apiKeyMin 消息包含 10 相关描述', () => {
    expect(defaultApiConfigMessages.apiKeyMin).toContain('10')
  })
})

// ---------------------------------------------------------------------------
// apiConfigSchema — 默认 schema 实例
// ---------------------------------------------------------------------------
describe('apiConfigSchema (默认实例)', () => {
  it('是有效的 Zod schema 并具有 safeParse 方法', () => {
    expect(apiConfigSchema).toBeDefined()
    expect(typeof apiConfigSchema.safeParse).toBe('function')
  })

  it('使用默认英文消息', () => {
    const result = apiConfigSchema.safeParse(makeData({ endpoint: 'invalid' }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        defaultApiConfigMessages.endpointInvalid
      )
    }
  })

  it('有效数据通过默认 schema 验证', () => {
    const result = apiConfigSchema.safeParse(validData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(validData)
    }
  })
})

// ---------------------------------------------------------------------------
// apiConfigDefaults — 默认表单值
// ---------------------------------------------------------------------------
describe('apiConfigDefaults', () => {
  it('包含所有必填字段', () => {
    expect(apiConfigDefaults).toHaveProperty('endpoint')
    expect(apiConfigDefaults).toHaveProperty('apiKey')
    expect(apiConfigDefaults).toHaveProperty('timeoutSeconds')
    expect(apiConfigDefaults).toHaveProperty('retryCount')
    expect(apiConfigDefaults).toHaveProperty('debugMode')
  })

  it('endpoint 默认为空字符串', () => {
    expect(apiConfigDefaults.endpoint).toBe('')
  })

  it('apiKey 默认为空字符串', () => {
    expect(apiConfigDefaults.apiKey).toBe('')
  })

  it('timeoutSeconds 默认为 30', () => {
    expect(apiConfigDefaults.timeoutSeconds).toBe(30)
  })

  it('retryCount 默认为 3', () => {
    expect(apiConfigDefaults.retryCount).toBe(3)
  })

  it('debugMode 默认为 false', () => {
    expect(apiConfigDefaults.debugMode).toBe(false)
  })

  it('默认值中的有效字段 (timeoutSeconds, retryCount, debugMode) 单独通过验证', () => {
    const result = apiConfigSchema.safeParse({
      ...apiConfigDefaults,
      endpoint: 'https://api.example.com',
      apiKey: 'valid-api-key-12345',
    })
    expect(result.success).toBe(true)
  })

  it('默认值整体不通过 schema 验证 (endpoint 和 apiKey 为空)', () => {
    const result = apiConfigSchema.safeParse(apiConfigDefaults)
    expect(result.success).toBe(false)
    if (!result.success) {
      // endpoint (invalid URL) and apiKey (too short) should both fail
      const paths = result.error.issues.map(issue => issue.path[0])
      expect(paths).toContain('endpoint')
      expect(paths).toContain('apiKey')
    }
  })

  it('默认值字段类型正确 (schema-first 类型推断)', () => {
    // Runtime type checks mirroring ApiConfigFormValues
    expect(typeof apiConfigDefaults.endpoint).toBe('string')
    expect(typeof apiConfigDefaults.apiKey).toBe('string')
    expect(typeof apiConfigDefaults.timeoutSeconds).toBe('number')
    expect(typeof apiConfigDefaults.retryCount).toBe('number')
    expect(typeof apiConfigDefaults.debugMode).toBe('boolean')
  })
})
