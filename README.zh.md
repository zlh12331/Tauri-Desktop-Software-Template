<div align="center">

# Tauri-Desktop-Software-Template

**类型安全、生产级硬化的桌面应用模板，内置 AI 友好架构。**

构建跨平台桌面应用——快速交付、易于维护。端到端类型安全、强制架构规范、完善的测试策略，在问题到达用户之前拦截回归。

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-000000?style=flat-square)](LICENSE.md)
[![Tauri](https://img.shields.io/badge/Tauri-v2-000000?style=flat-square)](https://v2.tauri.app/)
[![React](https://img.shields.io/badge/React-19-000000?style=flat-square)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-000000?style=flat-square)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-edition_2024-000000?style=flat-square)](https://www.rust-lang.org/)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-000000?style=flat-square)](#跨平台支持)

[English](README.md) | **[中文](README.zh.md)**

</div>

---

## 为什么选择这个模板？

大多数 Tauri 起步模板只给你一个 "hello world"，把难啃的部分留给你自己。这个模板直接交付真实桌面应用所需、却没人愿意从零搭建的基础设施：

- **类型安全 IPC** — 17 个 Tauri 命令通过 tauri-specta 实现编译时类型检查。不用字符串 `invoke()`，不用 `any` 类型，没有运行时意外。
- **双层崩溃报告** — Rust panic 钩子将崩溃写入磁盘（即使在 OOM 下也能存活），Sentry 同意门控尊重用户隐私，敏感数据在上传前脱敏。
- **NSPanel 浮动窗口** — 原生 macOS `NSPanel` 集成，实现类 Spotlight 的快捷面板，可跨所有 Space 浮动。Windows/Linux 降级为 `always_on_top`。
- **架构强制执行** — ast-grep 规则在 CI 阶段拦截反模式：`lib/` 中禁止 Hook、纯逻辑中禁止 Store 订阅、禁止 Zustand 解构。
- **1,076 个测试** — 821 前端 + 239 Rust + 16 E2E（含 WCAG 2.1 AA 无障碍审计）。每个命令都有三层测试：纯函数、Mock 运行时、集成测试。

## 快速开始

```bash
git clone --depth 1 https://github.com/zlh12331/Tauri-Desktop-Software-Template.git my-app
cd my-app
npm install
npm run tauri:dev
```

应用将在 `http://localhost:1420`（开发模式）启动，或以桌面窗口形式运行（`tauri:dev`）。

### 前置条件

- [Node.js](https://nodejs.org/) v20+
- [Rust](https://rustup.rs/) 1.93+（edition 2024）
- 平台特定依赖 — 参考 [Tauri 前置条件](https://v2.tauri.app/start/prerequisites/)

## 核心特性

### 端到端类型安全

- **17 个 Tauri 命令** 通过 [tauri-specta](https://github.com/specta-rs/tauri-specta) 从 Rust 自动生成类型——前端调用 `commands.savePreferences(prefs)` 获得的是 `Result<AppPreferences, AppError>` 联合类型，而非 `Promise<any>`。
- **10 变体 `AppError`** 枚举，使用 `#[serde(tag = "kind", content = "message")]`——结构化错误从 Rust 流向 TypeScript，带稳定错误码（`ERR_IO`、`ERR_VALIDATION` 等）。
- **Schema-first 表单** — Zod schema 同时作为运行时验证和 TypeScript 类型的唯一来源。`react-hook-form` + `zodResolver` 将其连接到 UI。
- **编译时 i18n** — 翻译键经过类型检查。`t('prefrences.title')` 的拼写错误会直接编译报错。

### 跨平台桌面

- **macOS** — 透明窗口 + `hudWindow` 毛玻璃效果，交通灯控件（含 Alt 键最大化提示），NSPanel 浮动面板
- **Windows** — 无边框窗口 + 自定义控件，通过 `build.rs` 嵌入 Common-Controls v6 清单
- **Linux** — 原生窗口装饰 + 工具栏
- **平台感知 UI** — "在 Finder 中显示" vs "在资源管理器中显示"，快捷键显示 `⌘` vs `Ctrl`，各平台独立 Tauri 配置覆盖

### 生产级基础设施

- **自动更新** — GitHub Releases 集成，minisign 签名验证，静默下载并自动重启
- **崩溃报告** — 自托管 Sentry，三层架构：Rust panic 钩子（写入磁盘）→ 同意门控（`AtomicU8` 状态）→ 脱敏过滤器（8 类敏感键模式）
- **系统托盘** — 驻留托盘模式（关闭即隐藏，不退出），托盘图标状态管理，窗口相对托盘定位
- **全局快捷键** — 运行时注册，用户可通过偏好设置自定义（默认：`Cmd+Shift+.` 触发快捷面板）
- **深链接** — `tauri-app://` scheme，支持路由到偏好设置或命令面板

### 开发体验

- **命令面板** — `Cmd+K` 可搜索启动器，由统一命令注册表驱动（14 个命令，覆盖导航、窗口、通知、应用 4 个分组）
- **偏好设置系统** — 3 个面板（通用、外观、高级），通过 temp-file + rename 实现原子写入
- **主题系统** — 亮色/暗色/跟随系统，首次绘制前应用（内联 FOUC 防闪脚本），通过 Tauri 事件跨窗口同步
- **国际化** — 懒加载语言包（en、zh），RTL 支持，从操作系统自动检测 locale

### 质量工程

- **15+ 质量门禁** 集成在 `npm run check:all` 中：TypeScript 严格模式（含 `noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`），ESLint（零警告），ast-grep 架构规则，React Compiler，Prettier，Rust fmt/clippy，Vitest，cargo test
- **三层 Rust 测试** — 纯函数（`*_from_path`/`*_to_path`）用 `TempDir` 隔离，`MockRuntime` 模拟 `AppHandle`，集成测试覆盖端到端流程
- **E2E 含无障碍审计** — 16 个 Playwright 场景，包含 `@axe-core/playwright` WCAG 2.1 AA 审计
- **cargo-deny** — 许可证白名单（14 种允许，拒绝 GPL/AGPL），漏洞扫描，git 依赖强制 pin revision

## 技术栈

| 层级     | 技术                                                 |
| -------- | ---------------------------------------------------- |
| 前端     | React 19, TypeScript 6, Vite 8                       |
| UI       | shadcn/ui v4（37 个组件）, Tailwind CSS v4, Lucide   |
| 状态管理 | Zustand v5（4 个 Store）, TanStack Query v5          |
| 后端     | Tauri v2, Rust（edition 2024, MSRV 1.93）            |
| IPC      | tauri-specta =2.0.0-rc.25, specta-typescript =0.0.12 |
| 测试     | Vitest 4, Testing Library, Playwright, axe-core      |
| 质量工具 | ESLint, Prettier, ast-grep, knip, jscpd, cargo-deny  |

## 项目结构

```
my-app/
- src/                       前端源码（约 100 个文件）
  - components/              7 个功能分组 + 37 个 shadcn/ui 组件
    - layout/                可调三栏布局（react-resizable-panels）
    - titlebar/              跨平台标题栏（macOS/Windows/Linux）
    - command-palette/       Cmd+K 启动器（cmdk）
    - preferences/           3 面板设置对话框
    - quick-pane/            浮动输入窗口
    - crash-report/          崩溃报告同意对话框
    - ui/                    shadcn/ui 组件库
  - hooks/                   10 个自定义 React Hook
  - lib/                     纯逻辑（无 React 耦合）
    - commands/              命令注册表系统（14 个命令）
    - schemas/               Zod 验证 schema
    - sentry.ts              Sentry SDK 初始化 + 同意门控
    - redact.ts              敏感数据脱敏
    - bindings.ts            自动生成的 IPC 类型（tauri-specta）
  - store/                   4 个 Zustand Store（ui, dialog, sidebar, crash-report）
  - queries/                 TanStack Query Hook
  - i18n/                    i18next 配置，编译时类型安全
- src-tauri/                 Rust 后端（13 个源文件）
  - src/commands/            6 个模块，17 个 Tauri 命令
  - src/utils/               路径、平台、脱敏工具
  - src/error.rs             AppError（10 变体）+ RecoveryError（5 变体）
  - src/types.rs             共享类型与校验
  - src/bindings.rs          tauri-specta TypeScript 绑定生成
  - capabilities/            3 个能力配置文件（default, desktop, quick-pane）
  - tests/                   3 个集成测试文件
- e2e/                       16 个 Playwright E2E 测试文件
- docs/                      双语文档（en + zh，64 个文件）
- locales/                   i18n 翻译文件（en, zh）
```

## Tauri 插件（20 个预配置）

| 插件              | 用途                                |
| ----------------- | ----------------------------------- |
| single-instance   | 防止多实例运行                      |
| window-state      | 记忆窗口位置/大小                   |
| positioner        | 托盘相对定位                        |
| autostart         | 开机自启                            |
| deep-link         | 自定义 URL Scheme（`tauri-app://`） |
| updater           | 应用内自动更新（含签名验证）        |
| global-shortcut   | 全局快捷键                          |
| fs                | 文件系统访问                        |
| persisted-scope   | 持久化文件访问范围                  |
| dialog            | 原生打开/保存对话框                 |
| store             | 键值持久化（原子写入）              |
| opener            | 用默认应用打开 URL/文件             |
| clipboard-manager | 剪贴板读写                          |
| notification      | 系统通知                            |
| process           | 进程控制                            |
| os                | 操作系统信息                        |
| http              | HTTP 客户端（绕过 CORS）            |
| shell             | 子进程 / 系统打开                   |
| log               | 平台特定日志输出                    |
| tauri-nspanel     | macOS 浮动面板（NSPanel）           |

## 跨平台支持

| 平台    | 标题栏            | 窗口控件   | 安装包格式  |
| ------- | ----------------- | ---------- | ----------- |
| macOS   | 透明 + 毛玻璃效果 | 红绿灯控件 | `.dmg`      |
| Windows | 无边框            | 右侧控件   | `.msi`      |
| Linux   | 原生 + 工具栏     | 原生       | `.AppImage` |

平台检测缓存在模块级（`usePlatform()` Hook）。各平台独立 Tauri 配置覆盖处理窗口装饰、透明度和毛玻璃效果。平台特定 UI 字符串集中管理在 `lib/platform-strings.ts`。

## 架构模式

### 三层状态管理

```
useState（组件）  ->  Zustand（全局 UI，4 个 Store）  ->  TanStack Query（持久化数据）
```

组件用 `useState` 管理局部状态。跨组件 UI 状态放在 Zustand Store（使用选择器语法防止渲染级联）。服务端/持久化数据走 TanStack Query（5 分钟 stale time，10 分钟 GC）。

### 命令中心化设计

所有用户操作——键盘快捷键、菜单项、命令面板、标题栏按钮——全部通过 `executeCommand()` 统一入口路由。Map-based 注册表让 UI 触发器与实现完全解耦：

```typescript
// 键盘快捷键、菜单项、命令面板都调用这个：
executeCommand('toggle-left-sidebar', context)
```

### 事件驱动桥接

Rust 与 React 通过 Tauri 事件松耦合通信。主题变更 emit `theme-changed` 同步快捷面板窗口。快捷面板提交 emit `quick-pane-submit` 更新主窗口。无直接窗口间调用。

### 架构强制执行（ast-grep）

三条 AST 规则在 CI 中强制执行：

- `hooks-in-hooks-dir.yml` — `lib/` 中禁止定义 React Hook（目录边界）
- `no-store-in-lib.yml` — `lib/` 中禁止 Store 订阅（只能用 `getState()` 保持纯逻辑）
- `no-destructure.yml` — 禁止 Zustand 解构（防止渲染级联）

## 开发

### 常用命令

| 命令                      | 说明                                  |
| ------------------------- | ------------------------------------- |
| `npm run dev`             | 启动 Vite 开发服务器                  |
| `npm run tauri:dev`       | 启动 Tauri 开发（前端 + Rust）        |
| `npm run build`           | 构建生产前端                          |
| `npm run tauri:build`     | 构建当前平台桌面应用                  |
| `npm run check:all`       | 运行全部 15+ 质量门禁                 |
| `npm run fix:all`         | 自动修复所有可修复的问题              |
| `npm run test:run`        | 运行 Vitest 单元测试（821 个）        |
| `npm run rust:test`       | 运行 Rust 测试（239 个）              |
| `npm run e2e`             | 运行 Playwright E2E 测试（16 个场景） |
| `npm run rust:bindings`   | 重新生成 tauri-specta TypeScript 类型 |
| `npm run release:prepare` | 准备发布（版本号更新 + 检查）         |

### 添加 Tauri 命令

1. 在 `src-tauri/src/commands/` 中用 `#[tauri::command]` 和 `#[specta::specta]` 定义命令
2. 在 `src-tauri/src/bindings.rs` 中通过 `collect_commands!` 注册
3. 运行 `npm run rust:bindings` 重新生成 TypeScript 绑定
4. 在前端代码中通过 `@/lib/tauri-bindings` 使用类型安全命令
5. 在三个层面添加测试（纯函数、MockRuntime、集成测试）

详见 [docs/developer/tauri-commands.zh.md](docs/developer/tauri-commands.zh.md)。

## 文档

所有文档均提供英文和中文版本：

- **[使用模板](docs/USING_THIS_TEMPLATE.zh.md)** — 设置和工作流指南
- **[开发者文档](docs/developer/README.zh.md)** — 26 篇文档，涵盖架构、模式和详细指南
- **[用户指南](docs/userguide/userguide.zh.md)** — 终端用户文档
- **[贡献指南](docs/CONTRIBUTING.zh.md)** — 参与贡献的流程
- **[安全策略](docs/SECURITY.zh.md)** — 安全措施和漏洞报告

## 贡献

欢迎提交 Pull Request。请先阅读 [贡献指南](docs/CONTRIBUTING.zh.md)，并在开始前检查现有 issue。

提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
feat(tray): add system tray icon with context menu
fix(updater): handle network timeout gracefully
docs(readme): update installation instructions
```

## AI 辅助开发

本模板专为 AI 编码代理优化：

- **AGENTS.md** — 面向 AI 代理的项目规则和架构模式
- **docs/developer/** — 26 篇文档解释模式的"为什么"，而非仅仅是"怎么做"
- **可预测的结构** — ast-grep 强制的清晰目录边界
- **质量门禁** — `npm run check:all` 在问题进入生产前捕获它们

## 许可证

[Apache-2.0](LICENSE.md)

---

基于 [Tauri](https://tauri.app) | [React](https://react.dev) | [shadcn/ui](https://ui.shadcn.com) | [Rust](https://www.rust-lang.org/) 构建
