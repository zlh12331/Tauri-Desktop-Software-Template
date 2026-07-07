import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { useTheme } from './use-theme'
import {
  ThemeProviderContext,
  type ThemeProviderState,
} from '@/lib/theme-context'

/**
 * Build a wrapper component that supplies a ThemeProviderContext value.
 * Uses createElement instead of JSX so the file can keep the `.ts` extension.
 */
function makeWrapper(value: ThemeProviderState) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(ThemeProviderContext.Provider, { value }, children)
  }
}

describe('useTheme', () => {
  describe('正向用例 — 在 ThemeProvider 内使用', () => {
    it('returns the context value provided by the ThemeProvider', () => {
      const value: ThemeProviderState = {
        theme: 'dark',
        setTheme: vi.fn(),
      }

      const { result } = renderHook(() => useTheme(), {
        wrapper: makeWrapper(value),
      })
      expect(result.current).toBe(value)
      expect(result.current.theme).toBe('dark')
      expect(typeof result.current.setTheme).toBe('function')
    })

    it('returns the light theme when provided', () => {
      const value: ThemeProviderState = {
        theme: 'light',
        setTheme: vi.fn(),
      }

      const { result } = renderHook(() => useTheme(), {
        wrapper: makeWrapper(value),
      })
      expect(result.current.theme).toBe('light')
    })

    it('returns the system theme when provided', () => {
      const value: ThemeProviderState = {
        theme: 'system',
        setTheme: vi.fn(),
      }

      const { result } = renderHook(() => useTheme(), {
        wrapper: makeWrapper(value),
      })
      expect(result.current.theme).toBe('system')
    })

    it('calls setTheme when invoked through the returned context', () => {
      const setTheme = vi.fn()
      const value: ThemeProviderState = { theme: 'dark', setTheme }

      const { result } = renderHook(() => useTheme(), {
        wrapper: makeWrapper(value),
      })
      result.current.setTheme('light')
      expect(setTheme).toHaveBeenCalledWith('light')
    })
  })

  describe('边界用例 — 默认上下文', () => {
    it('returns the default context state when no provider is present', () => {
      // createContext was initialised with a default value (not undefined),
      // so using the hook without a provider returns that default and does
      // NOT throw.
      const { result } = renderHook(() => useTheme())
      expect(result.current.theme).toBe('system')
      expect(typeof result.current.setTheme).toBe('function')
    })
  })

  describe('异常用例 — context 为 undefined 时抛错', () => {
    beforeEach(() => {
      // Suppress the expected console.error noise from React when a hook throws
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
    })

    it('throws "useTheme must be used within a ThemeProvider" when context is undefined', () => {
      expect(() =>
        renderHook(() => useTheme(), {
          wrapper: makeWrapper(undefined as unknown as ThemeProviderState),
        })
      ).toThrow('useTheme must be used within a ThemeProvider')
    })
  })
})
