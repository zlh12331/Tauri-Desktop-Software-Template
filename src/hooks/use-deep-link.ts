import { useEffect } from 'react'
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link'
import { useDialogStore } from '@/store/dialog-store'
import { logger } from '@/lib/logger'

/** Supported deep link routes mapped to UI actions. */
type DeepLinkRoute = 'preferences' | 'command-palette'

/**
 * Parse a deep link URL and extract the route.
 *
 * Custom URL schemes like `tauri-app://preferences` place the route in the
 * hostname rather than the pathname, so we strip the scheme prefix and
 * extract the first path segment for robustness.
 *
 * @returns The matched route, or null if the URL is unrecognized.
 *
 * @example
 * parseDeepLinkUrl('tauri-app://preferences')      // → 'preferences'
 * parseDeepLinkUrl('tauri-app://preferences/')     // → 'preferences'
 * parseDeepLinkUrl('tauri-app://command-palette')  // → 'command-palette'
 * parseDeepLinkUrl('tauri-app://unknown')          // → null
 */
function parseDeepLinkUrl(url: string): DeepLinkRoute | null {
  // Strip scheme prefix (e.g. "tauri-app://preferences/" → "preferences/")
  const withoutScheme = url.replace(/^[^:]+:\/\/?/, '')
  // Extract first path segment (e.g. "preferences/" → "preferences")
  const route = withoutScheme.split('/')[0]
  if (route === 'preferences' || route === 'command-palette') {
    return route
  }
  if (route) {
    logger.warn('Unknown deep link route', { url, route })
  }
  return null
}

/** Navigate to the given route by updating the dialog store. */
function navigateToRoute(route: DeepLinkRoute): void {
  const { setPreferencesOpen, setCommandPaletteOpen } =
    useDialogStore.getState()
  switch (route) {
    case 'preferences':
      setPreferencesOpen(true)
      break
    case 'command-palette':
      setCommandPaletteOpen(true)
      break
  }
}

/**
 * Deep link hook — listens for `tauri-app://` URLs and navigates accordingly.
 *
 * On mount:
 * 1. Checks if the app was opened via a deep link (`getCurrent`)
 * 2. Registers an `onOpenUrl` listener for future deep link events
 *
 * The Rust backend handles showing/focusing the main window; this hook
 * handles the frontend navigation side by updating the Zustand dialog store.
 *
 * Supported routes:
 * - `tauri-app://preferences` → opens the preferences dialog
 * - `tauri-app://command-palette` → opens the command palette
 */
export function useDeepLink(): void {
  useEffect(() => {
    let unlisten: (() => void) | undefined

    void (async () => {
      // Check if the app was started via a deep link
      try {
        const startUrls = await getCurrent()
        const firstUrl = startUrls?.[0]
        if (firstUrl) {
          const route = parseDeepLinkUrl(firstUrl)
          if (route) {
            navigateToRoute(route)
          }
        }
      } catch (error) {
        logger.warn('Failed to get initial deep link', { error })
      }

      // Listen for future deep link events
      try {
        unlisten = await onOpenUrl(urls => {
          for (const url of urls) {
            const route = parseDeepLinkUrl(url)
            if (route) {
              navigateToRoute(route)
            }
          }
        })
      } catch (error) {
        logger.warn('Failed to register deep link listener', { error })
      }
    })()

    return () => {
      unlisten?.()
    }
  }, [])
}
