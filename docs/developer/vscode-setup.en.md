# VSCode Setup (Developer Experience)

This template ships a turnkey VSCode configuration under `.vscode/`. Open the
project folder in VSCode and install the recommended extensions when prompted.

## What you get out of the box

| File                      | Purpose                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `.vscode/extensions.json` | Curated extension recommendations (Prettier, ESLint, Tailwind, rust-analyzer, Vitest Explorer, Playwright)                       |
| `.vscode/settings.json`   | Format-on-save (Prettier), ESLint auto-fix, rust-analyzer + clippy-as-checker, Vitest/Playwright integration, path aliases       |
| `.vscode/tasks.json`      | One-key tasks: frontend dev/build/test, Rust fmt/clippy/test, Tauri dev/build, full `check:all` / `fix:all`                      |
| `.vscode/launch.json`     | Debug the web UI (Vite :1420), debug the Tauri app on Windows/Linux/macOS, debug a single Vitest file, and a full-stack compound |

## Recommended extensions

Open the Extensions panel (`Ctrl+Shift+X`) → search `@recommended` → **Install
All**. Key ones:

- `esbenp.prettier-vscode` — formatting (matches `prettier.config.js`)
- `dbaeumer.vscode-eslint` — linting with flat config + auto-fix on save
- `rust-lang.rust-analyzer` — Rust LSP, runs `clippy` as the check command
- `vitest.explorer` — run/debug unit tests from the sidebar
- `ms-playwright.playwright` — E2E test picker and trace viewer

## Debugging

### Web UI only

Run **Frontend: Debug Web (Vite 1420)**. It starts `npm run dev` (preLaunchTask)
and attaches Chrome to `http://localhost:1420`.

### Full Tauri app (Rust + frontend)

Run **Tauri: Debug (Windows|Linux|macOS)** — launches `tauri:dev` then attaches
the native debugger to the built binary so you can set breakpoints in both `.rs`
and `.tsx` files. On Windows the `cppvsdbg` debugger is used automatically; on
Linux/macOS use the `CodeLLDB` extension (`vadimcn.vscode-lldb`).

> macOS: native panel behavior depends on `tauri-nspanel` (git dependency). The
> debug binary path is `src-tauri/target/debug/tauri-desktop-software-template`.

### Single unit test

Open any `*.test.ts(x)` file and run **Vitest: Current File** (or use the
Vitest Explorer gutter play button) to launch with `--inspect-brk`.

## Tasks

Trigger with `Ctrl+Shift+P` → **Tasks: Run Task**, or bind to a keybinding.
Notable tasks:

- `tauri: dev` / `tauri: build` — full app lifecycle
- `quality: check:all` — runs the same gate as CI (`check:all`)
- `quality: fix:all` — auto-fix lint/format/clippy

## Notes

- `.editorconfig` mirrors the Prettier/ESLint rules so non-VSCode editors stay
  consistent.
- `rust-analyzer` is configured to check via `clippy -- -D warnings`, matching CI.
- Machine-specific workspace files (`*.code-workspace`, `settings.user.json`) are
  git-ignored under `.vscode/.gitignore`.
