# Static Analysis

**[English](static-analysis.en.md)** | [中文](static-analysis.zh.md)

All static analysis tools configured in this app and how to use them.

## Quick Reference

| Tool           | Purpose                  | Command                  | In check:all |
| -------------- | ------------------------ | ------------------------ | ------------ |
| TypeScript     | Type checking            | `npm run typecheck`      | Yes          |
| ESLint         | Syntax, style, TS rules  | `npm run lint`           | Yes          |
| cspell         | Spell checking           | `npm run cspell:check`   | Yes          |
| Prettier       | Code formatting          | `npm run format:check`   | Yes          |
| ast-grep       | Architecture patterns    | `npm run ast:lint`       | Yes          |
| i18n check     | Extract drift + key sync | `npm run i18n:check`     | Yes          |
| React Compiler | Automatic memoization    | Build-time               | Yes          |
| cargo fmt      | Rust formatting          | `npm run rust:fmt:check` | Yes          |
| clippy         | Rust linting             | `npm run rust:clippy`    | Yes          |
| cargo-machete  | Rust unused deps         | `npm run rust:machete`   | Yes          |
| Vitest         | Frontend tests           | `npm run test:run`       | Yes          |
| cargo test     | Rust tests               | `npm run rust:test`      | Yes          |
| knip           | Unused code detection    | `npm run knip`           | No           |
| jscpd          | Duplicate code detection | `npm run jscpd`          | No           |

CI additionally runs [actionlint](https://github.com/rhysd/actionlint) on all
GitHub Actions workflows and [gitleaks](https://github.com/gitleaks/gitleaks)
secret scanning.

## Running All Checks

```bash
npm run check:all    # Must pass before commits
npm run fix:all      # Auto-fix what can be fixed
```

## Tool Details

### ESLint

Handles syntax, style, and TypeScript-specific rules.

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
```

Configuration in `eslint.config.js`.

**Pinned versions (deliberate — do not re-bump them):**

- `brace-expansion` stays on the 1.x line inside the one subtree that needs it.
  `package.json` overrides it to `^1.1.18` scoped to `eslint-plugin-react → minimatch`.
  The 1.x ceiling is not ours to lift: `minimatch@3.1.5` declares
  `brace-expansion@^1.1.7`, so 5.x can never resolve there. The caret still floats, so
  that subtree keeps taking 1.x patches (`1.1.21` is installed) — the override raises a
  floor, it does not freeze a release. Nothing else waits on it — `glob`, `i18next-cli`
  and `@typescript-eslint/typescript-estree` each resolve `brace-expansion@5.0.12` nested
  under their own `minimatch@10.2.6`. There is deliberately no direct `brace-expansion`
  dependency: the override is the only load-bearing piece, and a direct entry just makes
  `npm outdated` and Dependabot report a `1.1.21 → 5.0.12` bump that the pinned subtree
  cannot accept. Revisit only if `eslint-plugin-react` drops `minimatch@3`, then delete
  the override.
- `jsdom` stays at 29.x for an unrelated reason: on jsdom 30 a Radix Select cannot be
  reopened by a later test in the same file. See the note at the top of
  `src/test/setup.ts`.

### Prettier

Consistent code formatting.

```bash
npm run format:check   # Check formatting
npm run format         # Fix formatting
```

Configuration in `prettier.config.js`.

### ast-grep

Enforces architectural patterns ESLint can't detect. Catches violations like Zustand destructuring and hooks in wrong directories.

```bash
npm run ast:lint    # Scan for violations
npm run ast:fix     # Auto-fix where possible
```

**Key rules:**

- No Zustand destructuring (causes render cascades)
- Hooks must be in `hooks/` directory
- No store subscriptions in `lib/`

Custom ast-grep rules are authored as YAML files in `.ast-grep/rules/`; refer to the AST-grep documentation for the rule syntax.

### React Compiler

Handles memoization automatically at build time. You do **not** need to manually add:

- `useMemo` for computed values
- `useCallback` for function references
- `React.memo` for components

The compiler analyzes code and adds memoization where beneficial.

**Note:** The `getState()` pattern is still critical - it avoids store subscriptions, not memoization. See [state-management.en.md](./state-management.en.md).

### Rust Tooling

```bash
npm run rust:fmt:check   # Check formatting
npm run rust:fmt         # Fix formatting
npm run rust:clippy      # Lint with clippy
npm run rust:clippy:fix  # Auto-fix clippy warnings
npm run rust:test        # Run Rust tests
```

### knip (Periodic Cleanup)

Detects unused exports, dependencies, and files. Not in `check:all` - use periodically.

```bash
npm run knip
```

### jscpd (Periodic Cleanup)

Detects duplicated code blocks. Not in `check:all` - use periodically.

```bash
npm run jscpd
```

Use `npm run knip` and `npm run jscpd` for guided analysis and cleanup of dead code and duplications.

## CI Integration

`check:all` runs in CI. Ensure it passes locally before pushing:

```bash
npm run check:all
```

## Adding New Rules

**ESLint:** Add rules to `eslint.config.js`

**ast-grep:** Create YAML files in `.ast-grep/rules/`; refer to the AST-grep documentation for the rule syntax.

**Prettier:** Modify `prettier.config.js`
