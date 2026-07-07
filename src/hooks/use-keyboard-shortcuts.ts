import { useEffect } from 'react'
import type { CommandContext } from '@/lib/commands/types'
import { executeCommand } from '@/lib/commands/registry'
import { logger } from '@/lib/logger'

/**
 * Handles global keyboard shortcuts for the application.
 *
 * All shortcuts route through the centralized command system via
 * `executeCommand()`, ensuring consistent behavior with the command
 * palette and menu items.
 *
 * Currently handles:
 * - Cmd/Ctrl+K : Toggle command palette
 * - Cmd/Ctrl+, : Open preferences
 * - Cmd/Ctrl+1 : Toggle left sidebar
 * - Cmd/Ctrl+2 : Toggle right sidebar
 */
export function useKeyboardShortcuts(commandContext: CommandContext) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        let commandId: string | null = null

        switch (e.key.toLowerCase()) {
          case 'k':
            commandId = 'toggle-command-palette'
            break
          case ',':
            commandId = 'open-preferences'
            break
          case '1':
            commandId = 'toggle-left-sidebar'
            break
          case '2':
            commandId = 'toggle-right-sidebar'
            break
        }

        if (commandId) {
          e.preventDefault()
          executeCommand(commandId, commandContext).then(result => {
            if (!result.success && result.error) {
              logger.warn('Keyboard shortcut command failed', {
                commandId,
                error: result.error,
              })
            }
          })
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [commandContext])
}
