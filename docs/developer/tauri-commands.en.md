# Tauri Commands (tauri-specta)

**[English](tauri-commands.en.md)** | [中文](tauri-commands.zh.md)

Type-safe Tauri command bindings using [tauri-specta](https://github.com/specta-rs/tauri-specta).

## Overview

This app uses tauri-specta to generate TypeScript bindings from Rust commands, providing:

- **Compile-time type checking** - TypeScript catches errors before runtime
- **Auto-generated types** - No manual sync between Rust and TypeScript
- **IDE autocomplete** - Full IntelliSense for command names, parameters, and return types
- **Safe refactoring** - Rename commands safely across the stack

## Usage

### Calling Commands

```typescript
import { commands, type AppPreferences } from '@/lib/tauri-bindings'

// Commands return Result types for error handling
const result = await commands.loadPreferences()

if (result.status === 'ok') {
  console.log(result.data.theme) // Type-safe access
} else {
  console.error(result.error) // Type-safe error
}
```

### Result Type Pattern

Commands that can fail return a `Result<T, E>` type:

```typescript
type Result<T, E> = { status: 'ok'; data: T } | { status: 'error'; error: E }
```

See [error-handling.md](./error-handling.en.md) for comprehensive error handling patterns including structured error types, retry logic, and user feedback.

Handle both cases:

```typescript
const result = await commands.savePreferences({ theme: 'dark' })

if (result.status === 'error') {
  toast.error('Failed to save', { description: result.error })
  return
}

// result.data is available here
toast.success('Saved!')
```

### unwrapResult Helper

For cases where you want errors to propagate (throw) rather than handle them inline, use the `unwrapResult` helper:

```typescript
import { commands, unwrapResult } from '@/lib/tauri-bindings'

// Throws on error, returns data on success
const preferences = unwrapResult(await commands.loadPreferences())
```

**When to use each pattern:**

| Pattern          | Use When                                                        |
| ---------------- | --------------------------------------------------------------- |
| `unwrapResult`   | TanStack Query functions, errors should propagate to a boundary |
| Manual `if/else` | Event handlers, need explicit error handling (toasts, UI state) |

**TanStack Query example** (preferred pattern for data fetching):

```typescript
import { useQuery } from '@tanstack/react-query'
import { commands, unwrapResult } from '@/lib/tauri-bindings'

const { data, error } = useQuery({
  queryKey: ['preferences'],
  queryFn: async () => unwrapResult(await commands.loadPreferences()),
})
// TanStack Query handles the thrown error automatically
```

**Event handler example** (explicit error handling):

```typescript
const handleSave = async () => {
  const result = await commands.savePreferences(preferences)
  if (result.status === 'error') {
    toast.error('Failed to save', { description: result.error })
    return
  }
  toast.success('Preferences saved!')
}
```

## Adding New Commands

### 1. Define the Rust command

Create a new file in `src-tauri/src/commands/` or add to an existing module:

```rust
// src-tauri/src/commands/my_feature.rs
use tauri::AppHandle;
use crate::error::AppError;

/// Brief description of what this command does.
#[tauri::command]
#[specta::specta]
pub async fn my_new_command(app: AppHandle, arg: String) -> Result<MyType, AppError> {
    // implementation
    Ok(MyType { field: arg })
}
```

Use `AppError` (from `src-tauri/src/error.rs`) for typed errors. For recovery-specific
errors, use `RecoveryError` from `src-tauri/src/types.rs`.

### 2. Add Type derive to structs

```rust
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MyType {
    pub field: String,
}
```

### 3. Register in bindings.rs

```rust
// src-tauri/src/bindings.rs

pub fn generate_bindings() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![
        // ... existing commands
        crate::my_new_command,  // Add here
    ])
}
```

### 4. Regenerate TypeScript bindings

```bash
npm run rust:bindings
```

This runs `cargo test export_bindings -- --ignored` which generates `src/lib/bindings.ts`.

### 5. Use in frontend

```typescript
import { commands, type MyType } from '@/lib/tauri-bindings'

const result = await commands.myNewCommand('arg')
```

### 6. Commit both files

Always commit:

- Rust changes (`src-tauri/src/lib.rs`, `src-tauri/src/bindings.rs`)
- Generated TypeScript (`src/lib/bindings.ts`)

## File Structure

```
src-tauri/src/
├── lib.rs              # App setup, plugin registration, run() entry
├── bindings.rs         # tauri-specta command registration + TS export
├── error.rs            # AppError enum (10 variants, error_code() mapping)
├── types.rs            # Shared types: AppPreferences, CrashReportData, RecoveryError
├── commands/           # Command handlers by domain
│   ├── mod.rs
│   ├── preferences.rs  # greet, loadPreferences, savePreferences
│   ├── notifications.rs # sendNativeNotification
│   ├── recovery.rs     # saveEmergencyData, loadEmergencyData, cleanupOldRecoveryFiles
│   ├── quick_pane.rs   # showQuickPane, dismissQuickPane, toggleQuickPane, shortcut cmds
│   ├── tray.rs         # setTrayIconState, moveWindowToTray
│   └── crash_report.rs # readCrashReport, deleteCrashReport, setConsent
└── utils/              # Utility modules
    ├── mod.rs
    ├── paths.rs        # App data directory path resolution
    ├── platform.rs     # Platform-specific helpers
    └── redact.rs       # Sensitive data redaction

src/lib/
├── bindings.ts         # Generated (DO NOT EDIT)
└── tauri-bindings.ts   # Re-exports with project conventions
```

## Known Limitations

### String parameters for JSON data

Commands that accept arbitrary JSON (like `saveEmergencyData`) use `String` parameters
instead of `serde_json::Value` to avoid specta recursion issues. Pass pre-serialized JSON:

```typescript
const json = JSON.stringify({ key: 'value' })
await commands.saveEmergencyData('backup.json', json)
```

`loadEmergencyData` returns the raw JSON string, which you parse on the frontend:

```typescript
const result = await commands.loadEmergencyData('backup.json')
if (result.status === 'ok') {
  const data = JSON.parse(result.data)
}
```

### Bindings generated at runtime

TypeScript bindings are generated when the app runs in debug mode, or via:

```bash
npm run rust:bindings
```

This must be run after changing Rust commands.

## Testing

Mock the commands in tests:

```typescript
// src/test/setup.ts
vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    loadPreferences: vi
      .fn()
      .mockResolvedValue({ status: 'ok', data: { theme: 'system' } }),
    savePreferences: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    // ... other commands
  },
}))
```

## Available Commands

### Preferences

| Command           | Parameters                    | Returns                            | Description           |
| ----------------- | ----------------------------- | ---------------------------------- | --------------------- |
| `greet`           | `name: string`                | `Result<string, AppError>`         | Demo greeting command |
| `loadPreferences` | none                          | `Result<AppPreferences, AppError>` | Load app preferences  |
| `savePreferences` | `preferences: AppPreferences` | `Result<null, AppError>`           | Save app preferences  |

### Notifications

| Command                  | Parameters                            | Returns                  | Description         |
| ------------------------ | ------------------------------------- | ------------------------ | ------------------- |
| `sendNativeNotification` | `title: string, body: string \| null` | `Result<null, AppError>` | System notification |

### Emergency Recovery

| Command                   | Parameters                       | Returns                         | Description                             |
| ------------------------- | -------------------------------- | ------------------------------- | --------------------------------------- |
| `saveEmergencyData`       | `filename: string, data: string` | `Result<null, RecoveryError>`   | Save JSON recovery data                 |
| `loadEmergencyData`       | `filename: string`               | `Result<string, RecoveryError>` | Load JSON recovery data                 |
| `cleanupOldRecoveryFiles` | none                             | `Result<number, RecoveryError>` | Delete recovery files older than 7 days |

### Quick Pane

| Command                       | Parameters                 | Returns                  | Description                           |
| ----------------------------- | -------------------------- | ------------------------ | ------------------------------------- |
| `showQuickPane`               | none                       | `Result<null, AppError>` | Show and focus the quick pane window  |
| `dismissQuickPane`            | none                       | `Result<null, AppError>` | Hide the quick pane window            |
| `toggleQuickPane`             | none                       | `Result<null, AppError>` | Toggle quick pane visibility          |
| `getDefaultQuickPaneShortcut` | none                       | `string`                 | Get default shortcut string           |
| `updateQuickPaneShortcut`     | `shortcut: string \| null` | `Result<null, AppError>` | Update global shortcut (null = reset) |

### System Tray

| Command            | Parameters                                    | Returns                  | Description                               |
| ------------------ | --------------------------------------------- | ------------------------ | ----------------------------------------- |
| `setTrayIconState` | `state: TrayIconState`                        | `Result<null, AppError>` | Set tray icon state (Normal/Notification) |
| `moveWindowToTray` | `windowLabel: string, position: TrayPosition` | `Result<null, AppError>` | Move window relative to tray icon         |

### Crash Reporting

| Command             | Parameters                 | Returns                                     | Description                      |
| ------------------- | -------------------------- | ------------------------------------------- | -------------------------------- |
| `readCrashReport`   | none                       | `Result<CrashReportData \| null, AppError>` | Read local crash report file     |
| `deleteCrashReport` | none                       | `Result<null, AppError>`                    | Delete crash report (idempotent) |
| `setConsent`        | `consent: boolean \| null` | `Result<null, AppError>`                    | Set Sentry consent state         |

## Dependencies

```toml
# src-tauri/Cargo.toml
specta = { version = "=2.0.0-rc.25", features = ["derive", "serde_json"] }
tauri-specta = { version = "=2.0.0-rc.25", features = ["typescript"] }
specta-typescript = "=0.0.12"
```

Note: Using exact versions (`=`) during RC phase to prevent breaking changes.

## References

- [tauri-specta GitHub](https://github.com/specta-rs/tauri-specta)
- [Specta documentation](https://specta.dev/docs/tauri-specta/v2)
