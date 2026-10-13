# Architecture Guide

**[English](architecture-guide.en.md)** | [中文](architecture-guide.zh.md)

High-level architectural overview and mental models for this app.

## Philosophy

1. **Clarity over Cleverness** - Predictable patterns over magic
2. **AI-Friendly Architecture** - Clear patterns that AI agents can follow
3. **Performance by Design** - Patterns that prevent common performance pitfalls
4. **Security First** - Built-in security patterns for file system operations
5. **Extensible Foundation** - Easy to add new features without refactoring

## Mental Models

### The "Onion" State Architecture

State management follows a three-layer hierarchy:

```
┌─────────────────────────────────────┐
│           useState                  │  ← Component UI State
│  ┌─────────────────────────────────┐│
│  │          Zustand                ││  ← Global UI State
│  │  ┌─────────────────────────────┐││
│  │  │      TanStack Query         │││  ← Persistent Data
│  │  └─────────────────────────────┘││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

**Decision Tree:**

```
Is this data needed across multiple components?
├─ No → useState
└─ Yes → Does this data persist between app sessions?
    ├─ No → Zustand
    └─ Yes → TanStack Query
```

See [state-management.md](./state-management.en.md) for implementation details.

### Event-Driven Bridge

Rust and React communicate through events for loose coupling:

```
Rust Menu Click → Event Emission → React Listener → Command Execution → State Update
Keyboard Shortcut → Event Handler → Command Execution → State Update
Command Palette → Command Selection → Command Execution → State Update
```

This ensures the same actions work consistently across all interaction methods.

### Command-Centric Design

All user actions are dispatched through a centralized command registry, backed by the type-safe [Tauri command bridge](./tauri-commands.en.md):

- **Commands** are pure objects with `execute()` functions
- **Context** provides all state and actions commands need
- **Registration** merges commands from different domains at runtime

This decouples UI triggers from implementations and enables consistent behavior.

## Pattern Dependencies

Understanding how patterns work together:

```
Command System
├── Depends on: State Management (context)
├── Integrates with: Keyboard Shortcuts, Menus
└── Enables: Consistent behavior across UI

State Management
├── Enables: Performance (getState pattern)
├── Supports: Data Persistence, UI State
└── Foundation for: All other systems

Event-Driven Bridge
├── Enables: Rust-React communication
├── Supports: Security (validation in Rust)
└── Foundation for: Menus, Updates, Notifications
```

## Core Systems

| System               | Documentation                                   |
| -------------------- | ----------------------------------------------- |
| Tauri Commands       | [tauri-commands.md](./tauri-commands.en.md)     |
| State Management     | [state-management.md](./state-management.en.md) |
| Error Handling       | [error-handling.md](./error-handling.en.md)     |
| Internationalization | [i18n-patterns.md](./i18n-patterns.en.md)       |
| Static Analysis      | [static-analysis.md](./static-analysis.en.md)   |
| Releases             | [releases.md](./releases.en.md)                 |

## Component Hierarchy

```
MainWindow (Top-level orchestrator)
├── TitleBar (Window controls + toolbar)
├── LeftSidebar (Collapsible panel)
├── MainWindowContent (Primary content area)
├── RightSidebar (Collapsible panel)
└── Global Overlays
    ├── PreferencesDialog (Settings)
    ├── CommandPalette (Cmd+K)
    └── Toaster (Notifications)
```

## File Organization

```
locales/                  # Translation JSON files (en.json, zh.json)
src/
├── components/
│   ├── layout/          # Layout components (MainWindow, sidebars, content)
│   ├── titlebar/        # Cross-platform title bar (macOS/Windows/Linux controls)
│   ├── command-palette/ # Command palette (Cmd+K)
│   ├── preferences/     # Preferences dialog with panes (general, appearance, advanced)
│   ├── quick-pane/      # Quick pane floating window app
│   ├── crash-report/    # Crash report consent dialog
│   └── ui/              # shadcn/ui base components (37 components)
├── hooks/               # Custom React hooks (11 hooks)
├── i18n/                # Internationalization config (i18next + react-i18next)
├── lib/
│   ├── commands/        # Command system implementation (registry + command groups)
│   ├── schemas/         # Zod validation schemas
│   ├── menu.ts          # Native menu builder with i18n
│   ├── notifications.ts # Toast (Sonner) + native notification wrapper
│   ├── logger.ts        # Custom logger (console dev, Sentry Logs prod)
│   ├── sentry.ts        # Sentry SDK init + consent gate
│   └── bindings.ts      # tauri-specta generated (DO NOT EDIT)
├── queries/             # TanStack Query hooks (preferences)
├── store/               # Zustand stores (ui, sidebar, dialog, crash-report)
├── test/                # Test setup and utilities
├── App.tsx              # Root component (hooks + providers)
├── main.tsx             # Main window entry
└── quick-pane-main.tsx  # Quick pane window entry
```

## Multi-Window Architecture

Tauri applications can have multiple windows, each running a separate JavaScript context. Windows cannot share React state directly.

**Key patterns:**

1. **Separate entry points** - Each window has its own HTML file and React root
2. **Event-based communication** - Use Tauri events to communicate between windows
3. **Window reuse** - Create windows once at startup, then show/hide as needed
4. **Theme synchronization** - Emit theme changes so all windows stay in sync

```typescript
// Window A: emit event
await emit('data-updated', { value: 'new data' })

// Window B: listen and react
listen('data-updated', ({ payload }) => {
  setData(payload.value)
})
```

Any multi-window setup (quick panes, preferences, helpers) follows this event-based pattern.

## Security Architecture

### Tauri Capabilities

Tauri v2 uses a permission-based capabilities system. Each window only gets the permissions it needs.

**Location:** `src-tauri/capabilities/default.json`

```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:*",
    "fs:default",
    "notification:default"
  ]
}
```

**Key rules:**

- Use specific window labels, not `["*"]`
- Only add permissions actually needed
- Remote content (if any) should have minimal permissions

### Plugins that are wired but not granted

`tauri_plugin_http::init()` runs at startup (`src-tauri/src/lib.rs`), so the
plugin is present, but `default.json` grants it nothing. An earlier revision
granted `http:default` with `allow: [{url: "https://**"}, {url: "http://**"}]`,
which is a CORS bypass for every host on the internet plus cleartext HTTP — on a
webview that also holds `fs:default` and `shell:allow-open`. Nothing in the app
ever called it: there is no `fetch()` in `src/`, and no import of
`@tauri-apps/plugin-http` anywhere in the frontend or the E2E mocks.

That is the shape this template wants a fork to start from: **a permission is a
policy decision, and an unexercised one is surface, not capability.** To use the
HTTP client, add the grant yourself and scope it to the origins you actually
talk to:

```json
{
  "identifier": "http:default",
  "allow": [{ "url": "https://api.example.com/**" }]
}
```

Prefer a host-and-path prefix over a bare `https://**`, and treat `http://**` as
a bug unless you have a documented reason (a local development server belongs in
a `dev`-only capability rather than in the shipped one). Removing the plugin
entirely — crate, `init()` call, and npm package — is the cheaper answer for most
apps, since nothing in the shipped UI depends on it.

### Content Security Policy

CSP prevents XSS attacks. Configuration is in `src-tauri/tauri.conf.json`.

**Rules:**

- Never load scripts from CDNs - bundle everything locally
- Avoid `'unsafe-eval'` unless absolutely necessary
- Images: restrict to specific domains when possible

### Secure Storage

| Data Type       | Storage                            | Security Level |
| --------------- | ---------------------------------- | -------------- |
| API tokens/keys | OS keychain (`keyring` crate)      | High           |
| App preferences | App data directory (JSON)          | Medium         |
| User content    | App data directory (JSON/recovery) | Medium         |

**Note**: `keyring` and SQLite are not installed by default; enable them via the respective crates when needed. Never store sensitive tokens in `tauri-plugin-store` (plain JSON on disk); use the OS keychain for secrets.

### Rust-First Security

All file operations happen in Rust with built-in validation:

```rust
fn is_blocked_directory(path: &Path) -> bool {
    let blocked_patterns = ["/System/", "/usr/", "/etc/", "/.ssh/"];
    blocked_patterns.iter().any(|pattern| path.starts_with(pattern))
}
```

### Input Sanitization

```rust
pub fn sanitize_filename(filename: &str) -> String {
    filename.chars()
        .filter(|c| !['/', '\\', ':', '*', '?', '"', '<', '>', '|'].contains(c))
        .collect()
}
```

### Log Redaction

`utils/redact::render_log_line()` is installed as `tauri-plugin-log`'s formatter,
so every log line is scrubbed of `api_key=`, `token:`, `Authorization: Bearer …`,
`password`, `secret`, `cookie` values before any target receives it — stdout, the
log directory, and Console.app alike.

Two things worth knowing about how it is wired:

- The plugin has no post-processing hook, so adding redaction required replacing
  its formatter, and the replacement restates the default desktop layout
  (`[2026-10-13][05:18:16][target][LEVEL] message`) rather than inventing one.
  `OffsetDateTime`'s `Display` prints `2026-10-13 5:18:16.014407 +00:00`, which
  would have silently changed the shape of every log file; a test pins the
  bracketed, zero-padded form.
- Redaction covers the **message**, not the target or level. That is deliberate:
  the fields the logging framework supplies are not user data.

### Atomic File Operations

All disk writes use atomic operations to prevent corruption:

```rust
// Write to temp file, then rename (atomic)
std::fs::write(&temp_path, content)?;
std::fs::rename(&temp_path, &final_path)?;
```

See [Tauri Security Documentation](https://v2.tauri.app/security/) for detailed guidance.

## Type-Safe Tauri Commands

All Tauri commands use [tauri-specta](https://github.com/specta-rs/tauri-specta) for type safety:

```typescript
// ✅ GOOD: Type-safe with autocomplete
import { commands } from '@/lib/tauri-bindings'

const result = await commands.loadPreferences()
if (result.status === 'ok') {
  console.log(result.data.theme)
}

// ❌ BAD: String-based invoke (no type safety)
const prefs = await invoke<AppPreferences>('load_preferences')
```

See [tauri-commands.md](./tauri-commands.en.md) for adding new commands.

## Quality Gates

Before any changes are committed:

```bash
npm run check:all
```

See [static-analysis.md](./static-analysis.en.md) for all tools included.

## Anti-Patterns to Avoid

| Anti-Pattern                    | Why It's Bad                        | Do This Instead               |
| ------------------------------- | ----------------------------------- | ----------------------------- |
| State in wrong layer            | Confuses ownership, breaks patterns | Follow the onion model        |
| Direct Rust-React coupling      | Tight coupling, hard to maintain    | Use command system and events |
| Store subscription in callbacks | Causes render cascades              | Use `getState()` pattern      |
| Skipping input validation       | Security vulnerabilities            | Always validate in Rust       |
| Magic/implicit patterns         | Hard for AI and humans to follow    | Prefer explicit, clear code   |

## Adding New Features

1. **Commands** - Add to appropriate command group file
2. **State** - Choose appropriate layer (useState/Zustand/TanStack Query)
3. **UI** - Follow component architecture
4. **Persistence** - Use established file-storage / atomic-write patterns
5. **Testing** - Add unit and integration tests following the existing suite
6. **Documentation** - Update relevant docs
