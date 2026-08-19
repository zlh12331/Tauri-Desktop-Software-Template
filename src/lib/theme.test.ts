import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  applyThemeClass,
  isValidTheme,
  readStoredTheme,
  writeStoredTheme,
  THEME_STORAGE_KEY,
} from './theme'

describe('theme', () => {
  let root: HTMLElement

  beforeEach(() => {
    localStorage.clear()
    root = document.documentElement
    root.classList.remove('light', 'dark')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('applyThemeClass', () => {
    it('正向：应用 light 主题类', () => {
      applyThemeClass('light')
      expect(root.classList.contains('light')).toBe(true)
      expect(root.classList.contains('dark')).toBe(false)
    })

    it('正向：应用 dark 主题类', () => {
      applyThemeClass('dark')
      expect(root.classList.contains('dark')).toBe(true)
      expect(root.classList.contains('light')).toBe(false)
    })

    it('边界：system 且系统偏好 dark 时解析为 dark', () => {
      // 覆盖 window.matchMedia 返回 matches=true
      vi.spyOn(window, 'matchMedia').mockReturnValue({
        matches: true,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as MediaQueryList)
      applyThemeClass('system')
      expect(root.classList.contains('dark')).toBe(true)
    })

    it('边界：system 且系统偏好 light 时解析为 light', () => {
      // 显式 mock matches=false（系统偏好 light）
      vi.spyOn(window, 'matchMedia').mockReturnValue({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as MediaQueryList)
      applyThemeClass('system')
      expect(root.classList.contains('light')).toBe(true)
      expect(root.classList.contains('dark')).toBe(false)
    })

    it('边界：切换主题时先移除旧类再添加新类', () => {
      applyThemeClass('dark')
      applyThemeClass('light')
      expect(root.classList.contains('light')).toBe(true)
      expect(root.classList.contains('dark')).toBe(false)
      // classList 中仅有一个主题类
      const themeClasses = ['light', 'dark'].filter(c =>
        root.classList.contains(c)
      )
      expect(themeClasses).toEqual(['light'])
    })
  })

  describe('isValidTheme', () => {
    it('正向：light/dark/system 均为有效主题', () => {
      expect(isValidTheme('light')).toBe(true)
      expect(isValidTheme('dark')).toBe(true)
      expect(isValidTheme('system')).toBe(true)
    })

    it('异常：无效值返回 false', () => {
      expect(isValidTheme('blue')).toBe(false)
      expect(isValidTheme('')).toBe(false)
      expect(isValidTheme(null)).toBe(false)
      expect(isValidTheme(undefined)).toBe(false)
      expect(isValidTheme(42)).toBe(false)
    })

    it('边界：大小写敏感', () => {
      expect(isValidTheme('Light')).toBe(false)
      expect(isValidTheme('DARK')).toBe(false)
    })
  })

  describe('readStoredTheme', () => {
    it('正向：读取已存主题', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'dark')
      expect(readStoredTheme()).toBe('dark')
    })

    it('边界：无存储时使用默认值 system', () => {
      expect(readStoredTheme()).toBe('system')
    })

    it('边界：无存储时使用传入的默认值', () => {
      expect(readStoredTheme('light')).toBe('light')
    })

    it('异常：存储值为无效主题时回退到默认值', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'purple')
      expect(readStoredTheme()).toBe('system')
      expect(readStoredTheme('dark')).toBe('dark')
    })
  })

  describe('writeStoredTheme', () => {
    it('正向：写入主题到 localStorage', () => {
      writeStoredTheme('dark')
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    })

    it('正向：覆盖已有主题', () => {
      writeStoredTheme('light')
      writeStoredTheme('system')
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system')
    })
  })

  describe('读写往返', () => {
    it('综合：writeStoredTheme 后 readStoredTheme 可读回', () => {
      for (const theme of ['light', 'dark', 'system'] as const) {
        writeStoredTheme(theme)
        expect(readStoredTheme()).toBe(theme)
      }
    })
  })
})
