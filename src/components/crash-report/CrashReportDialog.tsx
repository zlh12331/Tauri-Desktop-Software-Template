import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as Sentry from '@sentry/react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { commands } from '@/lib/tauri-bindings'
import { isSentryEnabled, setSentryConsent } from '@/lib/sentry'
import {
  useCrashReportStore,
  type CrashReportState,
} from '@/store/crash-report-store'
import { logger } from '@/lib/logger'

/**
 * CrashReportDialog — Consent dialog for crash reporting.
 *
 * Shown when:
 * - A Rust crash file is found on startup AND consent hasn't been asked yet
 *
 * Actions:
 * - "Send Report": Saves consent=true, initializes Sentry, sends crash, deletes file
 * - "Don't Send": Saves consent=false, deletes crash file
 *
 * If Sentry DSN is not configured, the dialog still shows (to inform the user
 * about the crash) but the "Send Report" button is disabled.
 */
export function CrashReportDialog() {
  const { t } = useTranslation()
  const open = useCrashReportStore(
    (state: CrashReportState) => state.crashReportDialogOpen
  )
  const setOpen = useCrashReportStore(
    (state: CrashReportState) => state.setCrashReportDialogOpen
  )
  const pendingCrashReport = useCrashReportStore(
    (state: CrashReportState) => state.pendingCrashReport
  )
  const setPendingCrashReport = useCrashReportStore(
    (state: CrashReportState) => state.setPendingCrashReport
  )
  const [handling, setHandling] = useState(false)

  const sentryConfigured = isSentryEnabled()

  const handleAllow = async () => {
    setHandling(true)
    try {
      // Save consent preference
      const loadResult = await commands.loadPreferences()
      if (loadResult.status === 'ok') {
        await commands.savePreferences({
          ...loadResult.data,
          crash_reporting_consent: true,
        })
      }

      // Open Sentry's consent gate — events start sending
      setSentryConsent(true)

      // Send pending crash report if available
      if (pendingCrashReport) {
        Sentry.captureMessage(
          `Rust panic: ${pendingCrashReport.message}`,
          'fatal'
        )
      }

      // Delete crash file
      await commands.deleteCrashReport()

      setPendingCrashReport(null)
      setOpen(false)
      toast.success(t('crashReport.consentGranted'))
    } catch (error) {
      logger.error('Failed to grant crash report consent', { error })
      toast.error(t('crashReport.consentError'))
    } finally {
      setHandling(false)
    }
  }

  const handleDeny = async () => {
    setHandling(true)
    try {
      // Save consent preference
      const loadResult = await commands.loadPreferences()
      if (loadResult.status === 'ok') {
        await commands.savePreferences({
          ...loadResult.data,
          crash_reporting_consent: false,
        })
      }

      // Delete crash file
      await commands.deleteCrashReport()

      setPendingCrashReport(null)
      setOpen(false)
    } catch (error) {
      logger.error('Failed to deny crash report consent', { error })
      toast.error(t('crashReport.consentError'))
    } finally {
      setHandling(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!handling) {
      setOpen(nextOpen)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('crashReport.title')}</DialogTitle>
          <DialogDescription>{t('crashReport.description')}</DialogDescription>
        </DialogHeader>

        {pendingCrashReport && (
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-sm font-medium">
              {t('crashReport.crashMessage')}
            </p>
            <p className="text-sm text-muted-foreground font-mono">
              {pendingCrashReport.message}
            </p>
            {pendingCrashReport.location && (
              <p className="text-xs text-muted-foreground">
                {pendingCrashReport.location}
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {t('crashReport.privacyNote')}
        </p>

        <DialogFooter>
          <Button variant="secondary" onClick={handleDeny} disabled={handling}>
            {t('crashReport.dontSend')}
          </Button>
          <Button
            onClick={handleAllow}
            disabled={handling || !sentryConfigured}
          >
            {t('crashReport.sendReport')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
