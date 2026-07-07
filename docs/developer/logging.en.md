# Logging

**[English](logging.en.md)** | [中文](logging.zh.md)

This project has **three logging mechanisms**, each with a single, non-overlapping
responsibility. Together they cover the Rust backend, the TypeScript frontend,
and remote aggregation without duplicating output.

| Mechanism                                                   | Language              | Dev destination            | Prod destination                    | Purpose                                                           |
| ----------------------------------------------------------- | --------------------- | -------------------------- | ----------------------------------- | ----------------------------------------------------------------- |
| **Custom Logger** (`src/lib/logger.ts`)                     | TypeScript (frontend) | Browser console            | **Sentry Logs** via `Sentry.logger` | Ergonomic frontend logging with levels & context                  |
| **Sentry SDK** (`@sentry/react`, `src/lib/sentry.ts`)       | TypeScript (frontend) | — (buffered until consent) | Self-hosted Sentry                  | Remote error & log aggregation, tracing, replay                   |
| **`tauri-plugin-log`** (Rust, `src-tauri/Cargo.toml`)       | Rust (backend)        | stdout + webview console   | stdout + app log directory          | Rust-side structured logging                                      |
| **Sentry `log` integration** (`sentry` crate, `Cargo.toml`) | Rust (backend)        | — (buffered until consent) | **Sentry Breadcrumbs + Logs**       | Rust `log::*` calls become Sentry breadcrumbs and structured logs |

### How they fit together

- The **Custom Logger** is the single entry point for frontend JS code. In
  development it writes to the browser console for fast local iteration. In
  production it forwards to `Sentry.logger` so frontend logs land in the same
  Sentry dashboard as captured errors and traces — no separate backend round-trip.
- The **Sentry SDK** captures errors, performance traces, session replays, and
  (via `enableLogs: true`) structured logs. It is the _consumer_ of the custom
  logger's production output, not a competing logger. Events are only sent after
  the user grants consent (`setSentryConsent(true)`); see
  [error-handling.en.md](./error-handling.en.md).
- **`tauri-plugin-log`** handles the Rust backend only. Rust logs are forwarded
  to the webview console in dev (so backend output appears in DevTools) and to a
  platform-specific log file in production.
- **Sentry `log` integration** (`sentry` crate with `"log"` and `"logs"` features)
  automatically bridges all `log::*` calls in Rust to Sentry. Each `log::info!`
  call becomes both a breadcrumb (visible in error events) and a structured log
  entry in Sentry's Logs product. This is configured in `Cargo.toml`:
  `sentry = { version = "0.48", features = ["log", "logs"] }`.

> **Why not `@tauri-apps/plugin-log` on the frontend?**
> The frontend no longer wraps `@tauri-apps/plugin-log`. Routing frontend logs
> through Tauri would duplicate effort (the Rust plugin already owns backend
> logging) and add an unnecessary IPC hop. Instead, frontend logs go directly to
> Sentry Logs in production, keeping the data flow linear:
> `logger → Sentry.logger → self-hosted Sentry`.

## Quick Start

### Rust (Backend)

```rust
log::info!("Application starting up");
log::debug!("Debug info: {}", some_value);
log::warn!("Something unexpected happened");
log::error!("Error occurred: {}", error);
```

### TypeScript (Frontend)

```typescript
import { logger } from '@/lib/logger'

logger.info('User action completed')
logger.debug('Debug data', { userId: 123, action: 'click' })
logger.warn('Performance warning')
logger.error('Request failed', { error: response.error })
```

- In **development** these calls print to the browser console with a
  `[timestamp] [LEVEL]` prefix.
- In **production** they are forwarded to `Sentry.logger` (structured logs in the
  self-hosted Sentry dashboard). Console output is suppressed.

## Configuration

### Rust Backend

- Uses `tauri-plugin-log` with the standard Rust `log` crate
- **Development**: Debug level, logs to stdout + webview console
- **Production**: Info level, logs to stdout + app log directory
- Configuration in `src-tauri/src/lib.rs`

### TypeScript Frontend (Custom Logger)

- **Development**: All logs go to the browser console (with timestamp + level prefix)
- **Production**: Logs are forwarded to Sentry Logs via `Sentry.logger`
- Logger utility at `src/lib/logger.ts`
- The logger imports `@sentry/react` directly (not `@/lib/sentry`) to avoid a
  circular dependency — `sentry.ts` depends on `@/lib/tauri-bindings`, while
  `logger.ts` stays free of Tauri coupling

### Sentry SDK (Remote Aggregation)

- Initialized in `src/lib/sentry.ts` → `initSentry()`
- `enableLogs: true` enables structured log ingestion (`Sentry.logger.*`)
- Events (errors, logs, traces, replays) are buffered until the user grants
  consent via `setSentryConsent(true)` (the `beforeSend` gate drops everything
  beforehand)
- DSN is configured via `VITE_SENTRY_DSN` environment variable
- `@sentry/vite-plugin` (in `vite.config.ts`) automatically uploads source maps
  to Sentry during production builds, enabling minified-to-source stack traces
- Anonymous user ID (`crypto.randomUUID()` in localStorage) is set on consent
  grant, allowing Sentry to group events by device without collecting PII

## Log Levels

| Level   | When to Use            | Dev (console) | Prod (Sentry Logs) |
| ------- | ---------------------- | ------------- | ------------------ |
| `trace` | Most verbose debugging | Yes           | Yes                |
| `debug` | Development debugging  | Yes           | Yes                |
| `info`  | General information    | Yes           | Yes                |
| `warn`  | Warning conditions     | Yes           | Yes                |
| `error` | Error conditions       | Yes           | Yes                |

> In production all levels are forwarded to Sentry Logs. Use the Sentry dashboard
> to filter by level — do not rely on suppressing logs client-side in production.

## Where Logs Appear

### Development

- **Rust**: Terminal (stdout) + Browser DevTools console (webview target)
- **TypeScript**: Browser DevTools console (via the custom logger)
- **Sentry**: SDK is initialized but events are buffered (consent gate); local
  debugging is unaffected

### Production

- **Rust**: Terminal (stdout) + log file in the app log directory
- **TypeScript**: Sentry Logs dashboard (via `Sentry.logger`); browser console
  output is suppressed
- **Sentry**: Errors, logs, traces, and replays are sent after consent

Log directory locations vary by platform (e.g., `~/Library/Logs/` on macOS).

## Examples

### Rust Tauri Commands

```rust
#[tauri::command]
async fn save_data(data: MyData) -> Result<(), String> {
    log::info!("Saving data for user: {}", data.user_id);

    match save_to_disk(&data).await {
        Ok(_) => {
            log::info!("Data saved successfully");
            Ok(())
        }
        Err(e) => {
            log::error!("Failed to save data: {}", e);
            Err(format!("Save failed: {}", e))
        }
    }
}
```

### TypeScript React Components

```typescript
import { logger } from '@/lib/logger'

function MyComponent() {
  const handleClick = () => {
    logger.debug('Button clicked', { component: 'MyComponent' })

    try {
      performAction()
      logger.info('Action completed successfully')
    } catch (error) {
      logger.error('Action failed', { error })
    }
  }

  return <button onClick={handleClick}>Click me</button>
}
```

## Best Practices

1. **Use the custom logger, not `console.*` directly** — `console.log` bypasses
   the level/prefix logic and will not be forwarded to Sentry in production.
2. **Use appropriate log levels** — Don't log everything as `info`.
3. **Include context** — Add relevant data to help debugging; the `context`
   argument becomes Sentry log attributes.
4. **Log errors with details** — Include error messages and context.
5. **Keep messages concise** — But descriptive enough to be useful.
6. **No sensitive data** — Passwords, tokens, and PII must never be logged (they
   would end up in the Sentry dashboard).

See [error-handling.en.md](./error-handling.en.md) for patterns on when to log vs show errors to users.

## Production Considerations

- Rust logs go to the app's log directory (platform-specific location) via
  `tauri-plugin-log`, which supports log rotation when files reach size limits.
- Frontend logs are forwarded to Sentry Logs — they do not stay in the browser.
- Sentry events (including logs) are only sent after the user grants consent;
  before that, events are captured but dropped by the `beforeSend` gate.
- No sensitive data should be logged (passwords, tokens, etc.) — all production
  frontend logs are transmitted to the self-hosted Sentry instance.
