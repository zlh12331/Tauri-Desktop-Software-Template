import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../../locales/en.json'

/**
 * i18n configuration with lazy loading.
 *
 * The default language (en) is loaded synchronously to avoid first-paint
 * flash. Other languages are loaded on-demand via dynamic `import()`,
 * keeping them out of the main bundle.
 *
 * Call `loadLanguageAsync(lng)` before `i18n.changeLanguage(lng)` to
 * ensure resources are available.
 */

// RTL language detection (includes languages not yet in resources for future expansion)
const rtlLanguages = ['ar', 'he', 'fa', 'ur']

// Static list of all supported languages (does not depend on loaded resources).
// Update this array when adding a new locale file.
const supportedLanguages = ['en', 'zh'] as const

i18n.use(initReactI18next).init({
  // Only bundle the default language synchronously; others are added lazily.
  resources: {
    en: { translation: en },
  },
  lng: 'en',
  fallbackLng: 'en',

  // Allow partially loaded languages — i18next will use fallback for
  // missing keys until the lazy-loaded bundle arrives.
  partialBundledLanguages: true,

  interpolation: {
    escapeValue: false, // React already escapes
  },
})

// Update document direction and lang on language change
i18n.on('languageChanged', lng => {
  const dir = rtlLanguages.includes(lng) ? 'rtl' : 'ltr'
  document.documentElement.dir = dir
  document.documentElement.lang = lng
})

export default i18n

// Export for use in non-React contexts (like menu building)
export { i18n }

/**
 * Lazily loads a language bundle if not already loaded.
 *
 * Uses Vite's dynamic `import()` so non-default languages are split into
 * separate chunks and only downloaded when needed.
 *
 * @returns A promise that resolves when the language is ready to use.
 */
export async function loadLanguageAsync(lng: string): Promise<void> {
  if (i18n.hasResourceBundle(lng, 'translation')) return
  if (!supportedLanguages.includes(lng as (typeof supportedLanguages)[number]))
    return

  try {
    const mod = await import(`../../locales/${lng}.json`)
    i18n.addResourceBundle(lng, 'translation', mod.default, true, true)
  } catch (error) {
    console.warn(`[i18n] Failed to lazy-load language "${lng}"`, error)
  }
}

// Helper to get available languages.
// Typed as `string[]` so callers can use `.includes(someString)` without
// TypeScript narrowing errors.
export const availableLanguages: string[] = [...supportedLanguages]

// Check if a language is RTL
export const isRTL = (lng: string): boolean => rtlLanguages.includes(lng)
