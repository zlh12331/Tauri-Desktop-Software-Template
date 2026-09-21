# Contributing Guidelines

**[English](CONTRIBUTING.en.md)** | [中文](CONTRIBUTING.zh.md)

Thank you for your interest in contributing!

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v24+)
- [Rust](https://rustup.rs/) (latest stable)
- Familiarity with React, TypeScript, and Rust

### Setup

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
npm install
npm run dev
npm run check:all
```

## How to Contribute

### Issues

- **Bug Reports**: Use the bug report template
- **Feature Requests**: Use the feature request template
- **Security Issues**: See [SECURITY.md](SECURITY.en.md)

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make changes following the guidelines below
4. Ensure checks pass: `npm run check:all`
5. Commit using conventional commits
6. Push and open a Pull Request

## Code Guidelines

### TypeScript/React

- Use TypeScript for all new code
- Follow existing component patterns
- See `docs/developer/` for architecture patterns

### Rust

- Use `cargo fmt` and `cargo clippy`
- Use `Result<T, AppError>` for Tauri commands (see `src-tauri/src/error.rs`)
- See `docs/developer/error-handling.en.md` and `docs/developer/architecture-guide.en.md`

## Quality Gates

All PRs must pass `npm run check:all`, which chains:

- `npm run typecheck` — `tsc --noEmit` for the app and the Node-side configs
- `npm run lint` — ESLint with `--max-warnings 0`, including react-hooks and react-compiler rules
- `npm run cspell:check` — spell check over `src/`, `locales/`, `docs/`, and config files
- `npm run ast:lint` — 6 ast-grep architecture rules: `hooks-in-hooks-dir`, `no-console`,
  `no-direct-invoke`, `no-store-in-lib`, `no-ts-ignore`, `no-destructure`
- `npm run format:check` — Prettier
- `npm run i18n:check` — catalog drift, missing keys, `{{placeholder}}` alignment
- `npm run rust:fmt:check`, `npm run rust:clippy`, `npm run rust:machete`
- `npm run test:run` — Vitest unit tests (1022 tests)
- `npm run rust:test` — Rust `cargo test` (417 tests)

Playwright E2E (97 scenarios) is **not** in `check:all`; CI runs it as its own job.
Locally use `npm run e2e`.

Additional tools (run manually):

- `npm run knip` - Detect unused code
- `npm run jscpd` - Detect code duplication

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat: add user authentication
fix(ui): resolve sidebar toggle issue
docs: update installation instructions
refactor(store): simplify state management
test: add preferences tests
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`,
`chore`, `revert` — the list enforced by `commitlint.config.js`, and a header longer
than 100 characters is rejected too.

## Code Review

- Keep PRs focused and reasonably sized
- Write clear PR descriptions
- Respond to feedback promptly
- Update documentation as needed

## Legal

By contributing, you agree that your contributions will be licensed under the same license as the project.
