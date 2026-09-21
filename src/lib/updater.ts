/**
 * Update checking, prompting and installation.
 *
 * One entry point (`checkForUpdates`) behind three doors: the post-startup check
 * in `useAutoUpdater`, the application menu, and the `check-for-updates` command in
 * the palette. They must agree on what a pending update is, so nothing here may
 * install or restart without the user asking for it — an update that lands while
 * the user is mid-edit is data loss, not convenience.
 */
import {
  check,
  type DownloadEvent,
  type Update,
} from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { toast } from 'sonner'
import i18n from '@/i18n/config'
import { logger } from '@/lib/logger'

const t = i18n.t.bind(i18n)

type UpdateCheckResult = 'up-to-date' | 'available' | 'failed'

/** Re-using one toast id means a repeated check replaces the prompt instead of stacking it. */
const AVAILABLE_TOAST_ID = 'update-available'

let pendingUpdate: Update | null = null
let installInFlight = false

function logDownloadEvent(event: DownloadEvent): void {
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
}

/**
 * Ask the update endpoint what is available and offer it to the user.
 *
 * `interactive` marks a request the user made (menu, palette): those answer even
 * when nothing is wrong, and report failures loudly. The startup check stays quiet
 * on the network path, because offline launches are normal.
 */
export async function checkForUpdates({
  interactive = false,
}: { interactive?: boolean } = {}): Promise<UpdateCheckResult> {
  try {
    const update = await check()

    if (!update) {
      if (interactive) {
        toast.success(t('updater.upToDate', { version: __APP_VERSION__ }))
      }
      return 'up-to-date'
    }

    pendingUpdate = update
    logger.info('Update available', { version: update.version })
    toast.info(t('updater.available', { version: update.version }), {
      id: AVAILABLE_TOAST_ID,
      duration: 0,
      description: update.body?.trim() || undefined,
      action: {
        label: t('updater.install'),
        onClick: () => void installPendingUpdate(),
      },
      cancel: {
        label: t('updater.later'),
        onClick: () => toast.dismiss(AVAILABLE_TOAST_ID),
      },
    })
    return 'available'
  } catch (error) {
    if (interactive) {
      logger.error('Update check failed', { error: String(error) })
      toast.error(t('updater.checkFailed'))
    } else {
      logger.debug('Update check failed (network unavailable?)', {
        error: String(error),
      })
    }
    return 'failed'
  }
}

/**
 * Install whatever `checkForUpdates` last offered.
 *
 * Platform asymmetry worth knowing before reading the success path: on Windows the
 * installer takes the process down as part of `downloadAndInstall()`, so the
 * "restart now" toast is really a macOS/Linux affordance.
 */
export async function installPendingUpdate(): Promise<boolean> {
  const update = pendingUpdate
  if (!update || installInFlight) return false

  installInFlight = true
  const toastId = toast.loading(
    t('updater.installing', { version: update.version })
  )

  try {
    await update.downloadAndInstall(logDownloadEvent)
    pendingUpdate = null
    logger.info('Update installed successfully, awaiting restart', {
      version: update.version,
    })
    toast.success(t('updater.installed', { version: update.version }), {
      id: toastId,
      duration: 0,
      action: {
        label: t('updater.restart'),
        onClick: () => void relaunch(),
      },
    })
    return true
  } catch (error) {
    logger.error('Update installation failed', { error: String(error) })
    toast.error(t('updater.installFailed'), {
      id: toastId,
      description: String(error),
    })
    return false
  } finally {
    installInFlight = false
  }
}

/**
 * Module state outlives a single test unless a caller empties it, the same way the
 * command registry does.
 */
export function resetUpdater(): void {
  pendingUpdate = null
  installInFlight = false
  toast.dismiss(AVAILABLE_TOAST_ID)
}
