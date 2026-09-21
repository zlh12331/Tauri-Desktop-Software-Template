# 贡献指南

[English](CONTRIBUTING.en.md) | **[中文](CONTRIBUTING.zh.md)**

感谢您有意为本项目做贡献！

## 快速开始

### 前置条件

- [Node.js](https://nodejs.org/)（v24+）
- [Rust](https://rustup.rs/)（最新稳定版）
- 熟悉 React、TypeScript 和 Rust

### 环境搭建

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
npm install
npm run dev
npm run check:all
```

## 如何贡献

### 问题

- **Bug 报告**：使用 Bug 报告模板
- **功能请求**：使用功能请求模板
- **安全问题**：参见 [SECURITY.md](SECURITY.zh.md)

### 合并请求

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 按照以下规范进行修改
4. 确保检查通过：`npm run check:all`
5. 使用约定式提交（Conventional Commits）
6. 推送并创建合并请求

## 代码规范

### TypeScript/React

- 所有新代码均使用 TypeScript
- 遵循现有的组件模式
- 架构模式参见 `docs/developer/`

### Rust

- 使用 `cargo fmt` 和 `cargo clippy`
- Tauri 命令使用 `Result<T, AppError>` 返回类型（参见 `src-tauri/src/error.rs`）
- 参见 `docs/developer/error-handling.zh.md` 与 `docs/developer/architecture-guide.zh.md`

## 质量门禁

所有合并请求必须通过 `npm run check:all`，该命令依次执行：

- `npm run typecheck` —— 应用与 Node 侧配置的 `tsc --noEmit`
- `npm run lint` —— ESLint `--max-warnings 0`，含 react-hooks 与 react-compiler 规则
- `npm run cspell:check` —— 拼写检查，覆盖 `src/`、`locales/`、`docs/` 与配置文件
- `npm run ast:lint` —— 6 条 ast-grep 架构规则：`hooks-in-hooks-dir`、`no-console`、
  `no-direct-invoke`、`no-store-in-lib`、`no-ts-ignore`、`no-destructure`
- `npm run format:check` —— Prettier
- `npm run i18n:check` —— 词条抽取漂移、缺失键、`{{placeholder}}` 对齐
- `npm run rust:fmt:check`、`npm run rust:clippy`、`npm run rust:machete`
- `npm run test:run` —— Vitest 单元测试（1022 个测试）
- `npm run rust:test` —— Rust `cargo test`（417 个测试）

Playwright E2E（97 个场景）**不在** `check:all` 里，CI 有独立作业执行；本地用
`npm run e2e`。

附加工具（手动运行）：

- `npm run knip` - 检测未使用的代码
- `npm run jscpd` - 检测代码重复

## 提交信息

使用[约定式提交](https://www.conventionalcommits.org/)：

```bash
feat: add user authentication
fix(ui): resolve sidebar toggle issue
docs: update installation instructions
refactor(store): simplify state management
test: add preferences tests
```

类型：`feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`build`、`ci`、`chore`、
`revert` —— 以 `commitlint.config.js` 中强制的清单为准；标题超过 100 个字符同样会被拒绝。

## 代码审查

- 保持合并请求聚焦且规模合理
- 编写清晰的合并请求描述
- 及时回应反馈
- 按需更新文档

## 法律声明

参与贡献即表示您同意您的贡献将按照与本项目相同的许可证进行授权。
