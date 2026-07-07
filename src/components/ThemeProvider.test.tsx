import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { ThemeProvider } from './ThemeProvider'
import {
  ThemeProviderContext,
  type ThemeProviderState,
  type Theme,
} from '@/lib/theme-context'

// Mock @tauri-apps/api/event emit
const mockEmit = vi.fn()
vi.mock('@tauri-apps/api/event', () => ({
  emit: (...args: unknown[]) => mockEmit(...(args as [never, never])),
}))

// Mock preferences service
const mockUsePreferences = vi.fn()
vi.mock('@/queries/preferences', () => ({
  usePreferences: () => mockUsePreferences(),
}))

// Helper component to read the context value.
// onValue receives ThemeProviderState (never null — createContext provides a default).
function ContextReader({
  onValue,
}: {
  onValue: (value: ThemeProviderState) => void
}) {
  return (
    <ThemeProviderContext.Consumer>
      {value => {
        onValue(value)
        return <div data-testid="consumer">theme: {value.theme}</div>
      }}
    </ThemeProviderContext.Consumer>
  )
}

// Mutable container — object properties are not subject to TypeScript's
// closure-narrowing that would otherwise infer `never` for captured locals.
function createCapture() {
  return { value: null as ThemeProviderState | null }
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    document.documentElement.classList.remove('light', 'dark')
    mockUsePreferences.mockReturnValue({ data: undefined })
  })

  describe('正向用例 — 初始渲染', () => {
    it('使用 defaultTheme="system" 作为初始主题', () => {
      const captured = createCapture()
      render(
        <ThemeProvider>
          <ContextReader
            onValue={v => {
              captured.value = v
            }}
          />
        </ThemeProvider>
      )
      expect(captured.value?.theme).toBe('system')
    })

    it('从 localStorage 读取保存的主题', () => {
      localStorage.setItem('ui-theme', 'dark')
      const captured = createCapture()
      render(
        <ThemeProvider>
          <ContextReader
            onValue={v => {
              captured.value = v
            }}
          />
        </ThemeProvider>
      )
      expect(captured.value?.theme).toBe('dark')
    })

    it('渲染 children', () => {
      render(
        <ThemeProvider>
          <div data-testid="child">Hello</div>
        </ThemeProvider>
      )
      expect(screen.getByTestId('child')).toBeInTheDocument()
    })
  })

  describe('正向用例 — 主题应用', () => {
    it('dark 主题时给 documentElement 添加 "dark" class', () => {
      render(
        <ThemeProvider defaultTheme="dark">
          <div />
        </ThemeProvider>
      )
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(document.documentElement.classList.contains('light')).toBe(false)
    })

    it('light 主题时给 documentElement 添加 "light" class', () => {
      render(
        <ThemeProvider defaultTheme="light">
          <div />
        </ThemeProvider>
      )
      expect(document.documentElement.classList.contains('light')).toBe(true)
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('system 主题根据 prefers-color-scheme 决定', () => {
      // matchMedia is mocked in setup.ts to return matches: false
      render(
        <ThemeProvider defaultTheme="system">
          <div />
        </ThemeProvider>
      )
      // matches: false -> light
      expect(document.documentElement.classList.contains('light')).toBe(true)
    })
  })

  describe('正向用例 — setTheme', () => {
    it('调用 setTheme 时更新 context 值', () => {
      const captured = createCapture()
      render(
        <ThemeProvider defaultTheme="light">
          <ContextReader
            onValue={v => {
              captured.value = v
            }}
          />
        </ThemeProvider>
      )

      act(() => {
        captured.value?.setTheme('dark' as Theme)
      })

      expect(screen.getByTestId('consumer')).toHaveTextContent('theme: dark')
    })

    it('调用 setTheme 时保存到 localStorage', () => {
      const captured = createCapture()
      render(
        <ThemeProvider defaultTheme="light">
          <ContextReader
            onValue={v => {
              captured.value = v
            }}
          />
        </ThemeProvider>
      )

      act(() => {
        captured.value?.setTheme('dark' as Theme)
      })

      expect(localStorage.getItem('ui-theme')).toBe('dark')
    })

    it('调用 setTheme 时发送 theme-changed 事件', () => {
      const captured = createCapture()
      render(
        <ThemeProvider defaultTheme="light">
          <ContextReader
            onValue={v => {
              captured.value = v
            }}
          />
        </ThemeProvider>
      )

      act(() => {
        captured.value?.setTheme('dark' as Theme)
      })

      expect(mockEmit).toHaveBeenCalledWith('theme-changed', { theme: 'dark' })
    })

    it('切换主题时更新 documentElement class', () => {
      const captured = createCapture()
      render(
        <ThemeProvider defaultTheme="light">
          <ContextReader
            onValue={v => {
              captured.value = v
            }}
          />
        </ThemeProvider>
      )

      act(() => {
        captured.value?.setTheme('dark' as Theme)
      })

      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(document.documentElement.classList.contains('light')).toBe(false)
    })
  })

  describe('正向用例 — 偏好同步', () => {
    it('preferences 加载后同步主题(仅一次)', async () => {
      // Initial render with no preferences
      const { rerender } = render(
        <ThemeProvider defaultTheme="light">
          <div data-testid="child" />
        </ThemeProvider>
      )
      expect(document.documentElement.classList.contains('light')).toBe(true)

      // Simulate preferences loading with theme: 'dark'
      mockUsePreferences.mockReturnValue({
        data: {
          theme: 'dark',
          quick_pane_shortcut: null,
          language: null,
          crash_reporting_consent: null,
        },
      })

      await act(async () => {
        rerender(
          <ThemeProvider defaultTheme="light">
            <div data-testid="child" />
          </ThemeProvider>
        )
      })

      // Theme should sync to 'dark' from preferences
      // setTheme is deferred via queueMicrotask, so wait for it
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true)
      })
    })

    it('preferences.theme 未定义时不覆盖当前主题', () => {
      mockUsePreferences.mockReturnValue({ data: undefined })
      render(
        <ThemeProvider defaultTheme="light">
          <div />
        </ThemeProvider>
      )
      expect(document.documentElement.classList.contains('light')).toBe(true)
    })
  })

  describe('边界用例', () => {
    it('localStorage 为空时使用 defaultTheme', () => {
      const captured = createCapture()
      render(
        <ThemeProvider defaultTheme="dark">
          <ContextReader
            onValue={v => {
              captured.value = v
            }}
          />
        </ThemeProvider>
      )
      expect(captured.value?.theme).toBe('dark')
    })

    it('使用自定义 defaultTheme', () => {
      const captured = createCapture()
      render(
        <ThemeProvider defaultTheme="light">
          <ContextReader
            onValue={v => {
              captured.value = v
            }}
          />
        </ThemeProvider>
      )
      expect(captured.value?.theme).toBe('light')
    })

    it('storageKey 默认为 "ui-theme"', () => {
      const captured = createCapture()
      render(
        <ThemeProvider defaultTheme="light">
          <ContextReader
            onValue={v => {
              captured.value = v
            }}
          />
        </ThemeProvider>
      )

      act(() => {
        captured.value?.setTheme('dark' as Theme)
      })

      expect(localStorage.getItem('ui-theme')).toBe('dark')
    })

    it('preferences 同步只发生一次(后续 theme 变化不触发)', async () => {
      // First render: preferences has theme: 'dark'
      mockUsePreferences.mockReturnValue({
        data: {
          theme: 'dark',
          quick_pane_shortcut: null,
          language: null,
          crash_reporting_consent: null,
        },
      })

      const { rerender } = render(
        <ThemeProvider defaultTheme="light">
          <div />
        </ThemeProvider>
      )
      // setTheme is deferred via queueMicrotask, so wait for it
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true)
      })

      // Now preferences.theme changes to 'light' — should NOT override
      // because hasSyncedPreferences ref is already true
      mockUsePreferences.mockReturnValue({
        data: {
          theme: 'light',
          quick_pane_shortcut: null,
          language: null,
          crash_reporting_consent: null,
        },
      })

      await act(async () => {
        rerender(
          <ThemeProvider defaultTheme="light">
            <div />
          </ThemeProvider>
        )
      })

      // Should still be 'dark' because sync only happens once
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })
  })
})
