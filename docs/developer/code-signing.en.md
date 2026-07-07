# Code Signing Guide

**[English](code-signing.en.md)** | [中文](code-signing.zh.md)

This guide covers configuring code signing for all platforms and the Tauri auto-updater.

## Tauri Updater Signing (Required for Auto-Updates)

The updater signing keypair has been generated and configured. The public key is embedded in
`tauri.conf.json` under `plugins.updater.pubkey`.

### GitHub Secrets to Configure

| Secret Name                          | Value                                     | Description                            |
| ------------------------------------ | ----------------------------------------- | -------------------------------------- |
| `TAURI_PRIVATE_KEY`                  | Contents of the `.tauri-updater-key` file | Private key for signing update bundles |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | The password you chose                    | Password to decrypt the private key    |

> **Warning**: If you lose the private key or its password, existing installations will not be
> able to auto-update. Store the private key securely (e.g., in a password manager or GitHub
> Secrets).

### Regenerating Keys (if needed)

```bash
npx tauri signer generate -p "your-password" -w ./tauri-updater-key --ci --force
```

Update the `pubkey` field in `tauri.conf.json` with the contents of `.tauri-updater-key.pub`,
then update the GitHub Secrets with the new private key.

### Updater Endpoint

Update the `endpoints` field in `tauri.conf.json` to point to your repository:

```json
"endpoints": [
  "https://github.com/YOUR_USERNAME/YOUR_REPO/releases/latest/download/latest.json"
]
```

---

## Windows Code Signing (Optional)

Windows code signing uses Authenticode certificates to sign `.msi` and `.exe` installers,
preventing SmartScreen warnings for end users.

### Prerequisites

- A code signing certificate (OV or EV) from a trusted CA (e.g., DigiCert, Sectigo, GlobalSign)
- The certificate exported as a `.pfx` file

### GitHub Secrets to Configure

| Secret Name                    | Value                        | Description                  |
| ------------------------------ | ---------------------------- | ---------------------------- |
| `WINDOWS_CERTIFICATE`          | Base64-encoded `.pfx` file   | The code signing certificate |
| `WINDOWS_CERTIFICATE_PASSWORD` | Password for the `.pfx` file | Certificate export password  |

### Encoding the Certificate

```bash
# macOS/Linux
base64 -i code-signing.pfx -o cert-base64.txt

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("code-signing.pfx"))
```

Copy the entire base64 string into the `WINDOWS_CERTIFICATE` GitHub Secret.

### How It Works

1. The CI workflow imports the certificate into the runner's certificate store
2. The certificate thumbprint is extracted and set as `WINDOWS_CERTIFICATE_THUMBPRINT`
3. Update `tauri.conf.json` → `bundle.windows.certificateThumbprint` with the thumbprint value
   (or use the environment variable approach in CI)
4. Tauri's build process automatically signs the installer using `signtool`

### Current Configuration

The `bundle.windows` section in `tauri.conf.json` is pre-configured with framework values:

```json
"windows": {
  "certificateThumbprint": null,
  "digestAlgorithm": "sha256",
  "timestampUrl": "http://timestamp.sectigo.com"
}
```

To enable signing, set `certificateThumbprint` to your certificate's thumbprint, or configure
it dynamically in CI.

---

## macOS Code Signing (Optional)

macOS code signing uses Apple Developer certificates to sign `.app` and `.dmg` bundles,
preventing Gatekeeper warnings.

### Prerequisites

- An Apple Developer account (enrolled in the Apple Developer Program)
- A "Developer ID Application" certificate (for distribution outside the Mac App Store)
- An App-Specific Password for notarization (create at appleid.apple.com)

### GitHub Secrets to Configure

| Secret Name                  | Value                                                 | Description                  |
| ---------------------------- | ----------------------------------------------------- | ---------------------------- |
| `APPLE_CERTIFICATE`          | Base64-encoded `.p12` file                            | The Developer ID certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12` file                          | Certificate export password  |
| `APPLE_SIGNING_IDENTITY`     | e.g., `Developer ID Application: Your Name (TEAM_ID)` | Signing identity name        |
| `APPLE_ID`                   | Your Apple ID email                                   | For notarization             |
| `APPLE_PASSWORD`             | App-specific password                                 | For notarization             |
| `APPLE_TEAM_ID`              | Your Developer Team ID                                | For notarization             |

### Encoding the Certificate

```bash
# macOS/Linux
base64 -i developer-id.p12 -o cert-base64.txt

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("developer-id.p12"))
```

### How It Works

1. The CI workflow creates a temporary keychain and imports the certificate
2. `tauri-action` automatically detects the signing identity and signs the bundle
3. If `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID` are set, the bundle is notarized
4. The notarization ticket is stapled to the bundle automatically

### Current Configuration

The `bundle.macOS` section in `tauri.conf.json` is set to ad-hoc signing (`"-"`):

```json
"macOS": {
  "signingIdentity": "-",
  "minimumSystemVersion": "10.15"
}
```

To enable real signing, set `signingIdentity` to your Developer ID Application identity name,
or remove the field to let the CI environment auto-detect it from the keychain.

---

## Summary: All GitHub Secrets

| Secret                               | Required          | Platform | Purpose                   |
| ------------------------------------ | ----------------- | -------- | ------------------------- |
| `TAURI_PRIVATE_KEY`                  | Yes (for updates) | All      | Signs update bundles      |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Yes (for updates) | All      | Decrypts the private key  |
| `WINDOWS_CERTIFICATE`                | No                | Windows  | Code signing certificate  |
| `WINDOWS_CERTIFICATE_PASSWORD`       | No                | Windows  | Certificate password      |
| `APPLE_CERTIFICATE`                  | No                | macOS    | Developer ID certificate  |
| `APPLE_CERTIFICATE_PASSWORD`         | No                | macOS    | Certificate password      |
| `APPLE_SIGNING_IDENTITY`             | No                | macOS    | Signing identity name     |
| `APPLE_ID`                           | No                | macOS    | Notarization Apple ID     |
| `APPLE_PASSWORD`                     | No                | macOS    | Notarization app password |
| `APPLE_TEAM_ID`                      | No                | macOS    | Notarization team ID      |
