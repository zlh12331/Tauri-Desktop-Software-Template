import type { PreferencePatch } from '@/lib/tauri-bindings'

/**
 * The patch builders, so a call site names the field it owns and nothing else.
 *
 * `null` and "not passed" are different instructions here: `language: null` means
 * "follow the system locale", which is a choice the user makes. Writing a whole
 * `AppPreferences` document to change one field is what let a pane's stale cache
 * revert another writer's just-saved value — see
 * `src-tauri/tests/preferences_integration.rs`, which keeps that loss on record.
 *
 * Lives here rather than beside the query hooks because it has no runtime
 * dependencies: a component test can mock the hooks without losing the real
 * builders, so the payloads it asserts are the ones the backend understands.
 */
export const preferencePatches = {
  theme: (value: 'light' | 'dark' | 'system'): PreferencePatch => ({
    Theme: { value },
  }),
  language: (value: string | null): PreferencePatch => ({
    Language: { value },
  }),
  quickPaneShortcut: (value: string | null): PreferencePatch => ({
    QuickPaneShortcut: { value },
  }),
  crashReportingConsent: (value: boolean | null): PreferencePatch => ({
    CrashReportingConsent: { value },
  }),
}
