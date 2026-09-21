# Using This Template

**[English](USING_THIS_TEMPLATE.en.md)** | [中文](USING_THIS_TEMPLATE.zh.md)

This document is specific to the template and should be deleted once you're comfortable with your new project.

## Prerequisites

Before you begin, install:

- **Node.js** (v24+) - [nodejs.org](https://nodejs.org/)
- **Rust** (latest stable) - [rustup.rs](https://rustup.rs/)
- **Platform dependencies**:
  - **macOS**: `xcode-select --install`
  - **Windows**: [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
  - **Linux**: See [Tauri prerequisites](https://tauri.app/start/prerequisites/)

Then clone this template and install dependencies:

```bash
git clone <your-repo-url>
cd <your-project>
npm install
```

## Quick Setup

Update the configuration files listed below, then verify everything works:

```bash
npm run tauri:dev
```

## Manual Setup

### Configuration Checklist

| File                               | Fields to Update                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `package.json`                     | `name`, `author`, `copyright`, `license`                                                                       |
| `index.html`                       | `<title>` tag                                                                                                  |
| `src-tauri/tauri.conf.json`        | `productName`, `identifier`, `app.windows[0].title`, bundle `publisher`/`copyright`, updater endpoint + pubkey |
| `src-tauri/Cargo.toml`             | `package.name`, `package.description`, `package.authors`                                                       |
| `.github/workflows/release-v2.yml` | the product name is written literally three times (asset prefix, `finalize` argument, release title)           |
| `SECURITY.md` (repo root)          | private-advisory URL, which embeds the current owner/repo                                                      |
| `AGENTS.md` / `README.md`          | app name and description text                                                                                  |

### There are no placeholder strings — read this first

This template ships the author's real values, not placeholders. Searching for
`YOUR_USERNAME`, `YOUR_REPO`, `YOUR_PUBLIC_KEY_HERE`, `Your Name`, `Danny Smith`
or `com.tauri-app.app` finds nothing but these two pages — earlier revisions of
these instructions listed exactly those strings, and following them left people with
nothing to replace. Edit by field path instead:

| Field                                                     | Value as shipped                                                                                   | Why it matters                                                                                                                                               |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `identifier`                                              | `com.zlh12331.tauri-desktop-software-template`                                                     | app-data directory, single-instance lock, autostart entry                                                                                                    |
| `plugins.updater.endpoints`                               | `https://github.com/zlh12331/Tauri-Desktop-Software-Template/releases/latest/download/latest.json` | where your app looks for updates                                                                                                                             |
| `plugins.updater.pubkey`                                  | a `dW50cnVzdGVk...` minisign public key                                                            | which signature your app trusts                                                                                                                              |
| `bundle.publisher` / `copyright`, `package.json` `author` | `zlh12331`                                                                                         | Windows installer metadata                                                                                                                                   |
| `plugins.deep-link.desktop.schemes`                       | `["tauri-app"]`                                                                                    | the URL scheme the OS registers; `tauri-app://preferences` is shipped functionality, so renaming it is a deliberate choice, not leftover placeholder cleanup |

Regenerate the updater pair with `npm run tauri -- signer generate`, put the private
key in the `TAURI_PRIVATE_KEY` secret, and paste the printed public key into
`tauri.conf.json`. Skip it and your fork keeps polling somebody else's releases and
verifying them against somebody else's key.

To find every remaining occurrence of the template identity:

```bash
grep -rn "zlh12331\|Tauri-Desktop-Software-Template" \
  --exclude-dir=node_modules --exclude-dir=target --exclude-dir=.git .
```

### Identifier Format

Use reverse domain notation: `com.yourusername.your-app-name`

You can get your GitHub username with:

```bash
gh api user --jq .login
```

### Verify Setup

```bash
npm run check:all
npm run tauri:dev
```

## Example AI Workflow

This template includes workflow features designed for AI-assisted development. Here's an example workflow:

### 1. Plan with Task Documents

Create a task document in `docs/tasks-todo/` describing what you want to build. Ask the AI to read relevant docs and help plan the implementation. Task documents help maintain context across sessions.

### 2. Implement Iteratively

Build the feature, running quality checks periodically:

```bash
npm run check:all
```

This runs TypeScript, ESLint, Prettier, Rust checks, and tests in one command.

### 3. Check Before Finishing

Run quality checks before finishing a session to verify your work follows the architecture patterns in `docs/developer/`:

```bash
npm run check:all
```

### 4. Update Documentation

Ask the AI to update relevant developer docs in `docs/developer/` and the user guide in `docs/userguide/` to reflect new patterns or features.

### 5. Complete the Task

Move the task document to mark it done:

```bash
npm run task:complete <task-name>
```

## Setting Up GitHub Releases

To enable automated builds and auto-updates via GitHub Actions:

### 1. Generate Signing Keys

```bash
npm run tauri -- signer generate -w ~/.tauri/myapp.key
```

Save the displayed public key for the next step.

### 2. Add GitHub Secrets

In your repository: Settings → Secrets and variables → Actions

- `TAURI_PRIVATE_KEY`: Contents of `~/.tauri/myapp.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: Your key password (if set)

### 3. Update Public Key

Add your public key to `src-tauri/tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "pubkey": "<paste the public key signer generate printed>"
    }
  }
}
```

See [docs/developer/releases.en.md](developer/releases.en.md) for the full release process and auto-update system.

## Next Steps

1. **Try the app**: `npm run tauri:dev`
2. **Explore features**: Open command palette (Cmd+K), check preferences (Cmd+,)
3. **Read the docs**: Start with [docs/developer/architecture-guide.en.md](developer/architecture-guide.en.md)
4. **Set up releases**: Follow the GitHub Releases section above if using CI/CD
5. **Delete this file**: Once you're comfortable, remove `docs/USING_THIS_TEMPLATE.en.md`
