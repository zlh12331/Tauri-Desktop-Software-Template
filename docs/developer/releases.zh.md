# 发布

[English](releases.en.md) | **[中文](releases.zh.md)**

发布流程、版本管理和自动更新系统。

## 概述

发布系统提供：

- 自动化 GitHub Actions 工作流用于构建发布
- 版本管理脚本用于更新所有版本文件
- 自动更新器实现无缝用户更新
- 跨平台构建（macOS、Windows、Linux）

## 初始设置

### 1. 生成签名密钥

```bash
npm install -g @tauri-apps/cli
tauri signer generate -w ~/.tauri/myapp.key
# 输出私钥（已保存）和公钥（已显示）
```

### 2. 配置 GitHub 仓库

添加这些 secrets（Settings → Secrets and variables → Actions）：

- `TAURI_PRIVATE_KEY`：`~/.tauri/myapp.key` 的内容
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：你设置的密码（如有）

### 3. 更新配置

**`src-tauri/tauri.conf.json`**：

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/<your-username>/<your-repo>/releases/latest/download/latest.json"
      ],
      "dialog": false,
      "pubkey": "<your-public-key-from-step-1>"
    }
  }
}
```

**`tauri.conf.json` 中的包信息**：

- 更新 `publisher`、`shortDescription`、`longDescription`
- 更新 `productName` 和 `identifier`

## 发布流程

### 简单方法

```bash
npm run release:prepare v1.0.0
```

这将：

1. 检查 git 状态是否干净
2. 运行所有质量检查（`npm run check:all`）
3. 更新 `package.json`、`Cargo.toml`、`tauri.conf.json` 中的版本
4. 询问你是否要提交并推送

然后 GitHub Actions 将：

1. 为所有平台构建应用
2. 创建草稿发布
3. 生成 `latest.json` 用于自动更新
4. 上传所有安装程序和签名

最后，在 GitHub 上手动发布草稿发布。

### CHANGELOG 生成

本项目使用 [git-cliff](https://git-cliff.org/) 从 Conventional Commits 自动生成 `CHANGELOG.md`。

```bash
npm run changelog
```

配置在项目根目录的 `cliff.toml` 中。changelog 按类型（功能、Bug 修复、文档等）分组提交，并为每个 `v*` 标签生成新的版本部分。

准备发布时：

```bash
npm run release:prepare v1.0.0
npm run changelog          # 更新 CHANGELOG.md
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for v1.0.0"
git push origin main --tags
```

### 手动方法

```bash
# 更新 package.json、Cargo.toml、tauri.conf.json 中的版本
npm run check:all
git add .
git commit -m "chore: release v1.0.0"
git tag v1.0.0
git push origin main --tags
```

## 版本策略

语义化版本（`v1.0.0`）：

- **主版本**（1.x.x）：破坏性变更
- **次版本**（x.1.x）：新功能，向后兼容
- **修订版本**（x.x.1）：Bug 修复

三个文件的版本必须匹配：

- `package.json` → `"version": "1.0.0"`
- `src-tauri/Cargo.toml` → `version = "1.0.0"`
- `src-tauri/tauri.conf.json` → `"version": "1.0.0"`

## 自动更新系统

### 行为

- 应用启动 5 秒后检查更新
- 静默在后台下载并安装更新
- 更新就绪后自动重启应用
- 网络问题时静默失败（不打扰用户）

### 更新流程

```
应用启动 →（5 秒延迟）→ 检查 GitHub → 显示对话框 → 下载 → 安装 → 重启
```

### 实现

```typescript
// src/hooks/use-auto-updater.ts
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

useEffect(() => {
  const checkForUpdates = async () => {
    try {
      const update = await check()
      if (update) {
        await update.downloadAndInstall()
        await relaunch()
      }
    } catch {
      // 静默失败 - 不要用网络问题打扰用户
    }
  }

  const timer = setTimeout(checkForUpdates, 5000)
  return () => clearTimeout(timer)
}, [])
```

### 手动检查更新

用户可以通过以下方式手动检查：

- **菜单**：应用 → 检查更新
- **命令面板**：Cmd+K → "Check for Updates"

## 发布产物

每次发布创建：

- **macOS**：`.dmg` 安装程序
- **Windows**：`.msi` 安装程序（配置后）
- **Linux**：`.deb` 和 `.AppImage`（配置后）
- **自动更新器**：`latest.json` 清单和 `.sig` 签名文件

## 安全性

所有更新都经过加密签名：

1. 私钥在构建期间签名发布
2. 配置中的公钥验证下载
3. 无效签名自动被拒绝

## 故障排除

| 问题         | 解决方案                                          |
| ------------ | ------------------------------------------------- |
| 工作流未触发 | 确保标签以 `v` 开头并已推送                       |
| 构建失败     | 检查 GitHub secrets，本地运行 `npm run check:all` |
| 未检测到更新 | 验证端点 URL 和公钥是否匹配                       |
| 下载失败     | 检查签名、文件权限、磁盘空间                      |

## Rust API 文档

为所有 Tauri 命令、类型和模块生成 HTML 文档：

```bash
npm run rust:doc
```

输出写入 `src-tauri/target/doc/`。在浏览器中打开 `target/doc/index.html` 浏览。文档由 Rust 公共 API（命令、结构体、枚举）上的 `///` 文档注释生成。
