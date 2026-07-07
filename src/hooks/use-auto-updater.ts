import { useEffect } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { logger } from '@/lib/logger'

/**
 * Checks for application updates on a delayed timer after app startup.
 *
 * Flow:
 * 1. Wait 5 seconds after mount (avoid competing with startup I/O)
 * 2. Check for updates via the Tauri updater plugin
 * 3. If available, download and install silently
 * 4. Relaunch the app
 *
 * Network errors are silently ignored (common in dev / offline).
 * Installation errors are logged but do not disrupt the user.
 *
 * This hook does NOT show UI dialogs — the updater is designed to be
 * non-intrusive. If user-facing confirmation is needed, it should be
 * added via the app's dialog/toast system, not native confirm()/alert().
 */
export function useAutoUpdater(): void {
  useEffect(() => {
    // Cancellation guard — ensures async chains don't continue after unmount.
    // While this hook is used in the root component (never unmounts in
    // practice), the guard is defensive best practice.
    let cancelled = false

    const checkForUpdates = async () => {
      try {
        const update = await check()
        if (cancelled) return
        if (!update) return

        logger.info('Update available', { version: update.version })

        try {
          await update.downloadAndInstall(event => {
            switch (event.event) {
              case 'Started':
                logger.info('Update download started', {
                  contentLength: event.data.contentLength,
                })
                break
              case 'Progress':
                logger.debug('Update download progress', {
                  chunkLength: event.data.chunkLength,
                })
                break
              case 'Finished':
                logger.info('Update download complete, installing')
                break
            }
          })

          if (cancelled) return
          logger.info('Update installed successfully, relaunching')
          await relaunch()
        } catch (updateError) {
          if (cancelled) return
          logger.error('Update installation failed', {
            error: String(updateError),
          })
        }
      } catch (checkError) {
        // Silent fail for update checks — don't bother user with network issues
        if (cancelled) return
        logger.debug('Update check failed (network unavailable?)', {
          error: String(checkError),
        })
      }
    }

    // Check for updates 5 seconds after app loads
    const updateTimer = setTimeout(() => void checkForUpdates(), 5000)
    return () => {
      cancelled = true
      clearTimeout(updateTimer)
    }
  }, [])
}
