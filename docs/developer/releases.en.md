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

### Release is two commands, not one

```bash
npm run release:prepare -- v1.0.0     # bumps versions, opens the release PR
# …review and merge that pull request…
npm run release:tag -- v1.0.0         # tags the merge; this starts the build
```

`release:prepare` will:

1. Check git status is clean
2. Run the version pre-flight (`check-version.mjs --pre-release`): the target
   must not already exist as a tag and must be newer than every published one
3. Run all quality checks (`npm run check:all`)
4. Update the four version fields and regenerate `CHANGELOG.md`
5. Commit on `release/v1.0.0`, push it, and open the pull request (via `gh`)

`release:tag` then reads the versions from the merged `origin/main`, refuses
unless all four agree with the requested version and no such tag exists yet, and
only then creates and pushes the tag. The tag push is what triggers the build:

1. Build the app for all platforms
2. Create a draft release
3. Generate `latest.json` for auto-updates
4. Upload all installers and signatures

Finally, manually publish the draft release on GitHub.

Why it is split: `main` is protected by a ruleset that requires a pull request
and status checks, so the old single command's final `git push origin main
--tags` is refused — and when that refusal lands after `git tag`, the tag names a
commit `main` never received. That is exactly how `v0.1.2` came to exist nowhere
while `0.1.2` was released into the wild: untagged, so the updater's
`/releases/latest/download/latest.json` still serves `v0.1.1` and `0.1.1` users
were never told an update exists. Tagging the merge makes that state
unreachable: a tag can only ever point at `main`.

### CHANGELOG Generation

This project uses [git-cliff](https://git-cliff.org/) to automatically generate
`CHANGELOG.md` from Conventional Commits.

```bash
npm run changelog
```

Configuration is in `cliff.toml` at the project root. The changelog groups
commits by type (Features, Bug Fixes, Documentation, etc.) and generates a
new version section for each `v*` tag.

`release:prepare` regenerates `CHANGELOG.md` as part of the bump, so the changelog
reaches GitHub in the same commit and the same pull request as the version
numbers:

```bash
npm run release:prepare -- v1.0.0
```

To proofread the wording first, run `npm run changelog` on its own and amend the
release commit on the `release/v1.0.0` branch. A changelog-only commit does not
belong on `main` directly — the branch protection refuses it, and the refusal
lands after the tag has already been created locally.

### Manual Method

The scripts' two steps, done by hand:

```bash
# 1. bump all four version fields, refresh the changelog, verify, open the PR
npm run version:check
npm run check:all
git checkout -b release/v1.0.0
git add .
git commit -m "chore: release v1.0.0"
git push -u origin release/v1.0.0
gh pr create --base main --head release/v1.0.0 --title "chore: release v1.0.0"

# 2. after that pull request merges: tag the merge, which starts the build
git fetch origin main
node scripts/check-version.mjs --pre-release v1.0.0
git tag -a v1.0.0 origin/main -m "Release v1.0.0"
git push origin v1.0.0
```

There is deliberately no manual form that pushes a version bump straight to
`main`. The ruleset refuses it, and the combination that gets a release stranded
is exactly that: `git tag` succeeds locally, the push is refused, and the tag is
then either left dangling or pushed to point at a commit `main` never had.

## Version Strategy

Semantic versioning (`v1.0.0`):

- **Major** (1.x.x): Breaking changes
- **Minor** (x.1.x): New features, backwards compatible
- **Patch** (x.x.1): Bug fixes

### Four places hold the version

The release is written into four files, and `scripts/prepare-release.js` rewrites
them with regex substitutions:

- `package.json` → `"version": "1.0.0"`
- `src-tauri/Cargo.toml` → `version = "1.0.0"` inside `[package]`
- `src-tauri/Cargo.lock` → the lockfile's own `[[package]]` entry for this crate
- `src-tauri/tauri.conf.json` → `"version": "1.0.0"`

The lockfile entry is the one that is easy to miss: it is what makes the docs say
"three". A half-applied bump ships a bundle whose app manifest, installer
metadata and updater metadata disagree, and the disagreement surfaces on a user's
machine as an app that cannot update. `npm run version:check` asserts all four
agree; it runs in `check:all` and as a CI step.

```bash
npm run version:check                                 # parity only — the CI gate
node scripts/check-version.mjs --pre-release v0.2.0   # before cutting a release
```

The pre-flight mode answers a different question, which is why it takes the
version as an argument: at the moment a release is being prepared, the files on
disk still carry the _previous_ version, so reading them would check the wrong
thing. It asks origin for its tags (a local clone with no fetched tags would
otherwise report "no releases yet" and wave a duplicate through) and rejects two
cases:

- the version already exists as a tag — the updater resolves
  `/releases/latest/download/latest.json`, which follows the newest tag, so two
  releases named `v0.1.2` cannot both be reachable;
- the version is not newer than the highest published tag, which is a release
  that reaches nobody.

`prepare-release.js` runs this before `check:all`, so a bad version number fails
in one second rather than after the full suite.

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
