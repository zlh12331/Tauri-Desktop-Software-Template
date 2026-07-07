import { describe, it, expect, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock React 的 createContext — 捕获传入的 initialState
// (React 19 Context 类型不再公开 defaultValue 属性,通过 mock.calls 捕获)
// ---------------------------------------------------------------------------
const mockCreateContext = vi.fn(
  <T>(
    defaultValue: T
  ): {
    Provider: Record<string, unknown>
    Consumer: Record<string, unknown>
    defaultValue: T
  } => ({
    Provider: {},
    Consumer: {},
    defaultValue,
  })
)

vi.mock('react', () => ({
  createContext: mockCreateContext,
}))

const { ThemeProviderContext } = await import('./theme-context')

describe('theme-context — 上下文创建', () => {
  // 捕获 createContext 接收的初始值 (等价于 React 18 的 Context.defaultValue)
  const initialValue = mockCreateContext.mock.calls[0]?.[0] as {
    theme: string
    setTheme: (theme: string) => unknown
  }

  describe('正向用例 — createContext 调用', () => {
    it('createContext 被调用一次', () => {
      expect(mockCreateContext).toHaveBeenCalledTimes(1)
    })

    it('createContext 接收的初始值 theme 为 "system"', () => {
      expect(initialValue.theme).toBe('system')
    })

    it('createContext 接收的初始值包含 setTheme 函数', () => {
      expect(typeof initialValue.setTheme).toBe('function')
    })
  })

  describe('正向用例 — ThemeProviderContext 对象', () => {
    it('ThemeProviderContext 已定义', () => {
      expect(ThemeProviderContext).toBeDefined()
    })

    it('包含 Provider 组件', () => {
      expect(ThemeProviderContext.Provider).toBeDefined()
    })

    it('包含 Consumer 组件', () => {
      expect(ThemeProviderContext.Consumer).toBeDefined()
    })
  })

  describe('正向用例 — 默认状态值', () => {
    it('默认 theme 为 "system"', () => {
      expect(initialValue.theme).toBe('system')
    })

    it('默认 setTheme 是函数', () => {
      expect(typeof initialValue.setTheme).toBe('function')
    })

    it('默认 setTheme 返回 null', () => {
      const result = initialValue.setTheme('dark')
      expect(result).toBeNull()
    })
  })

  describe('边界用例 — setTheme 参数兼容性', () => {
    it('setTheme 接受 "dark" 不报错', () => {
      expect(() => initialValue.setTheme('dark')).not.toThrow()
    })

    it('setTheme 接受 "light" 不报错', () => {
      expect(() => initialValue.setTheme('light')).not.toThrow()
    })

    it('setTheme 接受 "system" 不报错', () => {
      expect(() => initialValue.setTheme('system')).not.toThrow()
    })

    it('setTheme 对所有 Theme 值均返回 null', () => {
      const themes = ['dark', 'light', 'system'] as const
      themes.forEach(theme => {
        expect(initialValue.setTheme(theme)).toBeNull()
      })
    })
  })

  describe('边界用例 — 默认值结构', () => {
    it('默认值包含 theme 和 setTheme 两个属性', () => {
      expect(initialValue).toHaveProperty('theme')
      expect(initialValue).toHaveProperty('setTheme')
    })

    it('默认值不包含额外属性', () => {
      const keys = Object.keys(initialValue).sort()
      expect(keys).toEqual(['setTheme', 'theme'])
    })
  })
})
