# 使用此模板

[English](USING_THIS_TEMPLATE.en.md) | **[中文](USING_THIS_TEMPLATE.zh.md)**

本文档专属于此模板，当您对新项目熟悉后应将其删除。

## 前置条件

开始之前，请安装以下工具：

- **Node.js**（v24+）- [nodejs.org](https://nodejs.org/)
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

| 文件                               | 需更新的字段                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| `package.json`                     | `name`、`author`、`copyright`、`license`                                                            |
| `index.html`                       | `<title>` 标签                                                                                      |
| `src-tauri/tauri.conf.json`        | `productName`、`identifier`、`app.windows[0].title`、`bundle.publisher`/`copyright`、更新端点与公钥 |
| `src-tauri/Cargo.toml`             | `package.name`、`package.description`、`package.authors`                                            |
| `.github/workflows/release-v2.yml` | 产品名在文件中字面出现三处（产物前缀、`finalize` 参数、Release 标题）                               |
| `SECURITY.md`（仓库根目录）        | 私有安全公告链接，其中写死了当前的 owner/repo                                                       |
| `AGENTS.md` / `README.md`          | 应用名称与描述文案                                                                                  |

### 没有占位符字符串——先读这一段

本模板发货的是作者本人的真实值，不是占位符。搜索 `YOUR_USERNAME`、`YOUR_REPO`、
`YOUR_PUBLIC_KEY_HERE`、`Your Name`、`Danny Smith`、`com.tauri-app.app`，除这两页（英文
版与本页）之外找不到任何结果——早期版本的这份文档恰好列出了这些字符串，照着做的人白找了
一场。请按字段路径修改：

| 字段                                                         | 发货时的值                                                                                         | 为什么重要                                                                                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `identifier`                                                 | `com.zlh12331.tauri-desktop-software-template`                                                     | 应用数据目录、单实例锁、开机自启项                                                                      |
| `plugins.updater.endpoints`                                  | `https://github.com/zlh12331/Tauri-Desktop-Software-Template/releases/latest/download/latest.json` | 你的应用去哪里找更新                                                                                    |
| `plugins.updater.pubkey`                                     | 一个 `dW50cnVzdGVk...` 开头的 minisign 公钥                                                        | 你的应用信任哪个签名                                                                                    |
| `bundle.publisher` / `copyright`、`package.json` 的 `author` | `zlh12331`                                                                                         | Windows 安装包元数据                                                                                    |
| `plugins.deep-link.desktop.schemes`                          | `["tauri-app"]`                                                                                    | 注册给操作系统的 URL scheme；`tauri-app://preferences` 是已发货的功能，改不改是产品决策，不是清理占位符 |

用 `npm run tauri -- signer generate` 重新生成更新密钥对，把私钥放进 `TAURI_PRIVATE_KEY`
secret，再把打印出的公钥粘进 `tauri.conf.json`。跳过这一步，你的 fork 就会继续轮询别人的
release、并用别人的公钥校验签名。

要找出模板身份信息的每一处残留：

```bash
grep -rn "zlh12331\|Tauri-Desktop-Software-Template" \
  --exclude-dir=node_modules --exclude-dir=target --exclude-dir=.git .
```

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
npm run tauri -- signer generate -w ~/.tauri/myapp.key
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
      "pubkey": "<粘贴 signer generate 打印出的公钥>"
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
