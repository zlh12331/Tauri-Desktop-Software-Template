import { Command } from 'lucide-react'
import { useDialogStore } from '@/store/dialog-store'
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
]
