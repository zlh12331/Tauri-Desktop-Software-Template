import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock i18next — capture the languageChanged handler for direct testing
// ---------------------------------------------------------------------------
let languageChangedHandler: (lng: string) => void = () => undefined

const mockUse = vi.fn().mockReturnThis()
const mockInit = vi.fn().mockReturnThis()
const mockOn = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
  if (event === 'languageChanged') {
    languageChangedHandler = handler as (lng: string) => void
  }
})
const mockOff = vi.fn()
const mockChangeLanguage = vi.fn().mockResolvedValue(undefined)
const mockT = vi.fn((key: string) => key)

vi.mock('i18next', () => ({
  default: {
    use: mockUse,
    init: mockInit,
    on: mockOn,
    off: mockOff,
    changeLanguage: mockChangeLanguage,
    t: mockT,
    language: 'en',
    hasResourceBundle: vi.fn().mockReturnValue(false),
    addResourceBundle: vi.fn(),
  },
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: 'i18nextModule' },
}))

const {
  default: i18nDefault,
  i18n,
  availableLanguages,
  isRTL,
  loadLanguageAsync,
} = await import('./config')

describe('i18n/config — i18next 初始化', () => {
  describe('正向用例 — 初始化调用', () => {
    it('调用 i18n.use 注册 initReactI18next', () => {
      expect(mockUse).toHaveBeenCalledWith({ type: 'i18nextModule' })
    })

    it('调用 i18n.init 并传入正确的配置', () => {
      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          lng: 'en',
          fallbackLng: 'en',
          interpolation: { escapeValue: false },
        })
      )
    })

    it('init 接收仅包含 en 翻译的 resources（懒加载架构）', () => {
      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          resources: expect.objectContaining({
            en: { translation: expect.any(Object) },
          }),
        })
      )
      // zh is NOT in the initial resources — it is lazy-loaded
      const initCall = mockInit.mock.calls[0]?.[0] as Record<string, unknown>
      const resources = initCall?.['resources'] as Record<string, unknown>
      expect(resources).not.toHaveProperty('zh')
    })

    it('init 启用 partialBundledLanguages 以支持懒加载', () => {
      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          partialBundledLanguages: true,
        })
      )
    })

    it('注册 languageChanged 事件监听器', () => {
      expect(mockOn).toHaveBeenCalledWith(
        'languageChanged',
        expect.any(Function)
      )
    })
  })

  describe('正向用例 — 导出', () => {
    it('默认导出与具名导出 i18n 是同一对象', () => {
      expect(i18nDefault).toBe(i18n)
    })

    it('导出的 i18n 对象包含 t 方法', () => {
      expect(typeof i18n.t).toBe('function')
    })

    it('导出的 i18n 对象包含 changeLanguage 方法', () => {
      expect(typeof i18n.changeLanguage).toBe('function')
    })
  })
})

describe('i18n/config — availableLanguages', () => {
  describe('正向用例', () => {
    it('返回可用语言代码数组', () => {
      expect(availableLanguages).toEqual(['en', 'zh'])
    })

    it('返回值是数组', () => {
      expect(Array.isArray(availableLanguages)).toBe(true)
    })

    it('包含恰好 2 种语言', () => {
      expect(availableLanguages).toHaveLength(2)
    })

    it('包含英语', () => {
      expect(availableLanguages).toContain('en')
    })

    it('包含中文', () => {
      expect(availableLanguages).toContain('zh')
    })
  })
})

describe('i18n/config — isRTL', () => {
  describe('正向用例 — RTL 语言', () => {
    it('阿拉伯语 (ar) 返回 true', () => {
      expect(isRTL('ar')).toBe(true)
    })

    it('希伯来语 (he) 返回 true', () => {
      expect(isRTL('he')).toBe(true)
    })

    it('波斯语 (fa) 返回 true', () => {
      expect(isRTL('fa')).toBe(true)
    })

    it('乌尔都语 (ur) 返回 true', () => {
      expect(isRTL('ur')).toBe(true)
    })
  })

  describe('正向用例 — LTR 语言', () => {
    it('英语 (en) 返回 false', () => {
      expect(isRTL('en')).toBe(false)
    })

    it('中文 (zh) 返回 false', () => {
      expect(isRTL('zh')).toBe(false)
    })
  })

  describe('边界用例 — 未知与空值', () => {
    it('空字符串返回 false', () => {
      expect(isRTL('')).toBe(false)
    })

    it('未知语言返回 false', () => {
      expect(isRTL('ja')).toBe(false)
    })

    it('未在 resources 中的 RTL 语言仍返回 true', () => {
      // he/fa/ur 不在 resources 中,但在 rtlLanguages 列表中
      expect(isRTL('he')).toBe(true)
    })

    it('大小写敏感 — 大写 AR 不被识别为 RTL', () => {
      expect(isRTL('AR')).toBe(false)
    })
  })
})

describe('i18n/config — loadLanguageAsync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('已加载的语言不会重复加载', async () => {
    // Mock hasResourceBundle to return true (already loaded)
    const mockI18n = vi.mocked(
      (await import('i18next')).default.hasResourceBundle
    )
    mockI18n.mockReturnValueOnce(true)

    await loadLanguageAsync('zh')

    // addResourceBundle should NOT be called since bundle already exists
    const { default: i18nInstance } = await import('i18next')
    expect(i18nInstance.addResourceBundle).not.toHaveBeenCalled()
  })

  it('不支持的语言代码不会触发加载', async () => {
    await loadLanguageAsync('ja')

    const { default: i18nInstance } = await import('i18next')
    expect(i18nInstance.addResourceBundle).not.toHaveBeenCalled()
  })
})

describe('i18n/config — languageChanged 事件处理器', () => {
  beforeEach(() => {
    // 重置 document 属性
    document.documentElement.dir = ''
    document.documentElement.lang = ''
  })

  describe('正向用例 — RTL 语言', () => {
    it('阿拉伯语触发时设置 dir 为 rtl', () => {
      languageChangedHandler('ar')
      expect(document.documentElement.dir).toBe('rtl')
    })

    it('阿拉伯语触发时设置 lang 为 ar', () => {
      languageChangedHandler('ar')
      expect(document.documentElement.lang).toBe('ar')
    })

    it('希伯来语触发时设置 dir 为 rtl', () => {
      languageChangedHandler('he')
      expect(document.documentElement.dir).toBe('rtl')
    })

    it('希伯来语触发时设置 lang 为 he', () => {
      languageChangedHandler('he')
      expect(document.documentElement.lang).toBe('he')
    })
  })

  describe('正向用例 — LTR 语言', () => {
    it('英语触发时设置 dir 为 ltr', () => {
      languageChangedHandler('en')
      expect(document.documentElement.dir).toBe('ltr')
    })

    it('英语触发时设置 lang 为 en', () => {
      languageChangedHandler('en')
      expect(document.documentElement.lang).toBe('en')
    })

    it('中文触发时设置 dir 为 ltr', () => {
      languageChangedHandler('zh')
      expect(document.documentElement.dir).toBe('ltr')
    })

    it('中文触发时设置 lang 为 zh', () => {
      languageChangedHandler('zh')
      expect(document.documentElement.lang).toBe('zh')
    })
  })

  describe('边界用例 — 未知语言', () => {
    it('未知语言默认设置为 ltr', () => {
      languageChangedHandler('ja')
      expect(document.documentElement.dir).toBe('ltr')
    })

    it('未知语言仍设置 lang 属性为该语言代码', () => {
      languageChangedHandler('ja')
      expect(document.documentElement.lang).toBe('ja')
    })
  })
})
