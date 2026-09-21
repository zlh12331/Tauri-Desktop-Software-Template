import { useEffect } from 'react'
import { checkForUpdates } from '@/lib/updater'

/**
 * Runs the startup update check.
 *
 * The 5 second delay keeps the request off the critical path of window creation.
 * Everything after that — what the user is told, and that nothing installs without
 * a click — lives in `@/lib/updater`, shared with the menu and the command palette.
 */
export function useAutoUpdater(): void {
  useEffect(() => {
    const updateTimer = setTimeout(() => void checkForUpdates(), 5000)
    return () => clearTimeout(updateTimer)
  }, [])
}
