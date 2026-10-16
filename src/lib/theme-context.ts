import { createContext } from 'react'

export type Theme = 'dark' | 'light' | 'system'

export interface ThemeProviderState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export interface ThemeProviderState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

/**
 * No default value on purpose. A context seeded with `{ theme: 'system',
 * setTheme: () => null }` makes every consumer look like it works outside the
 * provider — theme reads return a plausible value and `setTheme` silently
 * discards the change. `null` is the only initial state that can be told apart
 * from "inside a provider", so `useTheme` can actually enforce that.
 */
export const ThemeProviderContext = createContext<ThemeProviderState | null>(
  null
)
