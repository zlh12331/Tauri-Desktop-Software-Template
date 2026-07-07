import { useEffect } from 'react'
import { commands } from '@/lib/tauri-bindings'
import { isSentryEnabled, setSentryConsent } from '@/lib/sentry'
import {
  useCrashReportStore,
  type CrashReportState,
} from '@/store/crash-report-store'
import { logger } from '@/lib/logger'

/**
 * useCrashReporting — Manages Sentry consent and Rust crash report handling.
 *
 * Sentry is initialized early in main.tsx (before React renders) so that
 * startup errors are captured. This hook controls the consent gate:
 *
 * Flow:
 * 1. If DSN is not configured → clean up any crash files, skip
 * 2. Load preferences → check crash_reporting_consent
 * 3. If consent is true  → setSentryConsent(true) — events start sending
 * 4. If consent is false → setSentryConsent(false) — events are dropped
 * 5. If consent is null   → leave gate closed, show dialog if crash exists
 * 6. Check for Rust crash file (from backend panic hook):
 *    - Crash exists + consent true  → delete file (Rust Sentry already sent it)
 *    - Crash exists + consent null  → show consent dialog with crash details
 *    - Crash exists + consent false → delete file silently
 *
 * Note: When consent is true, the Rust Sentry SDK's `before_send` gate was
 * already open (initialized from preferences in setup()), so the panic event
 * was sent immediately at crash time. The frontend does NOT need to re-send
 * it via captureMessage — doing so would create a duplicate.
 */
export function useCrashReporting(): void {
  const setCrashReportDialogOpen = useCrashReportStore(
    (state: CrashReportState) => state.setCrashReportDialogOpen
  )
  const setPendingCrashReport = useCrashReportStore(
    (state: CrashReportState) => state.setPendingCrashReport
  )

  useEffect(() => {
    void (async () => {
      // If DSN is not configured, crash reporting is unavailable
      if (!isSentryEnabled()) {
        // Clean up any existing crash files from previous sessions
        try {
          await commands.deleteCrashReport()
        } catch {
          // Ignore errors — file may not exist
        }
        return
      }

      // 1. Load preferences to check consent
      let consent: boolean | null = null
      try {
        const result = await commands.loadPreferences()
        if (result.status === 'ok') {
          consent = result.data.crash_reporting_consent
        }
      } catch (error) {
        logger.warn('Failed to load preferences for crash reporting', {
          error,
        })
      }

      // 2. Apply consent to Sentry's beforeSend gate.
      //    Sentry is already initialized (in main.tsx), so we only need
      //    to open or close the event submission gate.
      if (consent === true) {
        setSentryConsent(true)
      } else if (consent === false) {
        setSentryConsent(false)
      }
      // consent === null → leave gate closed, wait for dialog

      // 3. Check for Rust crash file (written by panic hook)
      try {
        const crashResult = await commands.readCrashReport()
        if (crashResult.status === 'ok' && crashResult.data) {
          const crashData = crashResult.data

          if (consent === true) {
            // Consent already given — Rust Sentry already sent the panic
            // event at crash time (CONSENT_STATE was initialized from
            // preferences in setup()). Just delete the crash file.
            await commands.deleteCrashReport()
            logger.info(
              'Crash file deleted (Rust Sentry already sent the event)'
            )
          } else if (consent === null) {
            // Consent not yet asked — show dialog with crash details.
            // Rust Sentry dropped the event (consent was null at crash time),
            // so the CrashReportDialog will send it via captureMessage if
            // the user grants consent.
            setPendingCrashReport(crashData)
            setCrashReportDialogOpen(true)
            logger.info('Crash report pending — showing consent dialog')
          } else {
            // Consent denied — delete silently
            await commands.deleteCrashReport()
            logger.debug('Crash report deleted (consent denied)')
          }
        }
      } catch (error) {
        logger.warn('Failed to check crash report', { error })
      }
    })()
  }, [setCrashReportDialogOpen, setPendingCrashReport])
}
