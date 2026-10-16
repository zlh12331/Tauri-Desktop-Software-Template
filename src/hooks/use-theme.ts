import { useContext } from 'react'
import { ThemeProviderContext } from '@/lib/theme-context'

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  // The context starts at null, so this branch is reachable — which is the whole
  // point: with a seeded default value it was dead code, and a component rendered
  // outside ThemeProvider got a theme it could never change. Falsy rather than
  // `=== null` because React 19 hands back an explicit `value={undefined}` instead
  // of falling back to the default, and that is just as much "no provider".
  if (!context) throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
