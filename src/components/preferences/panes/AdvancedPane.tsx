import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SettingsField, SettingsSection } from '../shared/SettingsComponents'
import { ApiConfigForm } from './ApiConfigForm'
import { commands } from '@/lib/tauri-bindings'
import { isSentryEnabled, setSentryConsent } from '@/lib/sentry'
import { logger } from '@/lib/logger'

export function AdvancedPane() {
  const { t } = useTranslation()
  // Example local state - these are NOT persisted to disk
  // To add persistent preferences:
  // 1. Add the field to AppPreferences in both Rust and TypeScript
  // 2. Use usePreferencesManager() and updatePreferences()
  const [exampleAdvancedToggle, setExampleAdvancedToggle] = useState(false)
  const [exampleDropdown, setExampleDropdown] = useState('option1')
  const [crashReportingEnabled, setCrashReportingEnabled] = useState(false)
  const sentryConfigured = isSentryEnabled()

  // Load crash reporting consent from persisted preferences
  useEffect(() => {
    void (async () => {
      try {
        const result = await commands.loadPreferences()
        if (result.status === 'ok') {
          setCrashReportingEnabled(result.data.crash_reporting_consent === true)
        }
      } catch (error) {
        logger.error('Failed to load crash reporting consent', { error })
      }
    })()
  }, [])

  const handleCrashReportingToggle = async (enabled: boolean) => {
    try {
      const loadResult = await commands.loadPreferences()
      if (loadResult.status === 'ok') {
        await commands.savePreferences({
          ...loadResult.data,
          crash_reporting_consent: enabled,
        })
      }
      setCrashReportingEnabled(enabled)
      if (enabled) {
        setSentryConsent(true)
        toast.success(t('preferences.advanced.crashReporting.enabled'))
      } else {
        setSentryConsent(false)
        toast.info(t('preferences.advanced.crashReporting.disabled'))
      }
    } catch (error) {
      logger.error('Failed to toggle crash reporting', { error })
      toast.error(t('preferences.advanced.crashReporting.toggleError'))
    }
  }

  return (
    <div className="space-y-6">
      <SettingsSection title={t('preferences.advanced.title')}>
        <SettingsField
          label={t('preferences.advanced.toggle')}
          description={t('preferences.advanced.toggleDescription')}
        >
          <div className="flex items-center space-x-2">
            <Switch
              id="example-advanced-toggle"
              checked={exampleAdvancedToggle}
              onCheckedChange={setExampleAdvancedToggle}
            />
            <Label htmlFor="example-advanced-toggle" className="text-sm">
              {exampleAdvancedToggle
                ? t('common.enabled')
                : t('common.disabled')}
            </Label>
          </div>
        </SettingsField>

        <SettingsField
          label={t('preferences.advanced.dropdown')}
          description={t('preferences.advanced.dropdownDescription')}
        >
          <Select value={exampleDropdown} onValueChange={setExampleDropdown}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="option1">
                {t('preferences.advanced.option1')}
              </SelectItem>
              <SelectItem value="option2">
                {t('preferences.advanced.option2')}
              </SelectItem>
              <SelectItem value="option3">
                {t('preferences.advanced.option3')}
              </SelectItem>
            </SelectContent>
          </Select>
        </SettingsField>
      </SettingsSection>

      <SettingsSection title={t('preferences.advanced.crashReporting.title')}>
        <SettingsField
          label={t('preferences.advanced.crashReporting.description')}
          description={t(
            'preferences.advanced.crashReporting.consentDescription'
          )}
        >
          <div className="flex items-center space-x-2">
            <Switch
              id="crash-reporting-toggle"
              checked={crashReportingEnabled}
              onCheckedChange={handleCrashReportingToggle}
              disabled={!sentryConfigured}
            />
            <Label htmlFor="crash-reporting-toggle" className="text-sm">
              {crashReportingEnabled
                ? t('common.enabled')
                : t('common.disabled')}
            </Label>
          </div>
        </SettingsField>
        {!sentryConfigured && (
          <p className="text-xs text-muted-foreground">
            {t('preferences.advanced.crashReporting.notConfigured')}
          </p>
        )}
      </SettingsSection>

      <ApiConfigForm />
    </div>
  )
}
