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

## Two Result Conventions

Two different envelopes cross function boundaries in this app. They are not
interchangeable, and picking the wrong discriminator is a silent bug, not a type
error, because both are truthy-ish objects.

| Boundary             | Shape                                                             | Produced by                                          | Error field                                |
| -------------------- | ----------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------ |
| Rust → TS IPC        | `{ status: 'ok', data }` / `{ status: 'error', error: AppError }` | `commands.*()` in `src/lib/bindings.ts`              | object — use `.message`, branch on `.kind` |
| Frontend command bus | `{ success: boolean, error?: string }`                            | `executeCommand()` in `src/lib/commands/registry.ts` | already a display string                   |

```typescript
// Rust IPC: check .status, then read .error.message
const result = await commands.savePreferences(prefs)
if (result.status === 'error') {
  toast.error(result.error.message) // not `result.error` — that is an object
}

// Command bus: check .success; .error is a string ready for the UI
const dispatched = await executeCommand('toggle-left-sidebar', context)
if (!dispatched.success && dispatched.error) {
  context.showToast(dispatched.error, 'error')
}
```

Commands today only touch stores and the window API, so nothing mixes the two
envelopes yet. When a command does call a Rust command, handle `result.status`
inside `execute()` — or rethrow as an `Error` with a user-readable message. Do not
let the raw `AppError` reach the caller: `executeCommand()` stringifies only
`error instanceof Error`, so anything else is reported as `Unknown error`.

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

`thiserror` auto-generates `Display` and `Error`. The stable identifier on the wire is the
serde `kind` tag itself — the variant name (`Io`, `Validation`, ...) — and TypeScript switches
on it via the generated union below. There is no separate `ERR_*` code system and no
`src/lib/error-codes.ts`; adding one would duplicate information the union already carries.

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
const handleSave = async (prefs: AppPreferences) => {
  const result = await commands.savePreferences(prefs)
  if (result.status === 'error') {
    toast.error('Save failed', { description: result.error.message })
    return
  }
  toast.success('Saved!')
}
```

### Pattern 2: Convert to a Throw Inside a Mutation

There is no `unwrapResult` helper in this codebase. TanStack Query owns errors by
having the mutation function throw, which is what `src/queries/preferences.ts` does:

```typescript
// ✅ GOOD: Report to the user, then throw so the mutation state carries it
return useMutation({
  mutationFn: async (preferences: AppPreferences) => {
    const result = await commands.savePreferences(preferences)
    if (result.status === 'error') {
      logger.error('Failed to save preferences', { error: result.error })
      toast.error(t('toast.error.preferencesSaveFailed'), {
        description: result.error.message,
      })
      throw new Error(result.error.message)
    }
  },
  onSuccess: (_, preferences) =>
    queryClient.setQueryData(['preferences'], preferences),
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
const result = await commands.savePreferences(prefs)
if (result.status === 'error') {
  logger.error('Failed to save preferences', { error: result.error }) // Technical
  toast.error('Could not save your settings', {
    description: result.error.message, // User-facing
  })
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

## Error Toasts: Handled at the Call Site

`query-client.ts` has no global `QueryCache`/`MutationCache` error handler — verified
against the file, which only sets `retry`, `staleTime`, `gcTime` and
`refetchOnWindowFocus`. Every error toast therefore belongs to the code that knows
what the user was doing:

```typescript
// ✅ What the project does today (src/queries/preferences.ts)
const result = await commands.savePreferences(preferences)
if (result.status === 'error') {
  toast.error(i18n.t('toast.error.preferencesSaveFailed'), {
    description: result.error.message,
  })
  throw new Error(result.error.message)
}
```

Queries, by contrast, should not toast — `usePreferences()` falls back to defaults so
the UI keeps rendering. If a global handler is ever added, `query-client.ts` is the
place, and must avoid doubling up with the call-site toasts above.

## React Error Boundaries

Error boundaries catch render errors, not async errors:

| Caught by Error Boundary    | NOT Caught                          |
| --------------------------- | ----------------------------------- |
| Errors during render        | Errors in event handlers            |
| Errors in lifecycle methods | Async code (promises)               |
| Errors in constructors      | Errors in the error boundary itself |

For async Tauri command errors, handle them at the call site or unwrap and throw inside a TanStack Query function.

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

| Scenario               | Rust Error Type              | TypeScript Pattern              | User Feedback    |
| ---------------------- | ---------------------------- | ------------------------------- | ---------------- |
| Simple command         | `AppError`                   | if/else + toast                 | Toast on error   |
| Multiple failure modes | `AppError` / `RecoveryError` | Match on `.kind`                | Context-specific |
| Data fetching          | `AppError`                   | Unwrap + `throw`                | Query error UI   |
| Optional feature       | `AppError`                   | Graceful degradation            | Silent fallback  |
| Critical operation     | `AppError`                   | Explicit + rollback             | Toast + recovery |
| Command bus            | n/a (frontend only)          | `executeCommand()` → `.success` | Toast on error   |

See also: [tauri-commands.md](./tauri-commands.en.md) for Result type patterns.

## Crash Reporting (Sentry)

This project integrates Sentry for remote error tracking across both the React
frontend and the Rust backend.

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
