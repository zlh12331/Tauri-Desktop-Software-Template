<div align="center">

# Tauri Desktop Software Template

**The production-hardened starting point for cross-platform desktop apps.**

Type-safe IPC, native-feeling UX, and a quality bar that catches regressions before your users do — pre-configured and ready to fork.

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-000000?style=flat-square)](LICENSE.md)
[![Tauri](https://img.shields.io/badge/Tauri-v2-000000?style=flat-square)](https://v2.tauri.app/)
[![React](https://img.shields.io/badge/React-19-000000?style=flat-square)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-000000?style=flat-square)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-edition_2024-000000?style=flat-square)](https://www.rust-lang.org/)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-000000?style=flat-square)](#cross-platform)

**[English](README.md)** | [中文](README.zh.md)

</div>

---

## Why This Template

Most Tauri starters hand you a "hello world" and leave the hard parts to you. This template ships the infrastructure real desktop apps need — so you can focus on your product instead of your toolchain:

- **Type-safe IPC** — 17 Tauri commands with compile-time checked types generated from Rust via [tauri-specta](https://github.com/specta-rs/tauri-specta). No string-based `invoke()`, no `any`, no runtime surprises.
- **Dual-layer crash reporting** — a Rust panic hook captures crashes to disk (surviving even OOM), a Sentry consent gate respects user privacy, and sensitive data is redacted before anything leaves the device.
- **NSPanel floating window** — a native macOS `NSPanel` integration for a Spotlight-style quick pane that floats across all Spaces, with a graceful `always_on_top` fallback on Windows and Linux.
- **Enforced architecture** — ast-grep rules block anti-patterns at CI time: no React hooks in `lib/`, no store subscriptions in pure logic, no Zustand destructuring.
- **1,457 tests** — 1011 frontend + 430 Rust + 16 E2E, including WCAG 2.1 AA accessibility audits. Every command is tested at three layers: pure function, mocked runtime, and full integration.

## Quick Start

```bash
git clone --depth 1 https://github.com/zlh12331/Tauri-Desktop-Software-Template.git my-app
cd my-app
npm install
npm run tauri:dev
```

The app launches as a desktop window (frontend dev server runs at `http://localhost:1420`).

### Prerequisites

- [Node.js](https://nodejs.org/) v24+
- [Rust](https://rustup.rs/) 1.93+ (edition 2024)
- Platform-specific system dependencies — see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

## Features at a Glance

| Area            | What you get out of the box                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------- |
| **IPC**         | 17 typed commands + 10-variant `AppError` with stable error codes (`ERR_IO`, `ERR_VALIDATION`, ...) |
| **Reliability** | Auto-updates with minisign verification, dual-layer crash reporting, atomic preference writes       |
| **UX**          | Command palette (`Cmd+K`), cross-platform title bar, system tray, global shortcuts, deep links      |
| **Platform**    | macOS NSPanel + vibrancy, Windows frameless window, Linux native decorations                        |
| **Engineering** | 15+ quality gates, three-layer Rust testing, E2E with axe accessibility audits, cargo-deny          |
| **AI-ready**    | `AGENTS.md` rules, 26 developer docs explaining the _why_ behind every pattern                      |

## Feature Deep Dive

### Type-Safe End-to-End

- **17 Tauri commands** with types auto-generated from Rust via [tauri-specta](https://github.com/specta-rs/tauri-specta) — the frontend calls `commands.savePreferences(prefs)` and receives a `Result<AppPreferences, AppError>` union type, never a `Promise<any>`.
- **10-variant `AppError` enum** with `#[serde(tag = "kind", content = "message")]` — structured errors flow from Rust to TypeScript with stable, matchable codes.
- **Schema-first forms** — Zod schemas are the single source of truth for both runtime validation and TypeScript types; `react-hook-form` + `zodResolver` wire them into the UI.
- **Compile-time i18n** — translation keys are type-checked, so `t('prefrences.title')` is a build error, not a runtime surprise.

### Cross-Platform Desktop

| Platform | Title bar              | Window controls | Bundle      |
| -------- | ---------------------- | --------------- | ----------- |
| macOS    | Transparent + vibrancy | Traffic lights  | `.dmg`      |
| Windows  | Frameless              | Right side      | `.msi`      |
| Linux    | Native + toolbar       | Native          | `.AppImage` |

Platform detection is cached at module level (`usePlatform()`). Per-platform Tauri config overlays handle decorations, transparency, and vibrancy; platform-specific UI strings are centralized in `lib/platform-strings.ts`.

### Production Infrastructure

- **Auto-updates** — GitHub Releases integration with minisign signature verification, silent download, and relaunch
- **Crash reporting** — self-hosted Sentry in three layers: Rust panic hook (writes to disk) → consent gate (`AtomicU8` state) → redaction filter (8 sensitive key patterns)
- **System tray** — dock-to-tray mode (close hides instead of quitting), tray icon state management, window positioning relative to the tray
- **Global shortcuts** — runtime-registered and user-configurable from preferences (default: `Cmd+Shift+.` opens the quick pane)
- **Deep links** — `tauri-app://` scheme routes to preferences or the command palette

### Developer Experience

- **Command palette** — `Cmd+K` searchable launcher backed by a centralized command registry (14 commands across navigation, window, notification, and app groups)
- **Preferences system** — 3 panes (General, Appearance, Advanced) with atomic writes via temp-file + rename
- **Theme system** — light/dark/system, applied before first paint (inline FOUC-prevention script), synced across windows via Tauri events
- **i18n** — lazy-loaded language packs (en, zh), RTL support, OS locale auto-detection

### Quality Engineering

- **15+ quality gates** in `npm run check:all`: TypeScript strict mode (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), ESLint (zero warnings), ast-grep rules, React Compiler, Prettier, Rust fmt/clippy, Vitest, cargo test
- **Three-layer Rust testing** — pure functions (`*_from_path`/`*_to_path`) with `TempDir` isolation, `MockRuntime` for `AppHandle` mocking, integration tests for end-to-end flows
- **E2E with accessibility** — 16 Playwright scenarios including `@axe-core/playwright` WCAG 2.1 AA audits
- **cargo-deny** — license whitelist (14 allowed, GPL/AGPL rejected), vulnerability scanning, git dependency revision pinning

## Tech Stack

| Layer    | Technology                                            |
| -------- | ----------------------------------------------------- |
| Frontend | React 19, TypeScript 6, Vite 8                        |
| UI       | shadcn/ui v4 (37 components), Tailwind CSS v4, Lucide |
| State    | Zustand v5 (4 stores), TanStack Query v5              |
| Backend  | Tauri v2, Rust (edition 2024, MSRV 1.93)              |
| IPC      | tauri-specta =2.0.0-rc.25, specta-typescript =0.0.12  |
| Testing  | Vitest 4, Testing Library, Playwright, axe-core       |
| Quality  | ESLint, Prettier, ast-grep, knip, jscpd, cargo-deny   |

## Project Structure

```
my-app/
- src/                       Frontend source (~100 files)
  - components/              7 functional groups + 37 shadcn/ui components
    - layout/                Resizable 3-panel layout (react-resizable-panels)
    - titlebar/              Cross-platform title bar (macOS/Windows/Linux)
    - command-palette/       Cmd+K launcher (cmdk)
    - preferences/           3-pane settings dialog
    - quick-pane/            Floating input window
    - crash-report/          Crash report consent dialog
    - ui/                    shadcn/ui component library
  - hooks/                   10 custom React hooks
  - lib/                     Pure logic (no React coupling)
    - commands/              Command registry system (14 commands)
    - schemas/               Zod validation schemas
    - sentry.ts              Sentry SDK init + consent gate
    - redact.ts              Sensitive data redaction
    - bindings.ts            Auto-generated IPC types (tauri-specta)
  - store/                   4 Zustand stores (ui, dialog, sidebar, crash-report)
  - queries/                 TanStack Query hooks
  - i18n/                    i18next config with compile-time type safety
- src-tauri/                 Rust backend (13 source files)
  - src/commands/            6 modules, 17 Tauri commands
  - src/utils/               Path, platform, redact utilities
  - src/error.rs             AppError (10 variants) + RecoveryError (5 variants)
  - src/types.rs             Shared types with validation
  - src/bindings.rs          tauri-specta TypeScript binding generation
  - capabilities/            3 capability files (default, desktop, quick-pane)
  - tests/                   3 integration test files
- e2e/                       16 Playwright E2E test files
- docs/                      Bilingual documentation (en + zh, 64 files)
- locales/                   i18n translations (en, zh)
```

## Architecture Patterns

### Three-Layer State Management

```
useState (component)  ->  Zustand (global UI, 4 stores)  ->  TanStack Query (persistent data)
```

Components use `useState` for local state. Cross-component UI state lives in Zustand stores (selector syntax prevents render cascades). Server/persisted data goes through TanStack Query (5-minute stale time, 10-minute GC).

### Command-Centric Design

Every user action — keyboard shortcut, menu item, palette entry, title bar button — routes through a single `executeCommand()` entry point. The Map-based registry keeps UI triggers decoupled from implementation:

```typescript
// Keyboard shortcut, menu item, and palette all call this:
executeCommand('toggle-left-sidebar', context)
```

### Event-Driven Bridge

Rust and React communicate through Tauri events for loose coupling. Theme changes emit `theme-changed` to sync the quick pane window; quick pane submissions emit `quick-pane-submit` to update the main window. No direct window-to-window calls.

### Architecture Enforcement (ast-grep)

Three AST rules are enforced in CI:

- `hooks-in-hooks-dir.yml` — no React hooks defined in `lib/` (directory boundary)
- `no-store-in-lib.yml` — no store subscriptions in `lib/` (only `getState()` for pure logic)
- `no-destructure.yml` — no Zustand destructuring (prevents render cascades)

## Development

### Key Commands

| Command                   | Description                               |
| ------------------------- | ----------------------------------------- |
| `npm run dev`             | Start Vite dev server                     |
| `npm run tauri:dev`       | Start Tauri dev (frontend + Rust)         |
| `npm run build`           | Build frontend for production             |
| `npm run tauri:build`     | Build desktop app for current platform    |
| `npm run check:all`       | Run all 15+ quality gates                 |
| `npm run fix:all`         | Auto-fix all fixable issues               |
| `npm run test:run`        | Run Vitest unit tests (1011 tests)        |
| `npm run rust:test`       | Run Rust tests (430 tests)                |
| `npm run e2e`             | Run Playwright E2E tests (16 scenarios)   |
| `npm run rust:bindings`   | Regenerate tauri-specta TypeScript types  |
| `npm run release:prepare` | Prepare a release (version bump + checks) |

### Adding a Tauri Command

1. Define the command in `src-tauri/src/commands/` with `#[tauri::command]` and `#[specta::specta]`
2. Register it in `src-tauri/src/bindings.rs` via `collect_commands!`
3. Run `npm run rust:bindings` to regenerate TypeScript bindings
4. Use the typed command from `@/lib/tauri-bindings` in frontend code
5. Add tests at all three layers (pure function, MockRuntime, integration)

See [docs/developer/tauri-commands.en.md](docs/developer/tauri-commands.en.md) for detailed guidance.

## Tauri Plugins (20 Pre-configured)

| Plugin            | Purpose                             |
| ----------------- | ----------------------------------- |
| single-instance   | Prevent multiple app instances      |
| window-state      | Remember window position/size       |
| positioner        | Tray-relative window positioning    |
| autostart         | Launch on system startup            |
| deep-link         | Custom URL scheme (`tauri-app://`)  |
| updater           | In-app auto-updates with signatures |
| global-shortcut   | System-wide keyboard shortcuts      |
| fs                | File system access                  |
| persisted-scope   | Persist FS scope across sessions    |
| dialog            | Native open/save dialogs            |
| store             | Key-value persistence (atomic)      |
| opener            | Open URLs/files with default app    |
| clipboard-manager | Clipboard access                    |
| notification      | System notifications                |
| process           | Process control                     |
| os                | OS information                      |
| http              | HTTP client (bypass CORS)           |
| shell             | Subprocess / system open            |
| log               | Platform-specific logging targets   |
| tauri-nspanel     | macOS floating panel (NSPanel)      |

## Documentation

All documentation is available in English and Chinese:

- **[Using This Template](docs/USING_THIS_TEMPLATE.en.md)** — setup and workflow guide
- **[Developer Docs](docs/developer/README.en.md)** — 26 documents covering architecture, patterns, and guides
- **[User Guide](docs/userguide/userguide.en.md)** — end-user documentation
- **[Contributing](docs/CONTRIBUTING.en.md)** — contribution guidelines
- **[Security Policy](docs/SECURITY.en.md)** — security measures and vulnerability reporting

## Contributing

Pull requests are welcome. Please read the [contributing guidelines](docs/CONTRIBUTING.en.md) first, and check existing issues before starting work.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(tray): add system tray icon with context menu
fix(updater): handle network timeout gracefully
docs(readme): update installation instructions
```

## AI-Ready Development

This template is designed to work well with AI coding agents:

- **AGENTS.md** — project rules and architecture patterns for AI agents
- **docs/developer/** — 26 documents explaining the _why_ of patterns, not just the _how_
- **Predictable structure** — clear directory boundaries enforced by ast-grep
- **Quality gates** — `npm run check:all` catches issues before they reach production

## License

[Apache-2.0](LICENSE.md)

---

Built with [Tauri](https://tauri.app) | [React](https://react.dev) | [shadcn/ui](https://ui.shadcn.com) | [Rust](https://www.rust-lang.org/)
