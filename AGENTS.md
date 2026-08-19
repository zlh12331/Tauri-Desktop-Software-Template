# AI Agent Instructions

## Overview

This repository is a template with sensible defaults for building Tauri React apps.

## Core Rules

### New Sessions

- Read @docs/tasks.en.md for task management
- Review `docs/developer/architecture-guide.en.md` for high-level patterns
- Check `docs/developer/README.en.md` for the full documentation index
- Check git status and project structure

### Development Practices

**CRITICAL:** Follow these strictly:

0. **Use npm only**: This project uses `npm`, NOT `pnpm`. `packageManager` + `.npmrc` `engine-strict=true` hard-enforce this — `pnpm install` fails, and installs fail on Node < 24.
1. **Read Before Editing**: Always read files first to understand context
2. **Follow Established Patterns**: Use patterns from this file and `docs/developer`
3. **Senior Architect Mindset**: Consider performance, maintainability, testability
4. **Batch Operations**: Use multiple tool calls in single responses
5. **Match Code Style**: Follow existing formatting and patterns
6. **Test Coverage**: Write comprehensive tests for business logic
7. **Quality Gates**: Run `npm run check:all` after significant changes
8. **No Dev Server**: Ask user to run and report back
9. **No Unsolicited Commits**: Only when explicitly requested
10. **Documentation**: Update relevant `docs/developer/` files for new patterns
11. **Removing files**: Use the appropriate file deletion tool for your environment

**CRITICAL:** Use Tauri v2 docs only. Always use modern Rust formatting: `format!("{variable}")`

## Common Commands

All via `npm` (never pnpm). Run from repo root unless noted.

- `npm run dev` — Vite dev server only (frontend at `http://localhost:1420`).
- `npm run tauri:dev` — Full app: Vite + Rust backend, launches desktop window.
- `npm run build` / `npm run tauri:build` — Build frontend / build desktop bundle for current platform.
- `npm run typecheck` — `tsc --noEmit` (fast type check, no emit).
- `npm run lint` / `npm run format:check` — ESLint (zero warnings) / Prettier check.
- `npm run test:run` — Run all Vitest unit tests once. Append a path to run a subset, e.g. `npm run test:run src/lib/logger.test.ts`.
- `npm run e2e` — Playwright E2E (needs dev server or spins its own).
- `npm run rust:test` — Run Rust `cargo test` (run from `src-tauri`).
- `npm run rust:fmt:check` / `npm run rust:clippy` — `cargo fmt --check` / `cargo clippy -D warnings` (CI gates).
- `npm run rust:bindings` — **Regenerate tauri-specta TypeScript types into `src/lib/bindings.ts`** after editing any Rust command. Required before frontend typechecks reflect command changes.
- `npm run check:all` — Run every quality gate (typecheck, lint, ast-grep, fmt, clippy, both test suites). Run after significant changes.
- `npm run fix:all` — Auto-fix lint/format/clippy where safe.
- VSCode users: `.vscode/tasks.json` and `.vscode/launch.json` expose these as one-key tasks and debug configs (Tauri app + single-test debug).

## Critical Pitfalls

- **Edit a Rust command → regenerate bindings.** Any change to `#[tauri::command]` signatures in `src-tauri/src/commands/` must be followed by `npm run rust:bindings`. Frontend imports `commands.x()` from `@/lib/tauri-bindings`; stale `bindings.ts` causes type drift. CI now runs `cargo test export_bindings -- --ignored` and fails on any drift (including doc-comment changes).
- **Six ast-grep rules block anti-patterns at CI** (enforced, not advisory): `hooks-in-hooks-dir` (no React hooks in `lib/`), `no-store-in-lib` (no store subscriptions in `lib/`, only `getState()`), `no-destructure` (no Zustand destructuring — use selector syntax), `no-console` (no `console.*` in `src/`; use `@/lib/logger`), `no-ts-ignore` (use `@ts-expect-error`), `no-direct-invoke` (no raw `invoke()` imports outside `bindings.ts`).
- **Never use raw `invoke()`.** All Rust→frontend calls go through typed `commands` from `@/lib/tauri-bindings`.
- **`lib/` is pure logic** — no React, no hooks, no store subscriptions. UI/state belong in `components/`, `hooks/`, `store/`.
- **Rust error flow**: commands return `Result<T, AppError>`; `AppError` serializes as `{ kind, message }` with stable codes (`ERR_IO`, `ERR_VALIDATION`, …). Match on `.status === 'ok'` on the TS side.
- **Prettier is the formatter**, not ESLint's — `lint:fix` runs eslint, `format` runs prettier; both run on save in VSCode.

## Architecture Patterns (CRITICAL)

### State Management Onion

```
useState (component) -> Zustand (global UI) -> TanStack Query (persistent data)
```

**Decision**: Is data needed across components? -> Does it persist between sessions?

### Performance Pattern (CRITICAL)

```typescript
// GOOD: Selector syntax - only re-renders when specific value changes
const leftSidebarVisible = useUIStore(state => state.leftSidebarVisible)

// BAD: Destructuring causes render cascades (caught by ast-grep)
const { leftSidebarVisible } = useUIStore()

// GOOD: Use getState() in callbacks for current state
const handleAction = () => {
  const { data, setData } = useStore.getState()
  setData(newData)
}
```

### Static Analysis

- **React Compiler**: Handles memoization automatically - no manual `useMemo`/`useCallback` needed
- **ast-grep**: Enforces architecture patterns (e.g., no Zustand destructuring). See `docs/developer/static-analysis.en.md`
- **Knip/jscpd**: Periodic cleanup tools. Run `npm run knip` and `npm run jscpd`

### Event-Driven Bridge

- **Rust to React**: `app.emit("event-name", data)` -> `listen("event-name", handler)`
- **React to Rust**: Use typed commands from `@/lib/tauri-bindings` (tauri-specta)
- **Commands**: All actions flow through centralized command system

### Tauri Command Pattern (tauri-specta)

```typescript
// GOOD: Type-safe commands with Result handling
import { commands } from '@/lib/tauri-bindings'

const result = await commands.loadPreferences()
if (result.status === 'ok') {
  console.log(result.data.theme)
}

// BAD: String-based invoke (no type safety)
const prefs = await invoke('load_preferences')
```

**Adding commands**: See `docs/developer/tauri-commands.en.md`

### Internationalization (i18n)

```typescript
// GOOD: Use useTranslation hook in React components
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation()
  return <h1>{t('myFeature.title')}</h1>
}

// GOOD: Non-React contexts - bind for many calls, or use directly
import i18n from '@/i18n/config'
const t = i18n.t.bind(i18n)  // Bind once for many translations
i18n.t('key')                 // Or call directly for occasional use
```

- **Translations**: All strings in `/locales/*.json`
- **RTL Support**: Use CSS logical properties (`text-start` not `text-left`)
- **Adding strings**: See `docs/developer/i18n-patterns.en.md`
- **i18n validation** (`npm run i18n:check` = `i18n:extract:check` +
  `i18n:status` + `i18n:fallback`, in `check:all` + CI):
  - i18next-cli `extract` / `extract --ci` — sync new `t()` keys to catalogs,
    fail on drift. Never remove `preservePatterns: ['commands.*']` +
    `removeUnusedKeys: false` (they stop extract from DELETING dynamic keys)
  - i18next-cli `status` — missing translations + dangling `t()` refs
  - `scripts/check-i18n.mjs` (fallback) — tool blind spots only: full key-set
    parity incl. dynamic keys, `{{var}}` placeholder alignment across locale
    values. Do not move these checks to the tool (verified it misses them)

### Documentation & Versions

- **Context7 First**: Always use Context7 for framework docs before WebSearch
- **Version Requirements**: Tauri v2.x, shadcn/ui v4.x, Tailwind v4.x, React 19.x, Zustand v5.x, Vite v8.x, Vitest v4.x, TypeScript v6.x

## Developer Documentation

For complete patterns and detailed guidance, see `docs/developer/README.en.md`.

Key documents:

- `architecture-guide.en.md` - Mental models, security, anti-patterns
- `state-management.en.md` - State onion, getState() pattern details
- `tauri-commands.en.md` - Adding new Rust commands
- `static-analysis.en.md` - All linting tools and quality gates
