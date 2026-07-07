// Command system exports
export * from './registry'
import { navigationCommands } from './navigation-commands'
import { windowCommands } from './window-commands'
import { notificationCommands } from './notification-commands'
import { appCommands } from './app-commands'
import { registerCommands } from './registry'
import { logger } from '@/lib/logger'

/**
 * Initialize the command system by registering all commands.
 * This should be called once during app initialization.
 */
export function initializeCommandSystem(): void {
  registerCommands(navigationCommands)
  registerCommands(windowCommands)
  registerCommands(notificationCommands)
  registerCommands(appCommands)

  if (import.meta.env.DEV) {
    logger.debug('Command system initialized')
  }
}

export { navigationCommands, windowCommands, notificationCommands, appCommands }
