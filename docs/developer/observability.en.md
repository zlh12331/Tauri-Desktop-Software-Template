# Observability

**[English](observability.en.md)** | [中文](observability.zh.md)

How this template monitors application health, captures errors, and aggregates
logs. This document describes the built-in infrastructure and the extension
points for adding custom observability.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Self-hosted Sentry                    │
│  ┌──────────┐  ┌───────┐  ┌────────┐  ┌──────────────┐ │
│  │  Errors   │  │ Logs  │  │Traces  │  │Session Replay│ │
│  └────▲──────┘  └───▲───┘  └───▲────┘  └──────▲───────┘ │
│       │             │          │              │          │
└───────┼─────────────┼──────────┼──────────────┼──────────┘
        │             │          │              │
   beforeSend    Sentry.logger  Web Vitals    error-only replay
   consent gate   (frontend)   (auto)       (on unhandled error)
        │             │
   ┌────┴─────────────┴──────────────────────────────┐
   │              Frontend (React)                    │
   │  ErrorBoundary → sentry.ts → logger.ts          │
   └──────────────────────┬──────────────────────────┘
                          │
                     Tauri IPC
                          │
   ┌──────────────────────┴──────────────────────────┐
   │              Rust Backend                       │
   │  panic hook → crash_report.rs → sentry crate     │
   │  log::* → sentry breadcrumbs + structured logs   │
   │  configure_scope (app.name, os, version)       │
   └──────────────────────────────────────────────────┘
```

## What's Built In

### Error Reporting

| Component           | File                                                | Purpose                                                 |
| ------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| Sentry React SDK    | `src/lib/sentry.ts`                                 | Frontend error capture, consent gate, anonymous user ID |
| ErrorBoundary       | `src/components/ErrorBoundary.tsx`                  | React render error fallback + crash state save          |
| Sentry Rust crate   | `src-tauri/Cargo.toml`                              | Panic capture, log bridging, session health             |
| Panic Hook          | `src-tauri/src/commands/crash_report.rs`            | Writes crash file on panic for next-launch recovery     |
| Crash Report Dialog | `src/components/crash-report/CrashReportDialog.tsx` | User consent UI for crash report sending                |

### Logging

| Component                | File                                        | Dev              | Prod                      |
| ------------------------ | ------------------------------------------- | ---------------- | ------------------------- |
| Custom Logger            | `src/lib/logger.ts`                         | Browser console  | Sentry Logs               |
| tauri-plugin-log         | `src-tauri/src/lib.rs`                      | stdout + webview | stdout + log dir          |
| Sentry `log` integration | `Cargo.toml` (`features = ["log", "logs"]`) | —                | Sentry breadcrumbs + logs |

### Performance

| Component                    | Source                               | What it captures                        |
| ---------------------------- | ------------------------------------ | --------------------------------------- |
| Web Vitals (LCP/FCP/CLS/INP) | `Sentry.browserTracingIntegration()` | Automatic page load metrics             |
| Rust tracing                 | `traces_sample_rate: 0.0` (disabled) | No HTTP chains to trace in desktop apps |

### Session Health

| Component                            | What it provides                                 |
| ------------------------------------ | ------------------------------------------------ |
| `auto_session_tracking: true` (Rust) | Crash-free session rate in Sentry Release Health |
| Anonymous user ID (frontend)         | Per-device event grouping without PII            |

### Context Tags

Rust events automatically include:

| Tag           | Source                               |
| ------------- | ------------------------------------ |
| `app.name`    | `tauri.conf.json` → `package_info()` |
| `app.version` | `tauri.conf.json` → `package_info()` |
| `os.family`   | `std::env::consts::OS`               |
| `os.arch`     | `std::env::consts::ARCH`             |

### Source Maps

Production builds use `@sentry/vite-plugin` (in `vite.config.ts`) to upload
hidden source maps to Sentry. This maps minified stack traces back to original
source files. Requires `SENTRY_AUTH_TOKEN` in the build environment.

## Configuration

All Sentry configuration goes through a single `.env` file:

```env
# Required to enable Sentry (leave empty to disable)
VITE_SENTRY_DSN=http://key@your-sentry-host/1
```

- `build.rs` reads `.env` and injects `SENTRY_DSN` as a Rust compile-time env var
- `vite.config.ts` reads `VITE_SENTRY_DSN` for the frontend SDK
- Removing or emptying the DSN disables Sentry entirely on both sides

## Consent Flow

```
App Launch → use-crash-reporting.ts
  ├─ No crash file, no saved consent → do nothing (consent = null)
  ├─ Crash file found, consent saved → use saved preference
  └─ Crash file found, no consent → show CrashReportDialog
       ├─ User grants → setSentryConsent(true) → delete crash file
       │   → send crash event → set anonymous user ID → enable all Sentry
       └─ User denies → setSentryConsent(false) → delete crash file
           → all Sentry events dropped by beforeSend gate
```

Consent is synced to the Rust side via the `set_consent` Tauri command, so
Rust-originated events (panics) respect the same gate.

## Extension Points

### Adding Custom Analytics

The `logger.ts` module is the recommended extension point. Add a `metric()`
method that routes to your analytics provider:

```typescript
// src/lib/logger.ts — add to Logger class
metric(name: string, data?: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    console.log(`[metric] ${name}`, data)
    return
  }
  // Route to your analytics provider (e.g., PostHog, Mixpanel)
  // analytics.capture(name, data)
}
```

### Adding Feature Flags

This template doesn't include a feature flag system. For simple use cases, use
environment variables:

```typescript
const FEATURE_NEW_UI = import.meta.env.VITE_FEATURE_NEW_UI === 'true'
```

For production-grade flag management, integrate [LaunchDarkly](https://launchdarkly.com/)
or [Unleash](https://www.getunleash.io/).

### Adding Health Checks

Add a Tauri command that probes external dependencies:

```rust
#[tauri::command]
pub async fn health_check() -> Result<HealthStatus, String> {
    Ok(HealthStatus {
        sentry_ok: check_sentry_reachable().await,
    })
}
```

### Adding Performance Spans

Use `Sentry.startSpan()` for custom performance instrumentation:

```typescript
import * as Sentry from '@sentry/react'

const result = Sentry.startSpan({ name: 'expensive-operation' }, () => {
  return performExpensiveWork()
})
```

### Adding IPC Call Timing

Wrap Tauri command calls with performance measurement:

```typescript
const start = performance.now()
const result = await commands.someCommand()
const duration = performance.now() - start
if (duration > 100) {
  logger.warn(`Slow command: someCommand took ${duration.toFixed(1)}ms`)
}
```

## Disabling Sentry

To run the app without Sentry:

1. Remove `VITE_SENTRY_DSN` from `.env` (or set it to empty string)
2. `build.rs` will emit a cargo warning and the Rust SDK will be a no-op
3. The frontend SDK initializes but drops all events via `beforeSend`

No other code changes needed — the consent gate, logger routing, and error
boundary all work correctly without Sentry.

## Dev-Mode Debug Panel

In development, a floating debug panel appears at the bottom-right corner
(`SentryDebugPanel` in `App.tsx`). It lets you trigger:

- **JS Error** — `Sentry.captureMessage()`
- **Unhandled Rejection** — `Promise.reject()`

This panel is automatically hidden in production builds.

## Generated Documentation

| Tool          | Command             | Output                         |
| ------------- | ------------------- | ------------------------------ |
| Rust API docs | `npm run rust:doc`  | `src-tauri/target/doc/` (HTML) |
| CHANGELOG     | `npm run changelog` | `CHANGELOG.md` (from git log)  |

See [releases.en.md](./releases.en.md) for the release process including CHANGELOG
generation.
