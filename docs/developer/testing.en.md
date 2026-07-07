# Testing

**[English](testing.en.md)** | [中文](testing.zh.md)

Testing patterns for Rust and TypeScript, with focus on Tauri-specific mocking.

## Running Tests

```bash
npm run check:all      # All tests and checks
npm run test           # TypeScript tests (watch mode)
npm run test:run       # TypeScript tests (single run)
npm run rust:test      # Rust tests
```

## TypeScript Testing

Uses **Vitest** + **@testing-library/react**. Configuration in `vitest.config.ts`.

### Test File Location

Place tests next to the code they test:

```
src/components/ui/Button.tsx
src/components/ui/Button.test.tsx
```

### Mocking Tauri APIs (Critical)

Tauri commands must be mocked since tests run outside the Tauri environment. Mocks are configured in `src/test/setup.ts`:

```typescript
// src/test/setup.ts
import { vi } from 'vitest'

// Mock Tauri event APIs
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn().mockResolvedValue(null),
}))

// Mock typed Tauri bindings (tauri-specta generated)
vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    greet: vi.fn().mockResolvedValue('Hello, test!'),
    loadPreferences: vi
      .fn()
      .mockResolvedValue({ status: 'ok', data: { theme: 'system' } }),
    savePreferences: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    sendNativeNotification: vi
      .fn()
      .mockResolvedValue({ status: 'ok', data: null }),
    saveEmergencyData: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    loadEmergencyData: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    cleanupOldRecoveryFiles: vi
      .fn()
      .mockResolvedValue({ status: 'ok', data: 0 }),
  },
}))
```

### Testing with Mocked Commands

```typescript
import { vi } from 'vitest'
import { commands } from '@/lib/tauri-bindings'

const mockCommands = vi.mocked(commands)

test('loads preferences', async () => {
  mockCommands.loadPreferences.mockResolvedValue({
    status: 'ok',
    data: { theme: 'dark' },
  })

  // Test code that calls loadPreferences
})
```

### Test Wrapper for Providers

Components using TanStack Query need a provider wrapper:

```typescript
// src/test/utils.ts
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

export function TestProviders({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

Usage:

```typescript
import { render } from '@testing-library/react'
import { TestProviders } from '@/test/utils'

test('component with query', () => {
  render(
    <TestProviders>
      <MyComponent />
    </TestProviders>
  )
})
```

### Testing Zustand Stores

```typescript
import { renderHook, act } from '@testing-library/react'
import { useUIStore } from '@/store/ui-store'

test('toggles sidebar visibility', () => {
  const { result } = renderHook(() => useUIStore())

  expect(result.current.leftSidebarVisible).toBe(true)

  act(() => {
    result.current.setLeftSidebarVisible(false)
  })

  expect(result.current.leftSidebarVisible).toBe(false)
})
```

## Rust Testing

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_preferences_default() {
        let prefs = AppPreferences::default();
        assert_eq!(prefs.theme, "system");
    }
}
```

### Async Tests

```rust
#[tokio::test]
async fn test_async_operation() {
    let result = some_async_fn().await;
    assert!(result.is_ok());
}
```

### File Operation Tests

Use `tempfile` for tests that need file system access:

```rust
use tempfile::TempDir;

#[test]
fn test_file_operations() {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("test.json");

    // Test write
    std::fs::write(&file_path, "{}").unwrap();

    // Test read
    let content = std::fs::read_to_string(&file_path).unwrap();
    assert_eq!(content, "{}");
}
```

## Adding New Command Mocks

When adding new Tauri commands, update `src/test/setup.ts`:

```typescript
vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    // ... existing mocks
    myNewCommand: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
  },
}))
```

## E2E Testing (Playwright)

Uses **Playwright** with a browser-injected Tauri API mock. Configuration in `playwright.config.ts`.

### Running E2E Tests

```bash
npx playwright test                    # All E2E tests
npx playwright test e2e/keyboard-shortcuts.spec.ts  # Single file
npx playwright test --workers=1        # Sequential execution
```

### E2E Test Files

| File                               | Coverage                                          |
| ---------------------------------- | ------------------------------------------------- |
| `app-launch.spec.ts`               | Application startup and initial render            |
| `sidebar.spec.ts`                  | Sidebar toggle and resizable panel behavior       |
| `preferences.spec.ts`              | Preferences dialog open/close and pane navigation |
| `command-palette.spec.ts`          | Command palette search and execution              |
| `command-palette-keyboard.spec.ts` | Command palette keyboard navigation               |
| `theme-language.spec.ts`           | Theme switching and language selection            |
| `crash-report.spec.ts`             | Crash report dialog appearance                    |
| `crash-report-details.spec.ts`     | Crash report send/don't-send flow                 |
| `general-pane.spec.ts`             | General preferences pane controls                 |
| `advanced-pane.spec.ts`            | Advanced preferences pane controls                |
| `accessibility.spec.ts`            | AXE accessibility audit                           |
| `keyboard-shortcuts.spec.ts`       | Global keyboard shortcuts (Ctrl+1/2/,/K)          |
| `notifications.spec.ts`            | Toast notification system via command palette     |
| `window-commands.spec.ts`          | Window control commands (minimize/maximize/etc.)  |
| `quick-pane-event.spec.ts`         | Quick pane event communication with main window   |
| `i18n-completeness.spec.ts`        | Internationalization labels and dropdown behavior |

### Tauri API Mock

The mock (`e2e/mocks/tauri-mock.ts`) is injected via `page.addInitScript()` before any page scripts run. It sets up `window.__TAURI_INTERNALS__` with:

- `invoke(cmd, args)` — routes Tauri commands to mock implementations
- `transformCallback(callback, once)` — registers callbacks for event listeners

Key mock features:

- **Event listening**: `plugin:event|listen` stores `{event, handlerId}` pairs. Tauri 2.0 passes `handler` (callback ID) not `channel`.
- **Event emission**: `window.__testHelpers.emitEvent(eventName, payload)` dispatches to registered listeners via callback ID lookup.
- **Test helpers**: `window.__testHelpers` provides `getRegisteredChannels()`, `getInvokeLog()`, `setCrashReport()`, `getPreferences()`, `setPreferences()`.

## Best Practices

| Do                                    | Don't                         |
| ------------------------------------- | ----------------------------- |
| Mock Tauri commands in setup.ts       | Call real Tauri APIs in tests |
| Use `vi.mocked()` for type-safe mocks | Use untyped mock assertions   |
| Test user-visible behavior            | Test implementation details   |
| Use `tempfile` for Rust file tests    | Write to real file system     |
| Use `getByRole()` in E2E selectors    | Use brittle CSS selectors     |
| Wait for `__testHelpers` in E2E       | Assume listeners are ready    |
