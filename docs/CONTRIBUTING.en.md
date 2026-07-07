# Contributing Guidelines

**[English](CONTRIBUTING.en.md)** | [中文](CONTRIBUTING.zh.md)

Thank you for your interest in contributing!

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
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
- See `docs/developer/rust-architecture.en.md`

## Quality Gates

All PRs must pass `npm run check:all`, which includes:

- TypeScript type checking (`tsc --noEmit`)
- ESLint with strict rules
- Prettier format check
- ast-grep architecture rules (3 rules: hooks-in-hooks-dir, no-store-in-lib, no-destructure)
- React Compiler validation
- Rust `cargo fmt` and `cargo clippy`
- Vitest unit tests (800+ tests)
- Rust `cargo test` (200+ tests)

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

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Code Review

- Keep PRs focused and reasonably sized
- Write clear PR descriptions
- Respond to feedback promptly
- Update documentation as needed

## Legal

By contributing, you agree that your contributions will be licensed under the same license as the project.
