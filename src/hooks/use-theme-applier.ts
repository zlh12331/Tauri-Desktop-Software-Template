import { useLayoutEffect } from 'react'
import { applyThemeClass } from '@/lib/theme'
import type { Theme } from '@/lib/theme-context'

/**
 * Apply theme class to DOM and listen for system theme changes.
 *
 * Shared by ThemeProvider and QuickPaneApp to avoid duplication.
 * useLayoutEffect runs BEFORE browser paint, preventing the flash of
 * incorrect theme (FOUC).
 *
 * @param theme - 当前主题值，变化时触发 DOM class 更新
 */
export function useThemeApplier(theme: Theme): void {
  useLayoutEffect(() => {
    applyThemeClass(theme)

    // 仅 system 主题需要监听系统偏好变化
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      applyThemeClass(e.matches ? 'dark' : 'light')
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])
}
