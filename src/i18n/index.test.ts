import { describe, it, expect, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock ./config 和 ./language-init 以隔离测试 re-export 行为
// ---------------------------------------------------------------------------
const mockConfigDefault = { _isMockI18n: true }
const mockConfigI18n = { _isMockI18n: true }
const mockAvailableLanguages = ['en', 'zh']
const mockIsRTL = (lng: string): boolean => lng === 'ar'
const mockInitializeLanguage = vi.fn().mockResolvedValue(undefined)
const mockLoadLanguageAsync = vi.fn().mockResolvedValue(undefined)

vi.mock('./config', () => ({
  default: mockConfigDefault,
  i18n: mockConfigI18n,
  availableLanguages: mockAvailableLanguages,
  isRTL: mockIsRTL,
  loadLanguageAsync: mockLoadLanguageAsync,
}))

vi.mock('./language-init', () => ({
  initializeLanguage: mockInitializeLanguage,
}))

const indexModule = await import('./index')

describe('i18n/index — re-export 验证', () => {
  describe('正向用例 — 从 config 重导出', () => {
    it('默认导出来自 ./config', () => {
      expect(indexModule.default).toBe(mockConfigDefault)
    })

    it('i18n 来自 ./config', () => {
      expect(indexModule.i18n).toBe(mockConfigI18n)
    })

    it('availableLanguages 来自 ./config', () => {
      expect(indexModule.availableLanguages).toBe(mockAvailableLanguages)
    })

    it('isRTL 来自 ./config', () => {
      expect(indexModule.isRTL).toBe(mockIsRTL)
      expect(indexModule.isRTL('ar')).toBe(true)
      expect(indexModule.isRTL('en')).toBe(false)
    })

    it('loadLanguageAsync 来自 ./config', () => {
      expect(indexModule.loadLanguageAsync).toBe(mockLoadLanguageAsync)
    })
  })

  describe('正向用例 — 从 language-init 重导出', () => {
    it('initializeLanguage 来自 ./language-init', () => {
      expect(indexModule.initializeLanguage).toBe(mockInitializeLanguage)
    })
  })

  describe('边界用例 — 导出完整性', () => {
    it('模块导出恰好包含 6 个成员', () => {
      const exports = Object.keys(indexModule).sort()
      expect(exports).toEqual(
        [
          'availableLanguages',
          'default',
          'i18n',
          'initializeLanguage',
          'isRTL',
          'loadLanguageAsync',
        ].sort()
      )
    })

    it('initializeLanguage 是函数', () => {
      expect(typeof indexModule.initializeLanguage).toBe('function')
    })

    it('isRTL 是函数', () => {
      expect(typeof indexModule.isRTL).toBe('function')
    })

    it('availableLanguages 是数组', () => {
      expect(Array.isArray(indexModule.availableLanguages)).toBe(true)
    })
  })
})
