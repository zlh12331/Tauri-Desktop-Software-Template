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
| `CODE_OF_CONDUCT.md`（仓库根目录） | 同一条私有安全公告链接，行为举报也走它                                                              |
| `.github/CODEOWNERS`               | 每条规则的 owner 账号——见下文                                                                       |
| 远端的分支保护                     | 必需检查必须与 `.github/workflows/ci.yml` 里的 job 名逐字一致                                       |
| `AGENTS.md` / `README.md`          | 应用名称与描述文案                                                                                  |

### 三处"错了也不报错"的设置

`.github/CODEOWNERS`、远端的 ruleset、操作系统代码签名，是这份清单里出错时不产生任何错误的三个条目。

**CODEOWNERS** 发货时指向 `@zlh12331`，即上游维护者。在 fork 里这意味着每个 PR 都会去请一个不是你仓库协作者的人评审。GitHub 不会警告你：无法解析的 owner 就是永不被请求，于是这个文件看起来配好了，实际什么都不约束。更早的版本发货的是占位符 `@your-org/maintainers`，以同样安静的方式失效。把账号换成你自己的，或者在没有第二评审人时直接删掉这个文件。

**分支保护** 在相反方向上是同一种形状。`protect-main` 规则集按字面 job 名列出必需检查（`Code Quality`、`E2E Tests`、`Workflow Lint (actionlint)`，以及构建矩阵那几项）。只改了 `ci.yml` 里的 job 名或删了 job 而不同步改云端，那条检查就永不 report——这不会让 PR 变红，而是让它永远 pending、没有任何可读的信号。所以任何对 `ci.yml` 中 `name:` 的改动，都必须在同一次操作里配套修改云端。

**操作系统代码签名** 在两个方向上同时静默失效。加上 `APPLE_CERTIFICATE` 与
`WINDOWS_CERTIFICATE` 并不会签任何东西，因为决定签名的是
`bundle.macOS.signingIdentity`（出厂 `"-"`，即 ad-hoc）与
`bundle.windows.certificateThumbprint`（出厂 `null`），而工作流从不设置它们。不加是
合理且预期的；以为流水线已经签好了才是问题。所以 `release-v2.yml` 的 `finalize`
作业会把真实姿态写进每次发布自己的发布说明，而
[发布流程 → 操作系统代码签名](developer/releases.zh.md#4-操作系统代码签名可选故意缺省但不许静默)
列出了你还必须改的那两个配置字段。

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
3. **裁剪成你自己的应用**：[docs/developer/trimming-guide.zh.md](developer/trimming-guide.zh.md)
   按功能逐条列出必须一并移除的文件、命令、capability 条目、偏好字段与文案命名空间。
   模板发货的是一个能用的产品，这一份就是从中脱身的路径。
4. **阅读文档**：从 [docs/developer/architecture-guide.zh.md](developer/architecture-guide.zh.md) 开始
5. **设置发布**：如使用 CI/CD，请按照上述 GitHub Releases 部分操作
6. **删除此文件**：当您熟悉后，删除 `docs/USING_THIS_TEMPLATE.zh.md`
