# 代码签名指南

[English](code-signing.en.md) | **[中文](code-signing.zh.md)**

本指南涵盖为所有平台和 Tauri 自动更新器配置代码签名。

## Tauri 更新器签名（自动更新所需）

更新器签名密钥对已生成并配置。公钥嵌入在 `tauri.conf.json` 的 `plugins.updater.pubkey` 中。

### 需要配置的 GitHub Secrets

| Secret 名称                          | 值                              | 描述                 |
| ------------------------------------ | ------------------------------- | -------------------- |
| `TAURI_PRIVATE_KEY`                  | `.tauri-updater-key` 文件的内容 | 用于签名更新包的私钥 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 你选择的密码                    | 解密私钥的密码       |

> **警告**：如果丢失私钥或其密码，现有安装将无法自动更新。请安全存储私钥（例如在密码管理器或 GitHub Secrets 中）。

### 重新生成密钥（如需要）

```bash
npx tauri signer generate -p "your-password" -w ./tauri-updater-key --ci --force
```

用 `.tauri-updater-key.pub` 的内容更新 `tauri.conf.json` 中的 `pubkey` 字段，然后用新的私钥更新 GitHub Secrets。

### 更新器端点

更新 `tauri.conf.json` 中的 `endpoints` 字段，指向你的仓库：

```json
"endpoints": [
  "https://github.com/YOUR_USERNAME/YOUR_REPO/releases/latest/download/latest.json"
]
```

---

## Windows 代码签名（可选）

Windows 代码签名使用 Authenticode 证书签名 `.msi` 和 `.exe` 安装程序，防止最终用户看到 SmartScreen 警告。

### 前提条件

- 来自受信任 CA 的代码签名证书（OV 或 EV）（例如 DigiCert、Sectigo、GlobalSign）
- 导出为 `.pfx` 文件的证书

### 需要配置的 GitHub Secrets

| Secret 名称                    | 值                        | 描述         |
| ------------------------------ | ------------------------- | ------------ |
| `WINDOWS_CERTIFICATE`          | Base64 编码的 `.pfx` 文件 | 代码签名证书 |
| `WINDOWS_CERTIFICATE_PASSWORD` | `.pfx` 文件的密码         | 证书导出密码 |

### 编码证书

```bash
# macOS/Linux
base64 -i code-signing.pfx -o cert-base64.txt

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("code-signing.pfx"))
```

将整个 base64 字符串复制到 `WINDOWS_CERTIFICATE` GitHub Secret 中。

### 工作原理

1. CI 工作流将证书导入到 runner 的证书存储中
2. 提取证书指纹并设置为 `WINDOWS_CERTIFICATE_THUMBPRINT`
3. 用指纹值更新 `tauri.conf.json` → `bundle.windows.certificateThumbprint`（或在 CI 中使用环境变量方式）
4. Tauri 的构建过程使用 `signtool` 自动签名安装程序

### 当前配置

`tauri.conf.json` 中的 `bundle.windows` 部分已预配置框架值：

```json
"windows": {
  "certificateThumbprint": null,
  "digestAlgorithm": "sha256",
  "timestampUrl": "http://timestamp.sectigo.com"
}
```

要启用签名，将 `certificateThumbprint` 设置为你的证书指纹，或在 CI 中动态配置。

---

## macOS 代码签名（可选）

macOS 代码签名使用 Apple Developer 证书签名 `.app` 和 `.dmg` 包，防止 Gatekeeper 警告。

### 前提条件

- Apple Developer 账户（已加入 Apple Developer Program）
- "Developer ID Application" 证书（用于 Mac App Store 之外的分发）
- 用于公证的 App 专用密码（在 appleid.apple.com 创建）

### 需要配置的 GitHub Secrets

| Secret 名称                  | 值                                                   | 描述              |
| ---------------------------- | ---------------------------------------------------- | ----------------- |
| `APPLE_CERTIFICATE`          | Base64 编码的 `.p12` 文件                            | Developer ID 证书 |
| `APPLE_CERTIFICATE_PASSWORD` | `.p12` 文件的密码                                    | 证书导出密码      |
| `APPLE_SIGNING_IDENTITY`     | 例如 `Developer ID Application: Your Name (TEAM_ID)` | 签名身份名称      |
| `APPLE_ID`                   | 你的 Apple ID 邮箱                                   | 用于公证          |
| `APPLE_PASSWORD`             | App 专用密码                                         | 用于公证          |
| `APPLE_TEAM_ID`              | 你的 Developer Team ID                               | 用于公证          |

### 编码证书

```bash
# macOS/Linux
base64 -i developer-id.p12 -o cert-base64.txt

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("developer-id.p12"))
```

### 工作原理

1. CI 工作流创建临时钥匙串并导入证书
2. `tauri-action` 自动检测签名身份并签名包
3. 如果设置了 `APPLE_ID`、`APPLE_PASSWORD` 和 `APPLE_TEAM_ID`，则对包进行公证
4. 公证票据自动装订到包上

### 当前配置

`tauri.conf.json` 中的 `bundle.macOS` 部分设置为临时签名（`"-"`）：

```json
"macOS": {
  "signingIdentity": "-",
  "minimumSystemVersion": "10.15"
}
```

要启用正式签名，将 `signingIdentity` 设置为你的 Developer ID Application 身份名称，或移除该字段让 CI 环境从钥匙串自动检测。

---

## 汇总：所有 GitHub Secrets

| Secret                               | 必需           | 平台    | 用途              |
| ------------------------------------ | -------------- | ------- | ----------------- |
| `TAURI_PRIVATE_KEY`                  | 是（用于更新） | 全平台  | 签名更新包        |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 是（用于更新） | 全平台  | 解密私钥          |
| `WINDOWS_CERTIFICATE`                | 否             | Windows | 代码签名证书      |
| `WINDOWS_CERTIFICATE_PASSWORD`       | 否             | Windows | 证书密码          |
| `APPLE_CERTIFICATE`                  | 否             | macOS   | Developer ID 证书 |
| `APPLE_CERTIFICATE_PASSWORD`         | 否             | macOS   | 证书密码          |
| `APPLE_SIGNING_IDENTITY`             | 否             | macOS   | 签名身份名称      |
| `APPLE_ID`                           | 否             | macOS   | 公证 Apple ID     |
| `APPLE_PASSWORD`                     | 否             | macOS   | 公证 App 密码     |
| `APPLE_TEAM_ID`                      | 否             | macOS   | 公证团队 ID       |
