import { useTranslation } from 'react-i18next'
import { locale } from '@tauri-apps/plugin-os'
import { emit } from '@tauri-apps/api/event'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTheme } from '@/hooks/use-theme'
import { SettingsField, SettingsSection } from '../shared/SettingsComponents'
import { preferencePatches } from '@/lib/preference-patches'
import { usePatchPreferences, usePreferences } from '@/queries/preferences'
import { availableLanguages, loadLanguageAsync } from '@/i18n'
import { logger } from '@/lib/logger'

// Language display names (native names)
const languageNames: Record<string, string> = {
  en: 'English',
  zh: '中文',
}

export function AppearancePane() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { data: preferences } = usePreferences()
  const patchPreferences = usePatchPreferences()

  const handleThemeChange = (value: 'light' | 'dark' | 'system') => {
    // Update the theme provider immediately for instant UI feedback
    setTheme(value)

    // Persist only the theme; the backend merges it into whatever is on disk now,
    // so this write cannot revert a field another pane changed in the meantime.
    patchPreferences.mutate([preferencePatches.theme(value)])
  }

  const handleLanguageChange = async (value: string) => {
    const language = value === 'system' ? null : value
    let resolvedLanguage = 'en'

    try {
      // Load the language bundle first (lazy-loaded via dynamic import)
      // so translations are available before changeLanguage triggers re-render
      if (language) {
        await loadLanguageAsync(language)
        await i18n.changeLanguage(language)
        resolvedLanguage = language
      } else {
        // System language selected - detect and apply system locale
        const systemLocale = await locale()
        const langCode = systemLocale?.split('-')[0]?.toLowerCase() ?? 'en'
        resolvedLanguage = availableLanguages.includes(langCode)
          ? langCode
          : 'en'
        await loadLanguageAsync(resolvedLanguage)
        await i18n.changeLanguage(resolvedLanguage)
      }
    } catch (error) {
      logger.error('Failed to change language', { error })
      toast.error(t('toast.error.generic'))
      return
    }

    // Each window has its own i18n instance, so switching here leaves the quick
    // pane showing its old language until it is told. Same shape as theme-changed.
    void emit('language-changed', { language: resolvedLanguage })

    // Persist the language choice — `null` here means "follow the system locale",
    // which is a value the user picked, not an absent field.
    patchPreferences.mutate([preferencePatches.language(language)])
  }

  // Determine the current language value for the select
  const currentLanguageValue = preferences?.language ?? 'system'

  return (
    <div className="space-y-6">
      <SettingsSection title={t('preferences.appearance.language')}>
        <SettingsField
          label={t('preferences.appearance.language')}
          description={t('preferences.appearance.languageDescription')}
        >
          <Select
            value={currentLanguageValue}
            onValueChange={handleLanguageChange}
            disabled={patchPreferences.isPending}
          >
            <SelectTrigger aria-label={t('preferences.appearance.language')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">
                {t('preferences.appearance.language.system')}
              </SelectItem>
              {availableLanguages.map(lang => (
                <SelectItem key={lang} value={lang}>
                  {languageNames[lang] ?? lang}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>
      </SettingsSection>

      <SettingsSection title={t('preferences.appearance.theme')}>
        <SettingsField
          label={t('preferences.appearance.colorTheme')}
          description={t('preferences.appearance.colorThemeDescription')}
        >
          <Select
            value={theme}
            onValueChange={handleThemeChange}
            disabled={patchPreferences.isPending}
          >
            <SelectTrigger aria-label={t('preferences.appearance.colorTheme')}>
              <SelectValue
                placeholder={t('preferences.appearance.selectTheme')}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">
                {t('preferences.appearance.theme.light')}
              </SelectItem>
              <SelectItem value="dark">
                {t('preferences.appearance.theme.dark')}
              </SelectItem>
              <SelectItem value="system">
                {t('preferences.appearance.theme.system')}
              </SelectItem>
            </SelectContent>
          </Select>
        </SettingsField>
      </SettingsSection>
    </div>
  )
}
