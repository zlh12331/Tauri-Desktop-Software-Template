# Error Handling

**[English](error-handling.en.md)** | [中文](error-handling.zh.md)

Patterns for consistent error handling across Rust and TypeScript.

## Error Propagation Flow

```
Rust Command (Result<T, E>) → tauri-specta → TypeScript discriminated union → TanStack Query/UI
```

Rust `Result<T, E>` types become TypeScript discriminated unions:

```typescript
type Result<T, E> = { status: 'ok'; data: T } | { status: 'error'; error: E }
```

## Rust Error Types

### Simple Commands

For commands with one failure mode, use `String` errors:

```rust
#[tauri::command]
#[specta::specta]
pub async fn simple_operation() -> Result<Data, String> {
    do_work().map_err(|e| format!("Operation failed: {e}"))
}
```

### Production Commands

This project uses `AppError` (in `src-tauri/src/error.rs`) with 10 variants:

```rust
#[derive(Debug, Clone, thiserror::Error, serde::Serialize, Type)]
#[serde(tag = "kind", content = "message")]  // Creates TypeScript discriminated union
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

`thiserror` auto-generates `Display` and `Error`. Each variant has a stable error code
via `error_code()` (e.g., `ERR_IO`, `ERR_VALIDATION`), mirrored in `src/lib/error-codes.ts`.

TypeScript receives:

```typescript
type AppError =
  | { kind: 'Io'; message: string }
  | { kind: 'Serialization'; message: string }
  | { kind: 'Path'; message: string }
  | { kind: 'Validation'; message: string }
  | { kind: 'NotFound'; message: string }
  | { kind: 'TaskJoin'; message: string }
  | { kind: 'Tray'; message: string }
  | { kind: 'QuickPane'; message: string }
  | { kind: 'Notification'; message: string }
  | { kind: 'Window'; message: string }
```

For recovery-specific errors, `RecoveryError` (in `types.rs`) uses `#[serde(tag = "kind")]`
with named-field variants like `DataTooLarge { max_bytes: u32 }`.

## TypeScript Error Handling

### Pattern 1: Explicit Handling (Event Handlers)

```typescript
// ✅ GOOD: Handle errors inline with user feedback
const handleSave = async () => {
  const result = await commands.saveData(data)
  if (result.status === 'error') {
    toast.error('Save failed', { description: result.error })
    return
  }
  toast.success('Saved!')
}
```

### Pattern 2: unwrapResult (TanStack Query)

```typescript
// ✅ GOOD: Let TanStack Query handle errors
const { data, error } = useQuery({
  queryKey: ['data'],
  queryFn: async () => unwrapResult(await commands.loadData()),
})
```

### Pattern 3: Graceful Degradation

```typescript
// ✅ GOOD: Fall back to defaults on error
const { data } = useQuery({
  queryKey: ['preferences'],
  queryFn: async () => {
    const result = await commands.loadPreferences()
    if (result.status === 'error') {
      logger.warn('Failed to load preferences, using defaults')
      return defaultPreferences
    }
    return result.data
  },
})
```

## User-Facing vs Technical Errors

### Rust: Log Technical Details, Return User Messages

```rust
// ✅ GOOD: Log technical details, return user-friendly message
pub async fn load_file(path: &str) -> Result<String, String> {
    log::debug!("Loading file: {path}");

    std::fs::read_to_string(path).map_err(|e| {
        log::error!("Failed to read file {path}: {e}");  // Technical log
        format!("Could not read file")                   // User message
    })
}
```

### TypeScript: Toast for Users, Logger for Debugging

```typescript
// ✅ GOOD: Separate user feedback from technical logging
const result = await commands.saveData(data)
if (result.status === 'error') {
  logger.error('Save failed', { error: result.error, data }) // Technical
  toast.error('Failed to save') // User-facing
}
```

## Retry Configuration

Configure TanStack Query retry behavior based on error type:

```typescript
// ✅ GOOD: Smart retry logic
const { data } = useQuery({
  queryKey: ['data'],
  queryFn: loadData,
  retry: (failureCount, error) => {
    // Don't retry client errors (4xx)
    if (error.message.includes('API error: 4')) return false
    // Retry network/server errors up to 3 times
    return failureCount < 3
  },
})
```

Default retry settings in `query-client.ts`:

| Query Type | Retries | Rationale                            |
| ---------- | ------- | ------------------------------------ |
| Queries    | 1       | Transient failures may recover       |
| Mutations  | 1       | Avoid duplicate writes on slow saves |

## Global Error Toasts

Avoid per-query error toasts (causes duplicates). Use global handling:

```typescript
// ✅ GOOD: Centralized in query-client.ts
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.errorToast !== false) {
        toast.error('Something went wrong')
      }
    },
  }),
})

// Opt out for specific queries
useQuery({
  queryKey: ['optional-feature'],
  queryFn: loadOptional,
  meta: { errorToast: false },
})
```

## React Error Boundaries

Error boundaries catch render errors, not async errors:

| Caught by Error Boundary    | NOT Caught                          |
| --------------------------- | ----------------------------------- |
| Errors during render        | Errors in event handlers            |
| Errors in lifecycle methods | Async code (promises)               |
| Errors in constructors      | Errors in the error boundary itself |

For async Tauri command errors, use explicit handling or `unwrapResult` with TanStack Query.

## Rollback Pattern

For multi-step operations, rollback on failure:

```typescript
// ✅ GOOD: Rollback on failure
const handleChange = async (newValue: string) => {
  const oldValue = currentValue

  // Step 1: Update backend
  const result = await commands.updateValue(newValue)
  if (result.status === 'error') {
    toast.error('Update failed')
    return
  }

  // Step 2: Persist
  try {
    await savePreferences.mutateAsync({ ...prefs, value: newValue })
  } catch {
    // Rollback step 1
    await commands.updateValue(oldValue)
    toast.error('Save failed, changes reverted')
  }
}
```

## Quick Reference

| Scenario               | Rust Error Type              | TypeScript Pattern   | User Feedback    |
| ---------------------- | ---------------------------- | -------------------- | ---------------- |
| Simple command         | `AppError`                   | if/else + toast      | Toast on error   |
| Multiple failure modes | `AppError` / `RecoveryError` | Match on `.kind`     | Context-specific |
| Data fetching          | `AppError`                   | `unwrapResult`       | Query error UI   |
| Optional feature       | `AppError`                   | Graceful degradation | Silent fallback  |
| Critical operation     | `AppError`                   | Explicit + rollback  | Toast + recovery |

See also: [tauri-commands.md](./tauri-commands.en.md) for Result type patterns, [logging.md](./logging.en.md) for logging best practices.

## Crash Reporting (Sentry)

This project integrates Sentry for remote error tracking across both the React
frontend and the Rust backend. See [observability.md](./observability.en.md) for the
full architecture.

### Consent Gate

All Sentry events (errors, logs, traces, replays) pass through a `beforeSend`
callback that checks the user's consent state. Events are **never sent** without
explicit user consent.

```
Frontend flow:
  Sentry captures event → beforeSend checks consentGranted → send / drop

Rust flow:
  Sentry captures event → before_send checks CONSENT_STATE → send / drop
```

Consent is managed by `setSentryConsent()` in `src/lib/sentry.ts`, which also
syncs the state to the Rust side via the `set_consent` Tauri command. The user
is prompted by `CrashReportDialog` on the first launch after a crash.

### Anonymous User Identification

When consent is granted, an anonymous UUID is generated and persisted to
`localStorage` (key: `sentry_anon_user_id`). This lets Sentry group events by
device without collecting PII. The same UUID is reused across sessions for the
same device. Consent revocation clears the user identity.

### Panic Recovery

When the Rust backend panics, a custom panic hook writes crash details to a
`crash-report.json` file. On the next launch, `use-crash-reporting.ts` detects
this file and either reports it to Sentry (if consent was granted), shows the
consent dialog, or silently deletes it.

### Source Maps

Production builds generate hidden source maps (`build.sourcemap: 'hidden'` in
`vite.config.ts`) and upload them to Sentry via `@sentry/vite-plugin`. This
allows Sentry to display minified-to-source stack traces. Upload requires the
`SENTRY_AUTH_TOKEN` environment variable (set it in CI secrets for production
builds).
