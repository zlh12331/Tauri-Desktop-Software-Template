# Contributing to Tauri-Desktop-Software-Template

Thank you for your interest in contributing! This document covers the development workflow and standards.

## Prerequisites

- **Node.js** >= 20.0.0
- **Rust** stable toolchain (via [rustup](https://rustup.rs/))
- **System dependencies** for Tauri v2 (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/))

## Getting Started

```bash
# Install dependencies
npm ci

# Start development
npm run tauri:dev

# Run quality checks
npm run check:all
```

## Git Hooks

This project uses [Husky](https://typicode.github.io/husky/) for Git hooks. Hooks are installed automatically when you run `npm ci`.

### Pre-commit (`pre-commit`)

Runs [lint-staged](https://github.com/lint-staged/lint-staged) on staged files:

| File type                       | Commands                                            |
| ------------------------------- | --------------------------------------------------- |
| `*.{ts,tsx,js,jsx}`             | `eslint --fix --max-warnings 0`, `prettier --write` |
| `*.{json,css,md,yml,yaml,html}` | `prettier --write`                                  |
| `*.rs`                          | `rustfmt`                                           |

### Commit message (`commit-msg`)

Validates commit messages using [commitlint](https://commitlint.js.org/) with
[Conventional Commits](https://conventionalcommits.org/).

### Pre-push (`pre-push`)

Runs the full test suite before allowing a push:

1. **Vitest** unit tests (`npm run test:run`)
2. **Playwright** E2E tests (`npm run e2e`)

If any test fails, the push is aborted.

## Commit Message Convention

This project follows [Conventional Commits](https://conventionalcommits.org/).

### Format

```
type(scope): subject

[optional body]

[optional footer(s)]
```

### Allowed Types

| Type       | Description                                      |
| ---------- | ------------------------------------------------ |
| `feat`     | A new feature                                    |
| `fix`      | A bug fix                                        |
| `docs`     | Documentation only changes                       |
| `style`    | Code style changes (formatting, no logic change) |
| `refactor` | Code refactoring (no feature or bug fix)         |
| `perf`     | Performance improvement                          |
| `test`     | Adding or correcting tests                       |
| `build`    | Build system or dependency changes               |
| `ci`       | CI configuration changes                         |
| `chore`    | Other changes (no src or test modifications)     |
| `revert`   | Reverting a previous commit                      |

### Rules

- Header must be 5-100 characters
- Subject must be lowercase
- Subject must not end with a period
- Use imperative mood ("add" not "added")

### Examples

```
feat(tray): add system tray icon with context menu
fix(updater): handle network timeout gracefully
docs(readme): update installation instructions
test(e2e): add crash report dialog tests
chore(deps): upgrade tauri to 2.11.5
```

## Quality Gates

### Frontend

| Command                | Description                         |
| ---------------------- | ----------------------------------- |
| `npm run typecheck`    | TypeScript type checking            |
| `npm run lint`         | ESLint (0 warnings allowed)         |
| `npm run ast:lint`     | ast-grep architecture rules         |
| `npm run format:check` | Prettier format check               |
| `npm run test:run`     | Vitest unit tests (821 tests)       |
| `npm run e2e`          | Playwright E2E tests (16 scenarios) |
| `npm run knip`         | Dead code detection                 |
| `npm run jscpd`        | Code duplication detection          |

### Rust

| Command                       | Description               |
| ----------------------------- | ------------------------- |
| `cargo fmt --check`           | Rust formatting check     |
| `cargo clippy -- -D warnings` | Rust linting (0 warnings) |
| `cargo test`                  | Rust tests (239 tests)    |

### All-in-one

```bash
npm run check:all   # Run all quality gates
npm run fix:all     # Auto-fix all fixable issues
```

## Testing

This project uses a three-layer testing strategy:

### Frontend Unit Tests (Vitest)

- 821 tests across 46 test files
- Testing Library + jsdom environment
- Tauri APIs mocked in `src/test/setup.ts`
- Custom render helper in `src/test/test-utils.tsx` (wraps QueryClient + i18n + ThemeProvider)
- Coverage threshold: 60% (lines, functions, branches, statements)

### E2E Tests (Playwright)

- 16 test files covering all major features
- Runs against Vite dev server with mocked Tauri APIs
- Complete Tauri runtime mock in `e2e/mocks/tauri-mock.ts`
- Includes WCAG 2.1 AA accessibility audits via `@axe-core/playwright`
- Chromium only (matches Tauri's WebView2/WebKit usage)

### Rust Tests (cargo test)

- 239 tests (inline unit tests + 3 integration test files)
- Three-layer architecture: `#[tauri::command]` wrapper -> `_impl<R: Runtime>` generic -> `_to_path()` pure function
- Uses `MockRuntime` for AppHandle mocking and `TempDir` for filesystem isolation
- Coverage threshold: 60% lines (CI enforced via `cargo +nightly llvm-cov`)

### Adding Tauri Commands

When adding a new Rust command:

1. Define the command in `src-tauri/src/commands/` with `#[tauri::command]` and `#[specta::specta]`
2. Register it in `src-tauri/src/bindings.rs` via `collect_commands!`
3. Run `npm run rust:bindings` to regenerate TypeScript bindings
4. Use the typed command from `@/lib/tauri-bindings` in frontend code
5. Add tests at all three layers (pure function, MockRuntime, integration)

See `docs/developer/tauri-commands.en.md` for detailed guidance.

## CI/CD

GitHub Actions workflows are defined in `.github/workflows/`:

- **ci.yml** - Runs on push/PR to main: security audit -> quality gates -> E2E -> three-platform build
- **release.yml** - Runs on version tags: quality gates -> signed release builds with auto-updater JSON

All contributions must pass CI before merging.
