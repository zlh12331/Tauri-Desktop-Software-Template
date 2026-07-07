import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock i18next — language-init.ts 通过 ./config 间接使用 i18next
// ---------------------------------------------------------------------------
const mockChangeLanguage = vi.fn().mockResolvedValue(undefined)

vi.mock('i18next', () => ({
  default: {
    use: vi.fn().mockReturnThis(),
    init: vi.fn().mockReturnThis(),
    on: vi.fn(),
    off: vi.fn(),
    changeLanguage: mockChangeLanguage,
    t: vi.fn((key: string) => key),
    language: 'en',
    // Pretend all resource bundles are already loaded so loadLanguageAsync
    // skips the dynamic import() in tests.
    hasResourceBundle: vi.fn().mockReturnValue(true),
    addResourceBundle: vi.fn(),
  },
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: 'i18nextModule' },
}))

// Mock @tauri-apps/plugin-os — locale()
const mockLocale = vi.fn()
vi.mock('@tauri-apps/plugin-os', () => ({
  locale: mockLocale,
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const { initializeLanguage } = await import('./language-init')
const { logger } = await import('@/lib/logger')

describe('initializeLanguage — 用户保存的语言偏好', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChangeLanguage.mockResolvedValue(undefined)
    mockLocale.mockResolvedValue(null)
  })

  describe('正向用例 — 保存的语言可用', () => {
    it('保存语言为 en 时调用 changeLanguage("en")', async () => {
      await initializeLanguage('en')
      expect(mockChangeLanguage).toHaveBeenCalledWith('en')
      expect(logger.info).toHaveBeenCalledWith(
        'Language set from user preference',
        { language: 'en' }
      )
    })

    it('保存语言为 zh 时调用 changeLanguage("zh")', async () => {
      await initializeLanguage('zh')
      expect(mockChangeLanguage).toHaveBeenCalledWith('zh')
      expect(logger.info).toHaveBeenCalledWith(
        'Language set from user preference',
        { language: 'zh' }
      )
    })

    it('有保存语言时不检测系统 locale', async () => {
      await initializeLanguage('en')
      expect(mockLocale).not.toHaveBeenCalled()
    })
  })

  describe('异常用例 — 保存的语言不可用', () => {
    it('保存语言为 ja 时回退到 en 并记录警告', async () => {
      await initializeLanguage('ja')
      expect(mockChangeLanguage).toHaveBeenCalledWith('en')
      expect(logger.warn).toHaveBeenCalledWith(
        'Saved language not available, using English',
        { savedLanguage: 'ja', availableLanguages: ['en', 'zh'] }
      )
    })

    it('保存语言为 unknown 时回退到 en', async () => {
      await initializeLanguage('unknown')
      expect(mockChangeLanguage).toHaveBeenCalledWith('en')
    })

    it('不可用语言时不检测系统 locale', async () => {
      await initializeLanguage('de')
      expect(mockLocale).not.toHaveBeenCalled()
    })
  })
})

describe('initializeLanguage — 系统语言检测', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChangeLanguage.mockResolvedValue(undefined)
  })

  describe('正向用例 — 从系统 locale 检测语言', () => {
    it('系统 locale 为 zh-CN 时使用 zh', async () => {
      mockLocale.mockResolvedValue('zh-CN')
      await initializeLanguage(null)
      expect(mockLocale).toHaveBeenCalled()
      expect(mockChangeLanguage).toHaveBeenCalledWith('zh')
      expect(logger.info).toHaveBeenCalledWith(
        'Language set from system locale',
        {
          systemLocale: 'zh-CN',
          language: 'zh',
        }
      )
    })

    it('系统 locale 为 en-US 时使用 en', async () => {
      mockLocale.mockResolvedValue('en-US')
      await initializeLanguage(null)
      expect(mockChangeLanguage).toHaveBeenCalledWith('en')
    })

    it('系统 locale 仅语言码 zh 时使用 zh', async () => {
      mockLocale.mockResolvedValue('zh')
      await initializeLanguage(null)
      expect(mockChangeLanguage).toHaveBeenCalledWith('zh')
    })

    it('系统 locale 仅语言码 en 时使用 en', async () => {
      mockLocale.mockResolvedValue('en')
      await initializeLanguage(null)
      expect(mockChangeLanguage).toHaveBeenCalledWith('en')
    })

    it('检测到系统 locale 时记录 debug 日志', async () => {
      mockLocale.mockResolvedValue('en-US')
      await initializeLanguage(null)
      expect(logger.debug).toHaveBeenCalledWith('Detected system locale', {
        systemLocale: 'en-US',
      })
    })
  })

  describe('边界用例 — 系统 locale 不可用', () => {
    it('系统 locale 为 ja-JP (不可用) 时回退到 en', async () => {
      mockLocale.mockResolvedValue('ja-JP')
      await initializeLanguage(null)
      expect(mockChangeLanguage).toHaveBeenCalledWith('en')
      expect(logger.debug).toHaveBeenCalledWith(
        'System locale not available in translations',
        {
          systemLocale: 'ja-JP',
          langCode: 'ja',
          availableLanguages: ['en', 'zh'],
        }
      )
    })

    it('系统 locale 为 de-DE (不可用) 时回退到 en', async () => {
      mockLocale.mockResolvedValue('de-DE')
      await initializeLanguage(null)
      expect(mockChangeLanguage).toHaveBeenCalledWith('en')
    })
  })

  describe('边界用例 — 系统 locale 为空或 null', () => {
    it('系统 locale 为 null 时回退到 en', async () => {
      mockLocale.mockResolvedValue(null)
      await initializeLanguage(null)
      expect(mockChangeLanguage).toHaveBeenCalledWith('en')
      expect(logger.info).toHaveBeenCalledWith(
        'Language set to English (fallback)'
      )
    })

    it('系统 locale 为空字符串时回退到 en', async () => {
      mockLocale.mockResolvedValue('')
      await initializeLanguage(null)
      expect(mockChangeLanguage).toHaveBeenCalledWith('en')
    })
  })

  describe('边界用例 — savedLanguage 为空值', () => {
    it('savedLanguage 为空字符串时走系统检测路径', async () => {
      mockLocale.mockResolvedValue('zh-CN')
      await initializeLanguage('')
      // 空字符串为 falsy,应走系统 locale 检测
      expect(mockLocale).toHaveBeenCalled()
      expect(mockChangeLanguage).toHaveBeenCalledWith('zh')
    })
  })
})

describe('initializeLanguage — 异常处理', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChangeLanguage.mockResolvedValue(undefined)
  })

  describe('异常用例 — locale() 调用失败', () => {
    it('locale() 抛出错误时回退到 en', async () => {
      mockLocale.mockRejectedValue(new Error('OS error'))
      await initializeLanguage(null)
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to initialize language',
        { error: expect.any(Error) }
      )
      expect(mockChangeLanguage).toHaveBeenCalledWith('en')
    })
  })

  describe('异常用例 — changeLanguage 失败', () => {
    it('changeLanguage 抛出错误时回退到 en', async () => {
      mockLocale.mockResolvedValue(null)
      mockChangeLanguage
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(undefined)

      await initializeLanguage('en')

      // 第一次调用失败,catch 中再次调用 en
      expect(mockChangeLanguage).toHaveBeenCalledTimes(2)
      expect(mockChangeLanguage).toHaveBeenNthCalledWith(1, 'en')
      expect(mockChangeLanguage).toHaveBeenNthCalledWith(2, 'en')
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to initialize language',
        { error: expect.any(Error) }
      )
    })
  })
})
