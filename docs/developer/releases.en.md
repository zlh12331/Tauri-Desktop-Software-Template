# Releases

**[English](releases.en.md)** | [中文](releases.zh.md)

Release process, version management, and auto-update system.

## Overview

The release system provides:

- Automated GitHub Actions workflow for building releases
- Version management script for updating all version files
- Consent-based auto-update: the app offers an update, the user decides
- Cross-platform builds (macOS, Windows, Linux)

## Initial Setup

### 1. Generate Signing Keys

```bash
npm run tauri -- signer generate -w ~/.tauri/myapp.key
# Outputs private key (saved) and public key (displayed)
```

### 2. Configure GitHub Repository

Add these secrets (Settings → Secrets and variables → Actions):

- `TAURI_PRIVATE_KEY`: Content of `~/.tauri/myapp.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: Password you set (if any)

### 3. Update Configuration

**`src-tauri/tauri.conf.json`:**

```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/<your-username>/<your-repo>/releases/latest/download/latest.json"
      ],
      "pubkey": "<your-public-key-from-step-1>"
    }
  }
}
```

**Bundle info in `tauri.conf.json`:**

- Update `publisher`, `shortDescription`, `longDescription`
- Update `productName` and `identifier`

## Release Process

### Simple Method

```bash
npm run release:prepare v1.0.0
```

This will:

1. Check git status is clean
2. Run all quality checks (`npm run check:all`)
3. Update versions in `package.json`, `Cargo.toml`, `tauri.conf.json`
4. Ask if you want to commit and push

Then GitHub Actions will:

1. Build the app for all platforms
2. Create a draft release
3. Generate `latest.json` for auto-updates
4. Upload all installers and signatures

Finally, manually publish the draft release on GitHub.

### CHANGELOG Generation

This project uses [git-cliff](https://git-cliff.org/) to automatically generate
`CHANGELOG.md` from Conventional Commits.

```bash
npm run changelog
```

Configuration is in `cliff.toml` at the project root. The changelog groups
commits by type (Features, Bug Fixes, Documentation, etc.) and generates a
new version section for each `v*` tag.

When preparing a release:

```bash
npm run release:prepare v1.0.0
npm run changelog          # Update CHANGELOG.md
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for v1.0.0"
git push origin main --tags
```

### Manual Method

```bash
# Update versions in package.json, Cargo.toml, tauri.conf.json
npm run check:all
git add .
git commit -m "chore: release v1.0.0"
git tag v1.0.0
git push origin main --tags
```

## Version Strategy

Semantic versioning (`v1.0.0`):

- **Major** (1.x.x): Breaking changes
- **Minor** (x.1.x): New features, backwards compatible
- **Patch** (x.x.1): Bug fixes

All three files must have matching versions:

- `package.json` → `"version": "1.0.0"`
- `src-tauri/Cargo.toml` → `version = "1.0.0"`
- `src-tauri/tauri.conf.json` → `"version": "1.0.0"`

## Auto-Update System

### Behavior

- The check runs 5 seconds after launch, so it does not compete with window creation.
- An available update is **offered, never applied**. A persistent toast names the
  version, shows the release notes from the manifest (`Update.body`), and offers
  Install / Later.
- Downloading and installing start only when the user presses Install. When that
  finishes, a second toast offers "Restart now" — the app never relaunches itself,
  because a restart during the user's work loses unsaved state.
- "Later" only closes the prompt. The next launch checks again, and a check that
  repeats within one session replaces the existing toast instead of stacking one.
- A startup check treats a network failure as normal (debug log, no toast). A check
  the user asked for reports failures.

### Update flow

```
Launch → (5s) → check endpoint ─→ no update ─→ (silent; "up to date" if asked)
                        │
                        └→ update ─→ toast(version, release notes, Install | Later)
                                        │
                                        Install → download + verify signature
                                                  → toast("installed", Restart now)
                                                  → relaunch
```

Platform asymmetry inside `downloadAndInstall()`: on Windows the installer takes the
process down as part of installing, so the "Restart now" toast is effectively a
macOS/Linux affordance.

### One implementation, three doors

`src/lib/updater.ts` owns the whole flow (`checkForUpdates`, `installPendingUpdate`).
It is reached from the post-startup hook (`src/hooks/use-auto-updater.ts`), the
application menu (App → Check for Updates) and the command palette
(`check-for-updates`). Any new surface should call `checkForUpdates({ interactive: true })`
rather than importing `@tauri-apps/plugin-updater` directly.

### Configuration

```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/<your-username>/<your-repo>/releases/latest/download/latest.json"
      ],
      "pubkey": "<your-public-key-from-step-1>"
    }
  }
}
```

Only these keys are read. In `tauri-plugin-updater` 2.11.0 the deserialized `Config`
is `endpoints`, `pubkey`, `windows`, and the three `dangerous*` flags — so the
`active` and `dialog` keys that v1-era examples carry are accepted and ignored, which
is why this template stopped writing them: `"dialog": false` never suppressed a
native dialog, it just looked like it did. Nothing is silent by design; the UI is
`src/lib/updater.ts`.

`bundle.createUpdaterArtifacts` must stay `true`, or the build produces no `.sig`
files and no `latest.json` to point at.

### Rotating the signing key

A manifest and its artifacts are verified against the public key compiled into the
installed client. Rotating the key pair is therefore a compatibility break: clients
built with the old key reject the new signature and cannot self-update.

1. Release one last build signed with the **old** key that announces the rotation and
   is otherwise ordinary — that is the version old installs can still reach.
2. Generate the new pair (`npm run tauri -- signer generate`), replace `pubkey` in
   `tauri.conf.json`, and replace the `TAURI_PRIVATE_KEY` secret.
3. Bump the version past anything published in step 1, ship, and tell users on the
   old build that this one needs a manual installer download.

### Testing an update locally

The endpoint can point at a plain HTTP server, but the plugin refuses non-HTTPS
endpoints unless told to allow it, and that flag is a temporary edit:

1. Publish a release (or fake one) whose artifacts are for your current platform,
   with a version **higher** than `tauri.conf.json` — semver equality means "no
   update", so nothing appears if you forgot to bump.
2. Serve the updater artifacts from a local directory and set
   `plugins.updater.endpoints` to that `http://` URL plus
   `"dangerousInsecureTransportProtocol": true`.
3. Run `npm run tauri:dev` and confirm the toast shows the version and notes, that
   Later dismisses it, and that Install reports progress.
4. Revert both config edits before committing. Never ship
   `dangerousInsecureTransportProtocol`.

### Manual Update Check

Users can trigger the same flow via:

- **Menu**: App → Check for Updates
- **Command palette**: Cmd+K → "Check for Updates"

## Release Artifacts

Each release creates:

- **macOS**: `.dmg` installer
- **Windows**: `.msi` installer (when configured)
- **Linux**: `.deb` and `.AppImage` (when configured)
- **Auto-updater**: `latest.json` manifest and `.sig` signature files

## Security

All updates are cryptographically signed:

1. Private key signs releases during build
2. Public key in config verifies downloads
3. Invalid signatures are automatically rejected

## Troubleshooting

| Issue                           | Solution                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| Workflow doesn't trigger        | Ensure tag starts with `v` and is pushed                                               |
| Build fails                     | Check GitHub secrets, run `npm run check:all` locally                                  |
| Updates not detected            | Verify endpoint URL and public key match, and that the version was actually **bumped** |
| Update offered, nothing happens | Expected until Install is pressed — see [Behavior](#behavior)                          |
| Download fails                  | Check signatures, file permissions, disk space                                         |

## Rust API Documentation

Generate HTML documentation for all Tauri commands, types, and modules:

```bash
npm run rust:doc
```

Output is written to `src-tauri/target/doc/`. Open `target/doc/index.html` in a
browser to browse. The docs are generated from `///` doc comments on Rust public
APIs (commands, structs, enums).
