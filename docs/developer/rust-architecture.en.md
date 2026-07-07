# Rust Architecture

**[English](rust-architecture.en.md)** | [中文](rust-architecture.zh.md)

Module organization and patterns for the Tauri backend.

## Module Structure

```
src-tauri/src/
├── main.rs              # Entry point (just calls lib::run())
├── lib.rs               # App setup, plugin registration, run() entry
├── bindings.rs          # tauri-specta command registration + TS export
├── error.rs             # AppError enum with 10 variants + error_code()
├── types.rs             # Shared types: AppPreferences, CrashReportData, RecoveryError
├── commands/            # Command handlers by domain
│   ├── mod.rs           # Re-exports all command modules
│   ├── preferences.rs   # greet, loadPreferences, savePreferences
│   ├── notifications.rs # sendNativeNotification
│   ├── quick_pane.rs    # Quick pane show/dismiss/toggle + shortcut management
│   ├── recovery.rs      # Emergency data save/load/cleanup
│   ├── tray.rs          # Tray icon state, window-to-tray positioning
│   └── crash_report.rs  # Crash report read/delete, Sentry consent
└── utils/               # Utility modules
    ├── mod.rs
    ├── paths.rs         # App data directory path resolution
    ├── platform.rs      # Platform-specific helpers
    └── redact.rs        # Sensitive data redaction (api_key, token, etc.)
```

**Rust edition**: 2024, **MSRV**: 1.93 (see `rust-toolchain.toml`).

## Adding New Commands

### 1. Create or update a command module

```rust
// src-tauri/src/commands/my_feature.rs
use tauri::AppHandle;
use crate::error::AppError;

/// Brief description of what this command does.
#[tauri::command]
#[specta::specta]
pub async fn my_command(app: AppHandle, input: String) -> Result<String, AppError> {
    // Implementation
    Ok(format!("Processed: {input}"))
}
```

For testability, extract a generic implementation function and have the `#[tauri::command]`
function delegate to it. See existing commands (e.g., `preferences.rs`) for the pattern.

### 2. Export from commands/mod.rs

```rust
pub mod my_feature;
```

### 3. Register in bindings.rs

```rust
pub fn generate_bindings() -> Builder<tauri::Wry> {
    use crate::commands::{my_feature, /* ... */};

    Builder::<tauri::Wry>::new().commands(collect_commands![
        my_feature::my_command,
        // ... other commands
    ])
}
```

### 4. Regenerate TypeScript bindings

```bash
npm run rust:bindings
```

## Type Patterns

### Shared Types (types.rs)

Types shared between commands go in `types.rs`:

```rust
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MyData {
    pub field: String,
}
```

**Note:** `#[derive(Type)]` from specta is required for TypeScript generation.

### Error Types

This project uses `AppError` (in `error.rs`) with 10 variants and `RecoveryError` (in `types.rs`) with 5 variants:

```rust
// src-tauri/src/error.rs
#[derive(Debug, Clone, thiserror::Error, serde::Serialize, Type)]
#[serde(tag = "kind", content = "message")]
pub enum AppError {
    Io(String),
    Serialization(String),
    Path(String),
    Validation(String),
    NotFound(String),
    TaskJoin(String),
    Tray(String),
    QuickPane(String),
    Notification(String),
    Window(String),
}
```

The `#[serde(tag = "kind", content = "message")]` creates a TypeScript discriminated union:

```typescript
if (error.kind === 'Validation') {
  console.log(error.message) // string
}
```

Each variant also has a stable error code via `error_code()` (e.g., `ERR_IO`, `ERR_VALIDATION`),
mirrored in `src/lib/error-codes.ts` for frontend matching.

### Validation Functions

Keep validation in `types.rs` for reuse:

```rust
pub fn validate_input(input: &str) -> Result<(), String> {
    if input.is_empty() {
        return Err("Input cannot be empty".to_string());
    }
    Ok(())
}
```

## Platform-Specific Code

Use conditional compilation for platform-specific behavior:

```rust
#[cfg(target_os = "macos")]
fn macos_specific() { /* ... */ }

#[cfg(desktop)]
fn desktop_only() { /* ... */ }

#[cfg(not(target_os = "linux"))]
fn non_linux() { /* ... */ }
```

Platform utilities live in `utils/platform.rs`.

## Plugin Registration (lib.rs)

Plugins are registered in `lib.rs` during app setup:

```rust
// Desktop-only plugins
#[cfg(desktop)]
{
    app_builder = app_builder.plugin(tauri_plugin_window_state::Builder::new().build());
}

// All platforms
app_builder = app_builder
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
```

**Order matters:** Single-instance plugin must be registered first.

## Conventions

| Pattern           | Example                                                                          |
| ----------------- | -------------------------------------------------------------------------------- |
| Command naming    | `snake_case` (`load_preferences`, not `loadPreferences`)                         |
| Error returns     | `Result<T, AppError>` for most commands, `Result<T, RecoveryError>` for recovery |
| Logging           | Use `log::info!`, `log::debug!`, etc.                                            |
| String formatting | `format!("{variable}")` not `format!("{}", variable)`                            |
| App handle        | Pass `AppHandle` not `Window` when possible                                      |

## Expanding This Architecture

When adding new features:

1. **New command domain?** Create new file in `commands/`
2. **New shared types?** Add to `types.rs`
3. **Platform-specific utils?** Add to `utils/platform.rs`
4. **New plugin?** Register in `lib.rs` setup
