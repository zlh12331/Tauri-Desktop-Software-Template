# Testing

**[English](testing.en.md)** | [中文](testing.zh.md)

What each test layer proves, which of them run where, and the coverage register
that CI holds the project to.

## The five layers

| Layer          | Command                | Count | What it proves                                                        |
| -------------- | ---------------------- | ----- | --------------------------------------------------------------------- |
| Unit (TS)      | `npm run test:run`     | 1022  | Pure logic, hooks, components under a mocked Tauri runtime            |
| Rust           | `npm run rust:test`    | 423   | Commands, error mapping, file IO — unit plus `tests/*_integration.rs` |
| E2E            | `npm run e2e`          | 97    | Real Chromium against the dev server with mocked IPC; a11y included   |
| Gate tests     | `npm run test:scripts` | 70    | The quality gates themselves: a gate that cannot fail is a bug        |
| Startup budget | `npm run e2e:startup`  | 1     | Production bundle paints and mounts inside the shipped budget         |

Business logic is tested at three levels on purpose — pure function, mocked
runtime, and integration — because the Tauri boundary is where behavior actually
diverges: `invoke` works differently in a jsdom test, in Chromium with
`__TAURI_INTERNALS__` mocked, and in the real shell.

## Running a subset

```bash
npm run test:run src/lib/logger.test.ts      # one file
npm run test:run -- -t "redact"             # one test name
npm run rust:test                            # all Rust tests (from src-tauri)
npm run e2e -- e2e/app-launch.spec.ts       # one spec file
```

## Where each gate actually runs

`npm run check:all` covers typecheck, lint, cspell, ast-grep, format, i18n,
version parity, Rust fmt/clippy/machete, build, bundle budget, gate tests, unit
tests and Rust tests. Three things are **not** in it:

| Check                   | Where it runs | Consequence of not knowing                  |
| ----------------------- | ------------- | ------------------------------------------- |
| `npm run test:coverage` | CI only       | A coverage regression is invisible until CI |
| `npm run e2e`           | CI only       | UI regressions pass `check:all`             |
| `npm run readme:check`  | CI docs job   | Documented test counts drift silently       |

Run `npm run test:coverage` before anything release-shaped.

## Coverage exemption register

Floors asserted by `scripts/check-coverage.mjs` — a drop below them fails CI and
must be justified in this file, not by editing the constant:

- statements: 97.07%
- branches: 92.84%

full-suite coverage: statements 97.79% / branches 94.34% / functions 97.28% / lines 99.51%

The line above is rewritten by `node scripts/check-coverage.mjs` (without
`--check-only`); do not hand-edit it.

Exempted locations, each verified to still exist by the same script:

| Location             | Reason                                            |
| -------------------- | ------------------------------------------------- |
| `GeneralPane.tsx:42` | Defensive guard for a state the UI cannot produce |

Excluded from measurement entirely (`vitest.config.ts` → `coverage.exclude`):
generated bindings (`src/lib/bindings.ts`), entry points, the shadcn/ui wrappers
under `src/components/ui/**`, and `src/lib/app-reload.ts` — a one-line browser
navigation whose caller is covered through a module mock, since no test realm
allows replacing the unforgeable `window.location` it wraps.

## Test environment notes

Vitest runs with `pool: 'vmThreads'`: without it, 58 test files build 58 jsdom
environments, which measured as 65% of the whole suite's time before any
assertion ran. The trade-off is real and bites exactly once — inside a VM context
`window` and `window.location` are non-configurable, so tests must not
`defineProperty` over them. Intercept browser effects through a module and
`vi.mock` it instead, the way the error-boundary tests already do for recovery,
Sentry and logging.

`isolate: false` is not available here: sharing module state between files fails
179 tests, because the i18n singleton and the Zustand stores leak across specs.

E2E runs with one worker. Playwright's default parallelism put 2 of 97 tests on a
10-second timeout on a single dev server that compiles its module graph on demand.

## Adding tests

- Non-trivial business logic gets a unit test; anything crossing IPC gets one at
  the mocked-runtime layer too.
- New quality-gate scripts need a `*.test.mjs` beside them — that is how a gate
  proves it can fail. `scripts/run-gate-tests.mjs` discovers them and exits 1 if
  none are found, so a renamed file cannot quietly empty the suite.
- Architecture rules are covered by the ast-grep contract suite
  (`scripts/lib/ast-grep-contracts.mjs`): adding a rule without a violating and a
  compliant fixture fails `npm run test:scripts`. See
  [static analysis](static-analysis.en.md).
