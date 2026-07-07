# 使用此模板

[English](USING_THIS_TEMPLATE.en.md) | **[中文](USING_THIS_TEMPLATE.zh.md)**

本文档专属于此模板，当您对新项目熟悉后应将其删除。

## 前置条件

开始之前，请安装以下工具：

- **Node.js**（v20+）- [nodejs.org](https://nodejs.org/)
- **Rust**（最新稳定版）- [rustup.rs](https://rustup.rs/)
- **平台依赖**：
  - **macOS**：`xcode-select --install`
  - **Windows**：[Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
  - **Linux**：参见 [Tauri 前置条件](https://tauri.app/start/prerequisites/)

然后克隆此模板并安装依赖：

```bash
git clone <your-repo-url>
cd <your-project>
npm install
```

## 快速设置

更新以下列出的配置文件，然后验证一切正常：

```bash
npm run tauri:dev
```

## 手动设置

### 配置清单

| 文件                            | 需更新的字段                                                        |
| ------------------------------- | ------------------------------------------------------------------- |
| `package.json`                  | `name`、`author`、`copyright`、`description`                        |
| `index.html`                    | `<title>` 标签                                                      |
| `src-tauri/tauri.conf.json`     | `productName`、`identifier`、`windows[0].title`、打包信息、更新端点 |
| `src-tauri/Cargo.toml`          | `name`、`description`、`authors`                                    |
| `.github/workflows/release.yml` | 工作流名称、发布名称                                                |
| `AGENTS.md`                     | 概述部分中的应用名称/描述                                           |
| `README.md`                     | 将模板引用替换为您的应用                                            |
| `docs/SECURITY.md`              | 替换 `YOUR_SECURITY_EMAIL` 占位符                                   |
| `docs/CONTRIBUTING.md`          | 替换 `YOUR_USERNAME/YOUR_REPO` 占位符                               |

### 需要替换的占位符

以下占位符字符串出现在配置文件中，请逐一搜索并替换：

| 占位符                 | 位置                                       | 替换为                             |
| ---------------------- | ------------------------------------------ | ---------------------------------- |
| `Your Name`            | `tauri.conf.json`（publisher、copyright）  | 您的真实姓名或公司名称             |
| `YOUR_USERNAME`        | `tauri.conf.json`（更新端点 URL）          | 您的 GitHub 用户名                 |
| `YOUR_REPO`            | `tauri.conf.json`（更新端点 URL）          | 您的 GitHub 仓库名称               |
| `YOUR_PUBLIC_KEY_HERE` | `tauri.conf.json`（更新公钥）              | `tauri signer generate` 生成的公钥 |
| `YOUR_SECURITY_EMAIL`  | `docs/SECURITY.md`                         | 您的安全联系邮箱                   |
| `Danny Smith`          | `package.json`（author、copyright）        | 您的真实姓名                       |
| `com.tauri-app.app`    | `tauri.conf.json`（identifier）            | `com.yourusername.your-app-name`   |
| `tauri-app`            | `tauri.conf.json`（productName、窗口标题） | 您的应用显示名称                   |

### 标识符格式

使用反向域名表示法：`com.yourusername.your-app-name`

您可以通过以下命令获取 GitHub 用户名：

```bash
gh api user --jq .login
```

### 验证设置

```bash
npm run check:all
npm run tauri:dev
```

## AI 工作流示例

此模板包含专为 AI 辅助开发设计的工作流功能。以下是一个示例工作流：

### 1. 使用任务文档规划

在 `docs/tasks-todo/` 中创建任务文档，描述您想要构建的内容。让 AI 阅读相关文档并协助规划实现方案。任务文档有助于在会话之间保持上下文。

### 2. 迭代实现

构建功能，并定期运行质量检查：

```bash
npm run check:all
```

此命令一键运行 TypeScript、ESLint、Prettier、Rust 检查和测试。

### 3. 完成前检查

在结束会话之前运行质量检查，以验证您的工作遵循 `docs/developer/` 中的架构模式：

```bash
npm run check:all
```

### 4. 更新文档

让 AI 更新 `docs/developer/` 中的相关开发者文档以及 `docs/userguide/` 中的用户指南，以反映新的模式或功能。

### 5. 完成任务

移动任务文档以标记其为已完成：

```bash
npm run task:complete <task-name>
```

## 设置 GitHub Releases

要通过 GitHub Actions 启用自动构建和自动更新：

### 1. 生成签名密钥

```bash
npm install -g @tauri-apps/cli
tauri signer generate -w ~/.tauri/myapp.key
```

保存显示的公钥以供下一步使用。

### 2. 添加 GitHub Secrets

在您的仓库中：Settings → Secrets and variables → Actions

- `TAURI_PRIVATE_KEY`：`~/.tauri/myapp.key` 的内容
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：您的密钥密码（如有设置）

### 3. 更新公钥

将您的公钥添加到 `src-tauri/tauri.conf.json`：

```json
{
  "plugins": {
    "updater": {
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

完整的发布流程和自动更新系统，请参见 [docs/developer/releases.zh.md](developer/releases.zh.md)。

## 后续步骤

1. **试用应用**：`npm run tauri:dev`
2. **探索功能**：打开命令面板（Cmd+K），查看偏好设置（Cmd+,）
3. **阅读文档**：从 [docs/developer/architecture-guide.zh.md](developer/architecture-guide.zh.md) 开始
4. **设置发布**：如使用 CI/CD，请按照上述 GitHub Releases 部分操作
5. **删除此文件**：当您熟悉后，删除 `docs/USING_THIS_TEMPLATE.zh.md`
