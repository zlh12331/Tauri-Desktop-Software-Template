import type { LucideIcon } from 'lucide-react'
import type en from '../../../locales/en.json'

/**
 * Union of every flat key in `en.json` (the source of truth for i18n).
 *
 * Typing `labelKey`/`descriptionKey` with this union makes a typo a COMPILE
 * error — the compiler verifies the key exists, which covers the dynamic-key
 * gap that i18next-cli cannot see statically (runtime access via
 * `t(command.labelKey)`).
 */
export type TranslationKey = keyof typeof en

export interface AppCommand {
  id: string
  /** Translation key for the command label (e.g., 'commands.showLeftSidebar.label') */
  labelKey: TranslationKey
  /** Translation key for the command description (e.g., 'commands.showLeftSidebar.description') */
  descriptionKey?: TranslationKey
  icon?: LucideIcon
  group?: string
  keywords?: string[]
  execute: (context: CommandContext) => void | Promise<void>
  isAvailable?: (context: CommandContext) => boolean
  shortcut?: string
}

export interface CommandContext {
  // Preferences
  openPreferences: () => void

  // Notifications
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}
