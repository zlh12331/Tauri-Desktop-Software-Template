/**
 * Re-export generated Tauri bindings with project conventions
 *
 * This file provides type-safe access to all Tauri commands.
 * Types are auto-generated from Rust by tauri-specta.
 *
 * @example
 * ```typescript
 * import { commands } from '@/lib/tauri-bindings'
 *
 * // In event handlers - explicit error handling
 * const result = await commands.applyPreferencePatches([
 *   { Theme: { value: 'dark' } },
 * ])
 * if (result.status === 'error') {
 *   toast.error(result.error.message)
 * }
 * ```
 *
 * Preferences change one field at a time: `savePreferences` rewrites the whole
 * document, so a stale copy reverts whatever another writer saved in the
 * meantime. Use `preferencePatches` from `@/lib/preference-patches`.
 *
 * @see docs/developer/tauri-commands.en.md for full documentation
 */

export { commands } from './bindings'
export type {
  AppError,
  AppPreferences,
  CrashReportData,
  PreferencePatch,
  RecoveryError,
  TrayIconState,
  TrayPosition,
} from './bindings'
