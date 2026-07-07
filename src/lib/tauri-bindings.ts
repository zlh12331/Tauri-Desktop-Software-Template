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
 * const result = await commands.savePreferences(prefs)
 * if (result.status === 'error') {
 *   toast.error(result.error.message)
 * }
 * ```
 *
 * @see docs/developer/tauri-commands.en.md for full documentation
 */

export { commands } from './bindings'
export type {
  AppError,
  AppPreferences,
  CrashReportData,
  RecoveryError,
  TrayIconState,
  TrayPosition,
} from './bindings'
