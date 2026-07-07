import { useLayoutEffect, useState, useRef, useCallback } from 'react'
import { emit } from '@tauri-apps/api/event'
import { ThemeProviderContext, type Theme } from '@/lib/theme-context'
import { usePreferences } from '@/queries/preferences'
import {
  applyThemeClass,
  isValidTheme,
  readStoredTheme,
  writeStoredTheme,
} from '@/lib/theme'

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() =>
    readStoredTheme(defaultTheme)
  )

  // Load theme from persistent preferences
  const { data: preferences } = usePreferences()
  const hasSyncedPreferences = useRef(false)

  /**
   * Unified theme setter — updates React state, persists to localStorage,
   * and notifies other windows. This is the single source of truth for
   * theme changes; ALL callers (preferences sync, UI interactions, etc.)
   * must go through this function to keep all stores in sync.
   */
  const setTheme = useCallback((newTheme: Theme) => {
    writeStoredTheme(newTheme)
    setThemeState(newTheme)
    emit('theme-changed', { theme: newTheme })
  }, [])

  // Sync theme with preferences when they load (only once).
  // Uses the unified setTheme so localStorage and cross-window events
  // are also updated, preventing drift between localStorage and preferences.json.
  //
  // We defer the setState to a microtask to avoid the
  // "setState in effect" lint error — this is an external system sync
  // (preferences.json → React state), not a derived state calculation.
  useLayoutEffect(() => {
    if (preferences?.theme && !hasSyncedPreferences.current) {
      hasSyncedPreferences.current = true

      if (isValidTheme(preferences.theme)) {
        // Defer to microtask to avoid cascading renders
        queueMicrotask(() => setTheme(preferences.theme as Theme))
      }
    }
  }, [preferences?.theme, setTheme])

  // Apply theme class to DOM — useLayoutEffect runs BEFORE browser paint,
  // preventing the flash of incorrect theme (FOUC).
  useLayoutEffect(() => {
    applyThemeClass(theme)

    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      applyThemeClass(e.matches ? 'dark' : 'light')
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  const value = {
    theme,
    setTheme,
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}
