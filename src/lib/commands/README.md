# Simplified Command System

A lightweight, extensible command system that enables consistent behavior across keyboard shortcuts, menus, and command palette.

## Architecture

**80/20 Approach**: Maximum extensibility with minimal complexity

1. **Command Definition**: Pure objects with predictable structure
2. **Command Context**: Essential actions commands need
3. **Command Registry**: Simple Map-based storage and execution

## Usage

### Using Commands in Components

```typescript
import { executeCommand } from '@/lib/commands/registry'
import { useCommandContext } from '@/hooks/use-command-context'

function MyComponent() {
  const context = useCommandContext()

  const handleButtonClick = () => {
    void executeCommand('toggle-left-sidebar', context)
  }

  return (
    <button onClick={handleButtonClick}>
      Toggle Left Sidebar
    </button>
  )
}
```

### Adding New Commands

1. **Create commands** (e.g., `my-feature-commands.ts`):

```typescript
import { useUIStore } from '@/store/ui-store'
import type { AppCommand } from '@/lib/commands/types'

export const myFeatureCommands: AppCommand[] = [
  {
    id: 'my-action',
    labelKey: 'commands.myAction.label',
    descriptionKey: 'commands.myAction.description', // optional
    icon: MyIcon, // optional Lucide icon
    group: 'my-group', // optional grouping
    keywords: ['my', 'action'], // optional search keywords
    shortcut: '⌘+Shift+M', // optional shortcut display

    execute: context => {
      // Direct store access using getState() pattern
      const currentState = useUIStore.getState()

      // Call actions: context.openPreferences()
      // Show feedback: context.showToast('Done!', 'success')
    },

    isAvailable: () => {
      // Optional availability check
      return useUIStore.getState().someCondition
    },
  },
]
```

2. **Register commands in `index.ts`**:

```typescript
import { registerCommands } from '@/lib/commands/registry'
import { navigationCommands } from './navigation-commands'
import { windowCommands } from './window-commands'
import { notificationCommands } from './notification-commands'
import { myFeatureCommands } from './my-feature-commands'

export function initializeCommandSystem(): void {
  registerCommands(navigationCommands)
  registerCommands(windowCommands)
  registerCommands(notificationCommands)
  registerCommands(myFeatureCommands) // Add here
}
```

3. **Update CommandContext if needed**:

If your commands need new actions, add them to:

- `CommandContext` interface in `@/lib/commands/types`
- `useCommandContext` hook in `@/hooks/use-command-context`

## Performance Patterns

### getState() Pattern in Commands

Commands use direct store access for optimal performance:

```typescript
execute: () => {
  // ✅ Good: Direct store access in commands
  const { leftSidebarVisible, toggleLeftSidebar } = useUIStore.getState()
  if (!leftSidebarVisible) {
    toggleLeftSidebar()
  }
}
```

### Minimal Context

Context only provides essential actions, no state subscriptions:

```typescript
// Only essential actions - no state values
export function useCommandContext(): CommandContext {
  const openPreferences = useUIStore(s => s.setPreferencesOpen)
  const showToast = useToast()
  return { openPreferences, showToast }
}
```

## Available Commands

### Navigation Commands

- `show-left-sidebar` - Show left sidebar (only when hidden)
- `hide-left-sidebar` - Hide left sidebar (only when visible)
- `show-right-sidebar` - Show right sidebar (only when hidden)
- `hide-right-sidebar` - Hide right sidebar (only when visible)
- `open-preferences` - Open preferences dialog
- `toggle-left-sidebar` - Toggle left sidebar (shortcut: ⌘+1)
- `toggle-right-sidebar` - Toggle right sidebar (shortcut: ⌘+2)

### Window Commands

- `window-fullscreen` - Enter fullscreen mode (shortcut: F11)
- `window-exit-fullscreen` - Exit fullscreen mode (shortcut: Escape)
- `window-minimize` - Minimize window (shortcut: ⌘+M)
- `window-close` - Close window (shortcut: ⌘+W)
- `window-toggle-maximize` - Toggle maximize state

### Notification Commands

- `notification.test-toast` - Show a test toast notification

## Command Structure

```typescript
interface AppCommand {
  id: string // Unique identifier
  labelKey: string // Translation key (e.g., 'commands.myAction.label')
  descriptionKey?: string // Optional translation key for description
  icon?: LucideIcon // Optional Lucide icon component
  group?: string // Optional grouping for command palette
  keywords?: string[] // Optional search keywords
  execute: (context) => void | Promise<void> // Execution function
  isAvailable?: (context) => boolean // Optional availability check
  shortcut?: string // Optional keyboard shortcut display
}
```

Labels use translation keys for runtime language switching. Add translations to `locales/*.json`.

## Routing

All user action entry points route through `executeCommand()`:

- **Keyboard shortcuts** (`use-keyboard-shortcuts.ts`): `executeCommand('toggle-left-sidebar', context)`
- **Menu items** (`menu.ts`): `executeCommand('open-preferences', context)`
- **Command palette**: Uses `getAllCommands()` + `executeCommand()`

This ensures `isAvailable` checks are always enforced and actions are consistent across all entry points.

### Result Shape

`executeCommand()` never throws. It resolves to a flat envelope:

```typescript
type CommandResult = { success: boolean; error?: string }
```

`error` is already a user-displayable string (`Command 'x' not found`,
`Command 'x' is not available`, or `Failed to execute command 'x': <message>`), so
entry points can hand it straight to a toast:

```typescript
const result = await executeCommand(commandId, context)
if (!result.success && result.error) {
  context.showToast(result.error, 'error') // CommandPalette.tsx, TitleBarContent.tsx
}
```

Do not confuse this with the Rust IPC envelope from `@/lib/tauri-bindings`, where
`result.error` is an `AppError` **object** and you need `result.error.message` /
`result.error.kind`. Some entry points ignore the envelope on purpose — `menu.ts`
calls `void executeCommand(...)`, and `MacOSWindowControls.tsx` awaits without
checking — because the window commands already toast their own failures from inside
`execute()`. See `docs/developer/error-handling.en.md` → Two Result Conventions.

## Key Simplifications

- ✅ **Registry**: Extensible Map-based storage
- ✅ **Test isolation**: `clearCommands()` empties that Map, which is module state and
  therefore survives between tests in the same file unless a `beforeEach` resets it
- ✅ **Performance**: Direct getState() access in commands
- ✅ **Essential Context**: Only actions, no state subscriptions
- ✅ **Routing**: All entry points (shortcuts, menu, palette) use executeCommand()
- ❌ **Removed**: Complex finding functions, hook wrappers, unused utilities
- ❌ **Removed**: Group-based organization (YAGNI)
- ❌ **Removed**: Over-abstracted availability patterns

This gives you **extensibility for teams** while keeping the **complexity minimal**.
