# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-08-20

### Features

- Initial release
- 模版评价

### Bug Fixes

- Rebrand all project names, identifiers, and metadata
- Enforce lf line endings via .gitattributes
- **deps**: Update plist to 1.10.0 fixing quick-xml vulnerabilities
- **security**: Configure cargo-deny and cargo-audit for compliance
- **a11y**: 修复 3 条 WCAG 违规并启用完整无障碍审计
- **ci**: 修复 CI 自首次提交以来一直失败的问题
- **ci**: 修复 release.yml 工作流解析失败与 Prettier 格式检查失败
- **test**: 调整覆盖率配置使 CI 通过
- **ci**: Use env.X instead of secrets.X in if clauses
- **knip**: Mark error-codes.ts as entry point
- **jscpd,refactor**: Extract useThemeApplier hook to eliminate duplication
- **ci**: Install Linux system deps before Rust clippy/tests in CI quality job
- **ci**: Restore release trigger to tags only
- **ci**: Use --no-bundle for CI build verification
- **deps**: Override brace-expansion to ^1.1.16 to fix ghsa-3jxr-9vmj-r5cp
- Normalize vitest cwd for windows drive-letter bug
- Align release workflow and release script with node 24 and cross-platform
- **ci**: Use valid actionlint tag and patch dependency vulnerabilities
- **ci**: Add pwsh shells for powershell steps and extend license allowlist
- **ci**: Exclude private packages from license check and quote env var
- **ci**: Allowlist fake api keys in gitleaks config
- **ci**: Bump h2 and ignore unpatchable rkyv advisory
- **ci**: Ignore override dep and license names in knip
- **ci**: Fetch full history for gitleaks on pr events
- **scripts**: Address codeql alerts for command injection and file races
- **accessibility**: Meet wcag aa contrast and stabilize axe timing
- **scripts**: Remove shell from release exec calls

### Code Refactoring

- Remove dead error-codes module and fix knip false positives

### Documentation

- **conversations**: 记录无障碍修复对话
- Record coverage exemption register after unit test pass
- Record rust coverage exemption register
- **readme**: Redesign project overview and readme

### Testing

- Replace release-v2.yml content with ci.yml content to isolate parse issue
- Minimal release-v2.yml with tags trigger and workflow_dispatch
- Restore release-v2.yml with branches trigger instead of tags
- Release-v2.yml with only quality job (no publish-tauri)
- Add minimal publish-tauri job
- Add permissions+matrix to publish-tauri
- Restore full publish-tauri steps
- Remove cert import + build steps
- Add back tauri-action build step (no cert import)
- Add back all cert import + cleanup steps
- Add only Windows cert import step
- Remove if clause from Windows cert import
- Wrap if clause in ${{ }} expression syntax
- Use env.X instead of secrets.X in if clause
- Batch 1/14 add unit tests for src/lib/redact.ts
- Batch 2/14 add redaction + consent-sync-failure tests for sentry.ts
- Batch 3/14 menu command context showtoast branches and cache (menu.ts 100% branch)
- Batch 4/14 use-auto-updater check/download/relaunch and cancelled guards (100% all)
- Batch 5/14 use-square-corners-effect platform/fullscreen/resize/guards (100% all)
- Batch 6/14 quick pane app unit tests
- Batch 7/14 command palette unit tests
- Batch 8/14 general pane shortcut/rollback tests
- Batch 9/14 window commands non-error rejection tests
- Batch 10/14 commands index entry tests
- Batch 11/14 title bar platform dispatch tests
- Batch 12/14 i18n config lazy load paths
- Batch 13/14 preferences dialog tests
- Batch 14/14 crash report dialog guards and error paths
- **rust**: Batch 1/5 path utils integration tests
- **rust**: Batch 2/5 notification validation tests
- **rust**: Batch 3/5 tray state and position mapping tests
- **rust**: Batch 4/5 quick pane shortcut validation tests
- **rust**: Batch 5/5 crash report consent init tests
- Cover theme applier, layout entry and app init paths

### Miscellaneous

- Add dependabot config, codeql workflow, and code of conduct
- **deps**: Bump all dependencies to latest versions
- **deps**: Bump actions/setup-node from 6 to 7 (#19)
- **deps**: Bump thiserror from 2.0.18 to 2.0.19 in /src-tauri (#23)
- **deps**: Bump regex from 1.12.4 to 1.13.1 in /src-tauri (#22)
- **deps**: Bump tauri-plugin-dialog from 2.7.1 to 2.7.2 in /src-tauri (#18)
- **deps**: Bump tokio from 1.52.3 to 1.53.1 in /src-tauri (#20)
- **deps**: Bump tauri-plugin-store from 2.4.3 to 2.4.4 in /src-tauri (#21)
- **deps**: Bump @sentry/vite-plugin, i18next, and vite to latest
- Add vscode ide deep adaptation and improve agents.md
- **deps**: Bump sentry to 0.49 and adapt client options builder
- **deps**: Bump serde_json from 1.0.150 to 1.0.151 in /src-tauri (#26)
- **deps**: Bump tauri-plugin-positioner in /src-tauri (#27)
- **deps**: Bump serde from 1.0.228 to 1.0.229 in /src-tauri (#30)
- **deps**: Bump the radix group across 1 directory with 15 updates (#32)
- **deps**: Bump tauri-plugin-log from 2.8.0 to 2.9.0 in /src-tauri (#29)
- **deps**: Bump the tauri group across 1 directory with 2 updates (#33)
- **deps**: Bump the react group across 1 directory with 2 updates (#43)

### Continuous Integration

- Add ai-dev hard constraints (secrets, licenses, bindings, rules)
- Enforce i18n catalog consistency and no hardcoded jsx text
- Add i18n consistency check to release workflow quality gate
- Use cargo-binstall for audit tools to cut build time
- **release**: Vend pinned git-cliff install in quality job
- **release**: Fetch full git history for git-cliff in quality job
- **release**: Use valid uploadUpdaterJson input for tauri-action

### Build System

- Replace custom i18n scripts with i18next-cli and redesign constraints
- Add cargo-machete, cspell, and actionlint to the toolchain
- Automate release, changelog, coverage and language setup
- Add pr review guardrails and readme test-count guard

<!-- Generated by git-cliff -->
