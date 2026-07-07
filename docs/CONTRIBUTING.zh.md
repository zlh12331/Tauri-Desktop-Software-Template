# 贡献指南

[English](CONTRIBUTING.en.md) | **[中文](CONTRIBUTING.zh.md)**

感谢您有意为本项目做贡献！

## 快速开始

### 前置条件

- [Node.js](https://nodejs.org/)（v20+）
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
- 参见 `docs/developer/rust-architecture.zh.md`

## 质量门禁

所有合并请求必须通过 `npm run check:all`，包括：

- TypeScript 类型检查（`tsc --noEmit`）
- ESLint 严格规则检查
- Prettier 格式检查
- ast-grep 架构规则（3 条规则：hooks-in-hooks-dir、no-store-in-lib、no-destructure）
- React Compiler 验证
- Rust `cargo fmt` 和 `cargo clippy`
- Vitest 单元测试（800+ 测试）
- Rust `cargo test`（200+ 测试）

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

类型：`feat`、`fix`、`docs`、`style`、`refactor`、`test`、`chore`

## 代码审查

- 保持合并请求聚焦且规模合理
- 编写清晰的合并请求描述
- 及时回应反馈
- 按需更新文档

## 法律声明

参与贡献即表示您同意您的贡献将按照与本项目相同的许可证进行授权。
