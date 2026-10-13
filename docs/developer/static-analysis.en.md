# Static Analysis

**[English](static-analysis.en.md)** | [中文](static-analysis.zh.md)

All static analysis tools configured in this app and how to use them.

## Quick Reference

| Tool           | Purpose                  | Command                        | In check:all |
| -------------- | ------------------------ | ------------------------------ | ------------ |
| TypeScript     | Type checking            | `npm run typecheck`            | Yes          |
| ESLint         | Syntax, style, TS rules  | `npm run lint`                 | Yes          |
| cspell         | Spell checking           | `npm run cspell:check`         | Yes          |
| Prettier       | Code formatting          | `npm run format:check`         | Yes          |
| ast-grep       | Architecture patterns    | `npm run ast:lint`             | Yes          |
| i18n check     | Extract drift + key sync | `npm run i18n:check`           | Yes          |
| React Compiler | Automatic memoization    | Build-time                     | Yes          |
| cargo fmt      | Rust formatting          | `npm run rust:fmt:check`       | Yes          |
| clippy         | Rust linting             | `npm run rust:clippy`          | Yes          |
| cargo-machete  | Rust unused deps         | `npm run rust:machete`         | Yes          |
| Vitest         | Frontend tests           | `npm run test:run`             | Yes          |
| cargo test     | Rust tests               | `npm run rust:test`            | Yes          |
| gate self-test | Custom guards' own tests | `npm run test:scripts`         | Yes          |
| bundle budget  | Artifact size + maps     | `npm run bundle:check`         | Yes          |
| npm audit      | Dependency advisories    | `node scripts/check-audit.mjs` | CI only      |
| knip           | Unused code detection    | `npm run knip`                 | No           |
| jscpd          | Duplicate code detection | `npm run jscpd`                | No           |

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

### Bundle budget

```bash
npm run build         # produces dist/ — the check reads it, it does not build
npm run bundle:check
```

`scripts/check-bundle.mjs` puts a ceiling on what the app ships, measured as gzip
of `dist/assets`. Five budgets, all in `scripts/lib/bundle-metrics.mjs` beside the
baseline each was derived from:

| Budget             | Measures                                                                    |
| ------------------ | --------------------------------------------------------------------------- |
| `jsGzip`           | every JS byte the main window parses                                        |
| `cssGzip`          | Tailwind output plus component CSS                                          |
| `largestChunkGzip` | the single biggest chunk, so a new heavy dependency cannot hide in one line |
| `quickPaneJsGzip`  | the resident hidden window, paid for by users who never open it             |
| `distGzipTotal`    | what Tauri embeds into the binary                                           |

Three properties of this gate are deliberate:

- **An empty `dist` cannot pass.** `measure([])` returns 0 against every ceiling,
  so `isDistPopulated()` is checked separately and the CLI refuses to run at all
  when `dist/assets` is absent. Reading "nothing measured" as "nothing exceeded"
  is the same failure shape as a coverage report with no statements.
- **React Compiler is verified by its output, not its config.** `@rolldown/plugin-babel`
  accepts the compiler preset even when the plugin cannot be resolved; the build
  succeeds and silently stops memoizing. The compiler emits
  `Symbol.for('react.memo_cache_sentinel')`, which survives minification, so the
  gate counts it in the built JS. Zero hits fails the build; a count far below the
  baseline warns.
- **A source map in `dist/` fails the build.** Everything under `frontendDist` is
  embedded into the executable, so a surviving `.map` ships to every user.
  `vite.config.ts` only emits maps when the same build can hand them to Sentry,
  and this check is what confirms that held.

Budgets move only upward in a change that says why; the baseline comment above each
number is the review surface. `build.chunkSizeWarningLimit: 600` in `vite.config.ts`
is a Vite warning threshold, not a budget — it was raised to fit components that
already existed, and raising a ceiling to match current output is not enforcement.

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

### npm audit (CI only)

Not in `check:all`, because the audit endpoint is served by the npm registry: a mirror that does not proxy it makes the command fail on an otherwise healthy machine. CI runs it against the public registry.

```bash
node scripts/check-audit.mjs --registry=https://registry.npmjs.org
```

This script replaces a bare `npm audit --audit-level=high`. Some advisories have no patched release yet, and npm marks every package that depends on one as equally vulnerable, so a single unpatched transitive package would redden its whole chain. Advisories listed in the script's `IGNORED` array are waived, but severity is recomputed from the causes that remain, so an exemption can only ever hide the advisory it names. It follows the same contract as the exemptions in `src-tauri/deny.toml`: a written reason, a review date, and removal as soon as upstream ships a fix.

### Gate script self-tests

```bash
npm run test:scripts    # node --test scripts/
```

Every custom guard in `scripts/` decides something a human no longer looks at:
which advisories are exempted, whether coverage dropped, whether the two
translation catalogs still match. A guard whose comparison is broken does not
report an error — it reports success, forever, which is indistinguishable from a
guard that is working.

This is not hypothetical. An early version of `check-audit.mjs` compared each
package's severity against `RANK['none']`, and `none` had no rank, so the
comparison was `undefined` and every `severity > worst` test evaluated false.
The gate exited 0 for any input, including a tree with a real high-severity
advisory. It was caught only by writing down the negative case: run the gate with
the exemption list emptied and assert that it now names the packages.

So the decision logic lives in `scripts/lib/*.mjs` as pure functions, and
`scripts/lib/*.test.mjs` covers them with the Node built-in test runner — no
registry round trip, no coverage run required. `check-coverage.mjs` carries the
same class of guard in the other direction: `pct()` returns 100 for an empty
denominator, so the CLI refuses any metric whose total is zero rather than
reading "nothing measured" as "fully covered".

When you add a guard, add its negative test in the same change. A test that
cannot fail is not a gate.

## CI Integration

`check:all` runs in CI. Ensure it passes locally before pushing:

```bash
npm run check:all
```

## Adding New Rules

**ESLint:** Add rules to `eslint.config.js`

**ast-grep:** Create YAML files in `.ast-grep/rules/`; refer to the AST-grep documentation for the rule syntax.

**Prettier:** Modify `prettier.config.js`
