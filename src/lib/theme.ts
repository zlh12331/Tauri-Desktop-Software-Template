import type { Theme } from '@/lib/theme-context'

export const THEME_STORAGE_KEY = 'ui-theme'

/**
 * Apply a theme value ('light' | 'dark' | 'system') to the document root.
 *
 * This is a pure DOM operation with no React dependencies, safe to call
 * from inline scripts, event listeners, or anywhere outside the React tree.
 *
 * When theme is 'system', resolves to the current prefers-color-scheme value.
 * For 'system' we do NOT set up a media query listener here — callers that
 * need reactive updates should subscribe themselves.
 */
export function applyThemeClass(theme: Theme): void {
  const root = window.document.documentElement

  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme

  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
}

/**
 * Validate that a raw string is a valid Theme value.
 */
export function isValidTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

/**
 * Read the theme from localStorage, falling back to the provided default.
 */
export function readStoredTheme(defaultTheme: Theme = 'system'): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return isValidTheme(stored) ? stored : defaultTheme
}

/**
 * Write the theme to localStorage.
 */
export function writeStoredTheme(theme: Theme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme)
}
