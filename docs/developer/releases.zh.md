# 发布

[English](releases.en.md) | **[中文](releases.zh.md)**

发布流程、版本管理和自动更新系统。

## 概述

发布系统提供：

- 自动化 GitHub Actions 工作流用于构建发布
- 版本管理脚本用于更新所有版本文件
- 基于同意的自动更新：应用提出更新，装不装由用户决定
- 跨平台构建（macOS、Windows、Linux）

## 初始设置

### 1. 生成签名密钥

```bash
npm run tauri -- signer generate -w ~/.tauri/myapp.key
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
      "endpoints": [
        "https://github.com/<your-username>/<your-repo>/releases/latest/download/latest.json"
      ],
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

- 检查在启动 5 秒后进行，不与窗口创建争抢启动路径。
- 有更新时只**征求同意，绝不自行安装**：一条常驻提示写出新版本号，并展示清单里的
  `Update.body`（发布说明），按钮是「安装更新」与「稍后」。
- 只有用户点「安装更新」才开始下载与安装；完成后第二条提示给出「立即重启」。应用不会
  自己重启——用户正在编辑时重启就是丢数据。
- 「稍后」只关掉提示。下次启动会再检查；同一会话里重复检查只会替换已有提示，不会叠出
  第二条。
- 启动侧的检查把网络失败视为正常（debug 日志，不弹提示）；用户主动发起的检查会明确报告
  失败。

### 更新流程

```
启动 →（5 秒）→ 检查端点 ─→ 无更新 ─→（静默；主动检查则回「已是最新」）
                     │
                     └→ 有更新 ─→ 提示(版本、发布说明、安装更新 | 稍后)
                                     │
                                     安装更新 → 下载并校验签名
                                               → 提示(已安装、立即重启)
                                               → relaunch
```

`downloadAndInstall()` 内部有平台差异：Windows 上安装器会在安装过程中直接结束进程，
所以「立即重启」这颗按钮实际只对 macOS / Linux 有意义。

### 一套实现，三个入口

整个流程都在 `src/lib/updater.ts`（`checkForUpdates`、`installPendingUpdate`）。调用
它的是：启动后的 hook（`src/hooks/use-auto-updater.ts`）、应用菜单（应用 → 检查更新）、
命令面板（`check-for-updates`）。要再加入口就调
`checkForUpdates({ interactive: true })`，不要绕过它直接 import
`@tauri-apps/plugin-updater`。

### 配置

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

真正被读取的只有这些键。`tauri-plugin-updater` 2.11.0 反序列化的 `Config` 只有
`endpoints`、`pubkey`、`windows` 以及三个 `dangerous*` 开关——所以 v1 时代示例里常见的
`active` 与 `dialog` 会被接受然后忽略。本模板不再写它们，因为 `"dialog": false` 从来没
有关掉过任何原生对话框，只是看起来关掉了。静默不是设计目标；界面在
`src/lib/updater.ts`。

`bundle.createUpdaterArtifacts` 必须保持 `true`，否则构建不会产出 `.sig`，也就没有可供
指向的 `latest.json`。

### 轮换签名密钥

清单与产物是用「已安装客户端里编译进去的公钥」校验的，因此换密钥是一次兼容性断裂：用旧
密钥构建的客户端会拒绝新签名，并且无法自我更新。

1. 先用**旧密钥**发布一个正常版本，内容里说明即将轮换——这是旧安装还能自动到达的最后一个
   版本。
2. 生成新密钥对（`npm run tauri -- signer generate`），替换 `tauri.conf.json` 里的
   `pubkey`，并替换 `TAURI_PRIVATE_KEY` secret。
3. 版本号要高于第 1 步发布的任何版本，然后发版；同时告知仍在旧构建上的用户：这一版需要
   手动下载安装包。

### 本地验证一次更新

端点可以指向普通 HTTP 服务，但插件默认拒绝非 HTTPS，需要显式放行，而这个放行只是临时改动：

1. 准备一个发布（或本地伪造一个），产物平台与当前一致，版本号**高于** `tauri.conf.json`
   ——版本相同意味着「无更新」，忘了 bump 就什么都不会出现。
2. 用本地目录提供更新产物，把 `plugins.updater.endpoints` 指向该 `http://` 地址，并加上
   `"dangerousInsecureTransportProtocol": true`。
3. 运行 `npm run tauri:dev`，确认提示里有版本与发布说明、「稍后」能关掉、点「安装更新」
   能看到进度。
4. 提交前把这两处配置改回去。永远不要带着 `dangerousInsecureTransportProtocol` 发布。

### 手动检查更新

用户可以通过以下方式主动检查：

- **菜单**：应用 → 检查更新
- **命令面板**：Cmd+K → 检查更新

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

| 问题             | 解决方案                                                |
| ---------------- | ------------------------------------------------------- |
| 工作流未触发     | 确保标签以 `v` 开头并已推送                             |
| 构建失败         | 检查 GitHub secrets，本地运行 `npm run check:all`       |
| 未检测到更新     | 验证端点 URL 与公钥是否匹配，并确认版本号**确实**改高过 |
| 已提示更新但没装 | 这是预期行为——必须点「安装更新」，见上文「行为」        |
| 下载失败         | 检查签名、文件权限、磁盘空间                            |

## Rust API 文档

为所有 Tauri 命令、类型和模块生成 HTML 文档：

```bash
npm run rust:doc
```

输出写入 `src-tauri/target/doc/`。在浏览器中打开 `target/doc/index.html` 浏览。文档由 Rust 公共 API（命令、结构体、枚举）上的 `///` 文档注释生成。
