import { Command, RefreshCw } from 'lucide-react'
import { useDialogStore } from '@/store/dialog-store'
import { checkForUpdates } from '@/lib/updater'
import type { AppCommand } from './types'

export const appCommands: AppCommand[] = [
  {
    id: 'toggle-command-palette',
    labelKey: 'commands.toggleCommandPalette.label',
    descriptionKey: 'commands.toggleCommandPalette.description',
    icon: Command,
    group: 'tools',
    shortcut: '⌘+K',
    keywords: ['command', 'palette', 'cmdk', 'k', 'toggle', 'open'],

    execute: () => {
      useDialogStore.getState().toggleCommandPalette()
    },
  },
  {
    id: 'check-for-updates',
    labelKey: 'commands.checkForUpdates.label',
    descriptionKey: 'commands.checkForUpdates.description',
    icon: RefreshCw,
    group: 'tools',
    keywords: ['update', 'upgrade', 'version', 'check'],

    // The prompt, install and restart steps live in @/lib/updater so this stays
    // the same door the menu item opens. Awaited rather than fired-and-forgotten
    // so the command bus sees the promise settle.
    execute: async () => {
      await checkForUpdates({ interactive: true })
    },
  },
]
