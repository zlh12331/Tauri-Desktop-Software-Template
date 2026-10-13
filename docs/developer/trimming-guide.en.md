# Trimming This Template

**[English](trimming-guide.en.md)** | [中文](trimming-guide.zh.md)

This template ships a working product, not a blank window. `src-tauri/src` is
5,808 lines of Rust and `src/` is 10,090 lines of TypeScript, and most of it
belongs to features you may not want: a quick-entry panel, crash reporting with a
consent gate, a tray icon, emergency recovery files, an auto-updater.

The measure of a template is how fast a fork becomes the adopter's own app. This
document's goal is **30 minutes from clone to an app that is empty, green, and
small** — where "green" is `npm run check:all` and "small" is the budget in
[static-analysis](./static-analysis.en.md).

Every file list below was produced by grep on the current tree, and each section
ends with the command that proves you finished. Trust the command over the list:
the lists go stale as the template moves, the greps do not.

## The procedure, which is the same for every feature

A feature in this template always occupies the same seven places. Removing one
means touching all seven, in this order:

| #   | Layer                 | Where                                                                          | How to find the rest                             |
| --- | --------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------ |
| 1   | Rust command module   | `src-tauri/src/commands/<name>.rs`                                             | —                                                |
| 2   | Module declaration    | `src-tauri/src/commands/mod.rs`                                                | `grep -n "<name>" src-tauri/src/commands/mod.rs` |
| 3   | IPC registration      | `src-tauri/src/bindings.rs` — `use` at line 4 and the `collect_commands!` list | `grep -n "<name>::" src-tauri/src/bindings.rs`   |
| 4   | Startup wiring        | `src-tauri/src/lib.rs` — plugin registration, `setup`, the event loop          | `grep -n "<name>\|init_" src-tauri/src/lib.rs`   |
| 5   | Types and preferences | `src-tauri/src/types.rs` (+ `AppPreferences` fields)                           | `grep -n "<Field>" src-tauri/src/types.rs`       |
| 6   | Frontend              | components, hooks, stores, the render call in `App.tsx` / `MainWindow.tsx`     | `grep -rn "<PascalCase>" src/`                   |
| 7   | Contract + strings    | `src/lib/bindings.ts` (regenerate, never edit), `locales/*.json`, tests        | `npm run rust:bindings`                          |

Then verify, in this order, because each step's failures are the previous step's
incomplete work:

```bash
npm run rust:bindings     # regenerate the type contract first
cd src-tauri && cargo test        # Rust: dangling refs and broken tests
npm run check:all                 # the whole JS + Rust gate
npm run knip                      # leftover exports, files and dependencies
node scripts/check-bundle.mjs     # re-cut the size budgets to your app
```

`cargo test` is the load-bearing one. `bindings.rs` names every command, so a
module you deleted but left registered is a compile error rather than a runtime
mystery.

Two traps specific to this repo:

- **`npm run rust:bindings` must come before `check:all`.** The bindings drift
  guard in CI regenerates `src/lib/bindings.ts` and fails on any difference, so a
  stale file reddens `Code Quality` — and because `e2e` and every platform build
  need `quality`, that one stale file skips the whole matrix.
- **`knip` is advisory until you make it a decision.** It reports unused exports
  and unused dependencies; a half-removed feature almost always leaves both.
  Run it after trimming and read the output rather than trusting your own list.

## Feature map

Measured contact points per removable feature. "Commands" are the ones in
`bindings.rs` that belong to it.

| Feature                  | Rust                                                                                                | Frontend                                                                                                                                                                                                                                                    | Extra surfaces                                                                                                                                                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quick pane               | `commands/quick_pane.rs` (545 lines, 5 commands)                                                    | `quick-pane.html`, `src/quick-pane-main.tsx`, `src/quick-pane.css`, `components/quick-pane/`                                                                                                                                                                | `capabilities/quick-pane.json`, `vite.config.ts:73-78` second input, `hooks/useMainWindowEventListeners.ts`, `preferences/panes/GeneralPane.tsx:36-73`, `locales` `quickPane.*`, `e2e/quick-pane-event.spec.ts`, `types.rs:11` default shortcut, `lib.rs` window-state denylist |
| Crash reporting + Sentry | `commands/crash_report.rs` (1,152 lines, 3 commands), panic hook in `lib.rs:227`, `utils/redact.rs` | `components/crash-report/`, `hooks/use-crash-reporting.ts`, `store/crash-report-store.ts`, `lib/sentry.ts`, `lib/redact.ts`, `initSentry()` at `main.tsx:13` and `quick-pane-main.tsx:11`, `App.tsx:79` + `App.tsx:21` debug panel, `MainWindow.tsx:15,142` | `preferences/panes/AdvancedPane.tsx` consent UI, `locales` `crashReport.*`, `e2e/crash-report*.spec.ts`, `src-tauri/tests/crash_report_integration.rs`, npm + cargo Sentry deps                                                                                                 |
| Tray                     | `commands/tray.rs` (377 lines, 2 commands), `init_tray` in `lib.rs:284`                             | none                                                                                                                                                                                                                                                        | `lib.rs` window close-to-hide handler, `locales` `menu.*`, `src-tauri/tests/tray_integration.rs`                                                                                                                                                                                |
| Recovery files           | `commands/recovery.rs` (962 lines, 3 commands)                                                      | `lib/recovery.ts`, called by `components/ErrorBoundary.tsx`                                                                                                                                                                                                 | `locales` `errorBoundary.*`, `types.rs` `RecoveryError`, `e2e` indirectly                                                                                                                                                                                                       |
| Auto-updater             | plugin registration in `lib.rs`, `desktop.json` capability                                          | `lib/updater.ts`, `hooks/use-auto-updater.ts`, `App.tsx:80`, `lib/menu.ts:169`, `lib/commands/app-commands.ts`                                                                                                                                              | `tauri.conf.json` `plugins.updater` + `bundle.createUpdaterArtifacts`, `.github/workflows/release-v2.yml`, `docs/developer/releases.*.md`                                                                                                                                       |
| Deep link                | plugin in `lib.rs`, `register_all` at `:297-316`                                                    | `hooks/use-deep-link.ts`, `App.tsx:78`                                                                                                                                                                                                                      | `tauri.conf.json` `plugins.deep-link`, `lib/commands/*` targets                                                                                                                                                                                                                 |
| Notifications            | `commands/notifications.rs` (1 command)                                                             | `lib/notifications.ts`, `lib/commands/notification-commands.ts`                                                                                                                                                                                             | `locales` `toast.*` partially                                                                                                                                                                                                                                                   |
| HTTP client              | plugin registration at `lib.rs:157`                                                                 | nothing — no `fetch()` in `src/`                                                                                                                                                                                                                            | already un-granted from `capabilities/default.json`; see [architecture-guide](./architecture-guide.en.md)                                                                                                                                                                       |

**Keep the skeleton.** `lib/bindings.ts`, `lib/tauri-bindings.ts`,
`lib/commands/registry.ts`, `src/error.rs`-mirroring types, `lib/logger.ts`,
`store/ui-store.ts`, the `capabilities/` split and every `.ast-grep` rule are the
reason the rest is safe to move. Trimming those turns a template into a folder of
examples.

## Recipe: remove the quick pane

Largest single win for a minimal app — it deletes a whole WebView entry and a
resident hidden window.

1. `src-tauri/src/commands/quick_pane.rs`; drop it from `commands/mod.rs` and from
   the `use` and `collect_commands!` in `bindings.rs` (5 entries).
2. In `lib.rs` remove `init_quick_pane` (setup), the global-shortcut registration
   block that resolves the quick-pane accelerator, and the `"quick-pane"` entry in
   the `window-state` plugin's `denylist`. If nothing else needs a
   non-restorable window, the denylist becomes empty — keep the plugin, drop the
   list.
3. `types.rs`: `DEFAULT_QUICK_PANE_SHORTCUT` and the
   `AppPreferences.quick_pane_shortcut` field. Removing a preference field is a
   contract change: `save_preferences` validation and `GeneralPane.tsx` both
   reference it.
4. Frontend: `quick-pane.html`, `src/quick-pane-main.tsx`, `src/quick-pane.css`,
   `src/components/quick-pane/`, the `quick-pane-submit` listener in
   `useMainWindowEventListeners.ts`, the shortcut picker in `GeneralPane.tsx`, and
   `e2e/quick-pane-event.spec.ts`.
5. `vite.config.ts`: the build has two inputs. Delete the `'quick-pane'` entry
   (and its `index.html` sibling in `rolldownOptions.input`); `check-bundle.mjs`'s
   `quickPaneJsGzip` budget then has no subject, so delete that budget key too —
   `findBudgetBreaches` throws on a budget with no metric, on purpose.
6. `src-tauri/capabilities/quick-pane.json`: delete the file. It is referenced by
   nothing else; Tauri discovers capabilities by directory scan.
7. Strings: `quickPane.*` in both `locales/*.json`, then `npm run i18n:check` —
   `i18next-cli status` reports dangling `t()` references, which is how you find a
   UI path you missed.
8. `npm run rust:bindings && cd src-tauri && cargo test && npm run check:all`.

**Then decide about `app.macOSPrivateApi` in `tauri.conf.json:36`.** The quick pane
is the transparent window that needs it. If your app has no other transparent or
NSPanel window, turning it off removes a flag that blocks Mac App Store
distribution, and `tauri-nspanel` (a Git-sourced crate in `Cargo.toml`, allowed by
name in `deny.toml`) can go with it. That is the single largest compliance
simplification available to a fork.

## Recipe: remove crash reporting and Sentry

Two independent halves; do both or neither, or you ship a consent dialog with no
consent state.

- **Rust**: `commands/crash_report.rs` (3 commands) plus its `mod.rs` /
  `bindings.rs` lines; `setup_panic_hook` and `init_consent_from_preferences` in
  `lib.rs`; the `CONSENT_STATE` gate inside the Sentry init block; the
  `crash_reporting_consent` field in `types.rs`.
- **Frontend**: `lib/sentry.ts`, `lib/redact.ts`, `hooks/use-crash-reporting.ts`,
  `store/crash-report-store.ts` (the fourth and last store),
  `components/crash-report/`, the render at `MainWindow.tsx:142`, the calls at
  `App.tsx:79` and the dev panel at `App.tsx:21,127`, `initSentry()` in both
  entries, the consent switch in `AdvancedPane.tsx`, `e2e/crash-report.spec.ts`
  and `e2e/crash-report-details.spec.ts`.
- **Dependencies**: the `@sentry/*` npm packages and `tauri-plugin-sentry`-adjacent
  cargo deps, plus the `sentryVitePlugin` block in `vite.config.ts:43-63`. Note
  that block is also what deletes source maps after upload — if you keep maps out
  of the bundle by other means, keep the `check-bundle.mjs` map-residue rule.
- **`ErrorBoundary.tsx` stays.** It is the React error boundary, not the crash
  reporter; it catches render failures and calls `logger` plus
  `saveCrashState()`. If you also remove recovery, it needs a fallback (reload
  button only).

Removing Sentry is the cheapest large win in bytes: `ErrorBoundary`-adjacent code
is the single biggest chunk in the build (261,923 of 397,430 gzip bytes of JS at
the time of writing, 66% of all JS you ship). If you cut it, re-cut the budgets.

## Recipe: remove the tray

`commands/tray.rs` and `init_tray` in `lib.rs`, plus `lib.rs`'s `CloseRequested`
handler — that handler is what makes closing the window hide the app instead of
quitting it. Delete it and closing the last window terminates the process, which
is what most people actually want and what the template does not do by default.
`src-tauri/tests/tray_integration.rs` goes too.

Note that both tray commands (`set_tray_icon_state`, `move_window_to_tray`) have
**no caller in `src/`** today.

## Commands nothing calls

`removeUnusedCommands: true` (`tauri.conf.json:7`) strips commands that no
frontend code references, so these cost binary bytes but not bundle bytes. They
still cost type-contract surface and reader attention:

| Command                                      | Module           | Comment                                               |
| -------------------------------------------- | ---------------- | ----------------------------------------------------- |
| `greet`                                      | `preferences.rs` | the Tauri tutorial example; the first thing to delete |
| `show_quick_pane`, `toggle_quick_pane`       | `quick_pane.rs`  | Rust's shortcut callback drives the window directly   |
| `set_tray_icon_state`, `move_window_to_tray` | `tray.rs`        | no frontend caller                                    |

Find them again with this — it runs the same way on Windows, macOS and Linux
because it is Node, not shell:

```bash
node -e "
const fs = require('fs')
const src = fs.readFileSync('src/lib/bindings.ts', 'utf8')
const names = [...src.matchAll(/^\s+([A-Za-z][A-Za-z0-9]*):\s*\(/gm)].map(m => m[1])
const files = []
const walk = d =>
  fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const p = d + '/' + e.name
    if (e.isDirectory()) walk(p)
    else if (/\.(ts|tsx)$/.test(e.name) && !/bindings\.ts$/.test(p) && !/\.test\./.test(p)) files.push(p)
  })
walk('src')
const all = files.map(f => fs.readFileSync(f, 'utf8')).join('')
console.log(names.filter(n => !all.includes('commands.' + n)))
"
```

It prints the commands that no frontend module references. At the time of writing
it reports `greet`, `showQuickPane`, `toggleQuickPane`, `setTrayIconState` and
`moveWindowToTray` out of 17.

## After trimming, the gates will be wrong on purpose

Three committed numbers describe _this_ app, so they must be re-set to yours —
each one fails loudly rather than silently passing, which is the point:

- `scripts/lib/bundle-metrics.mjs` budgets, baselines in the comments.
- `scripts/check-coverage.mjs` floors (97.07 / 92.84) and
  `vitest.config.ts` thresholds: deleting tested features keeps coverage high but
  changes what it means.
- `package.json` `readme:check --frontend/--rust/--e2e` counts, and every test
  count written into `README.md` / `README.zh.md` / `CONTRIBUTING*` — the gate
  compares them against the real files, so trim tests and it will tell you.

Also expect to edit `.github/CODEOWNERS` and the remote's required checks; both
are documented in [Using this template](../USING_THIS_TEMPLATE.en.md) as the two
settings that fail without saying so.
