# 可观测性

[English](observability.en.md) | **[中文](observability.zh.md)**

本模板如何监控应用健康状况、捕获错误并聚合日志。本文档描述内置基础设施以及添加自定义可观测性的扩展点。

## 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    自托管 Sentry                         │
│  ┌──────────┐  ┌───────┐  ┌────────┐  ┌──────────────┐ │
│  │  错误     │  │ 日志  │  │ 追踪   │  │ 会话回放     │ │
│  └────▲──────┘  └───▲───┘  └───▲────┘  └──────▲───────┘ │
│       │             │          │              │          │
└───────┼─────────────┼──────────┼──────────────┼──────────┘
        │             │          │              │
   beforeSend    Sentry.logger  Web Vitals    仅错误回放
   同意门控       (前端)        (自动)        (未处理错误时)
        │             │
   ┌────┴─────────────┴──────────────────────────────┐
   │              前端 (React)                        │
   │  ErrorBoundary → sentry.ts → logger.ts          │
   └──────────────────────┬──────────────────────────┘
                          │
                     Tauri IPC
                          │
   ┌──────────────────────┴──────────────────────────┐
   │              Rust 后端                           │
   │  panic hook → crash_report.rs → sentry crate     │
   │  log::* → sentry 面包屑 + 结构化日志             │
   │  configure_scope (app.name, os, version)       │
   └──────────────────────────────────────────────────┘
```

## 内置功能

### 错误报告

| 组件              | 文件                                                | 用途                                 |
| ----------------- | --------------------------------------------------- | ------------------------------------ |
| Sentry React SDK  | `src/lib/sentry.ts`                                 | 前端错误捕获、同意门控、匿名用户 ID  |
| ErrorBoundary     | `src/components/ErrorBoundary.tsx`                  | React 渲染错误回退 + 崩溃状态保存    |
| Sentry Rust crate | `src-tauri/Cargo.toml`                              | Panic 捕获、日志桥接、会话健康       |
| Panic Hook        | `src-tauri/src/commands/crash_report.rs`            | Panic 时写入崩溃文件用于下次启动恢复 |
| 崩溃报告对话框    | `src/components/crash-report/CrashReportDialog.tsx` | 崩溃报告发送的用户同意 UI            |

### 日志

| 组件              | 文件                                         | 开发             | 生产                 |
| ----------------- | -------------------------------------------- | ---------------- | -------------------- |
| 自定义 Logger     | `src/lib/logger.ts`                          | 浏览器控制台     | Sentry Logs          |
| tauri-plugin-log  | `src-tauri/src/lib.rs`                       | stdout + webview | stdout + 日志目录    |
| Sentry `log` 集成 | `Cargo.toml`（`features = ["log", "logs"]`） | —                | Sentry 面包屑 + 日志 |

### 性能

| 组件                          | 来源                                 | 捕获内容                 |
| ----------------------------- | ------------------------------------ | ------------------------ |
| Web Vitals（LCP/FCP/CLS/INP） | `Sentry.browserTracingIntegration()` | 自动页面加载指标         |
| Rust 追踪                     | `traces_sample_rate: 0.0`（禁用）    | 桌面应用无需追踪 HTTP 链 |

### 会话健康

| 组件                                  | 提供内容                               |
| ------------------------------------- | -------------------------------------- |
| `auto_session_tracking: true`（Rust） | Sentry Release Health 中的无崩溃会话率 |
| 匿名用户 ID（前端）                   | 按设备分组事件而不收集 PII             |

### 上下文标签

Rust 事件自动包含：

| 标签          | 来源                                 |
| ------------- | ------------------------------------ |
| `app.name`    | `tauri.conf.json` → `package_info()` |
| `app.version` | `tauri.conf.json` → `package_info()` |
| `os.family`   | `std::env::consts::OS`               |
| `os.arch`     | `std::env::consts::ARCH`             |

### Source Map

生产构建使用 `@sentry/vite-plugin`（在 `vite.config.ts` 中）上传隐藏的 source map 到 Sentry。这会将压缩的堆栈追踪映射回原始源文件。构建环境中需要 `SENTRY_AUTH_TOKEN`。

## 配置

所有 Sentry 配置通过单个 `.env` 文件：

```env
# 启用 Sentry 所需（留空则禁用）
VITE_SENTRY_DSN=http://key@your-sentry-host/1
```

- `build.rs` 读取 `.env` 并将 `SENTRY_DSN` 注入为 Rust 编译时环境变量
- `vite.config.ts` 读取 `VITE_SENTRY_DSN` 用于前端 SDK
- 移除或清空 DSN 会完全禁用两端的 Sentry

## 同意流程

```
应用启动 → use-crash-reporting.ts
  ├─ 无崩溃文件，无已保存同意 → 不做任何操作（consent = null）
  ├─ 发现崩溃文件，已保存同意 → 使用已保存的偏好设置
  └─ 发现崩溃文件，无同意 → 显示 CrashReportDialog
       ├─ 用户同意 → setSentryConsent(true) → 删除崩溃文件
       │   → 发送崩溃事件 → 设置匿名用户 ID → 启用所有 Sentry
       └─ 用户拒绝 → setSentryConsent(false) → 删除崩溃文件
           → 所有 Sentry 事件被 beforeSend 门控丢弃
```

同意通过 `set_consent` Tauri 命令同步到 Rust 端，因此 Rust 产生的事件（panic）遵循相同的门控。

## 扩展点

### 添加自定义分析

`logger.ts` 模块是推荐的扩展点。添加一个 `metric()` 方法路由到你的分析提供商：

```typescript
// src/lib/logger.ts — 添加到 Logger 类
metric(name: string, data?: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    console.log(`[metric] ${name}`, data)
    return
  }
  // 路由到你的分析提供商（例如 PostHog、Mixpanel）
  // analytics.capture(name, data)
}
```

### 添加功能开关

本模板不包含功能开关系统。对于简单用例，使用环境变量：

```typescript
const FEATURE_NEW_UI = import.meta.env.VITE_FEATURE_NEW_UI === 'true'
```

对于生产级开关管理，集成 [LaunchDarkly](https://launchdarkly.com/) 或 [Unleash](https://www.getunleash.io/)。

### 添加健康检查

添加一个探测外部依赖的 Tauri 命令：

```rust
#[tauri::command]
pub async fn health_check() -> Result<HealthStatus, String> {
    Ok(HealthStatus {
        sentry_ok: check_sentry_reachable().await,
    })
}
```

### 添加性能 Span

使用 `Sentry.startSpan()` 进行自定义性能检测：

```typescript
import * as Sentry from '@sentry/react'

const result = Sentry.startSpan({ name: 'expensive-operation' }, () => {
  return performExpensiveWork()
})
```

### 添加 IPC 调用计时

用性能测量包装 Tauri 命令调用：

```typescript
const start = performance.now()
const result = await commands.someCommand()
const duration = performance.now() - start
if (duration > 100) {
  logger.warn(`Slow command: someCommand took ${duration.toFixed(1)}ms`)
}
```

## 禁用 Sentry

在没有 Sentry 的情况下运行应用：

1. 从 `.env` 中移除 `VITE_SENTRY_DSN`（或设置为空字符串）
2. `build.rs` 会发出 cargo 警告，Rust SDK 将变为 no-op
3. 前端 SDK 初始化但通过 `beforeSend` 丢弃所有事件

无需其他代码更改 — 同意门控、logger 路由和错误边界在没有 Sentry 的情况下都能正常工作。

## 开发模式调试面板

在开发环境中，右下角会出现一个浮动调试面板（`App.tsx` 中的 `SentryDebugPanel`）。它可以触发：

- **JS 错误** — `Sentry.captureMessage()`
- **未处理的 Promise 拒绝** — `Promise.reject()`

此面板在生产构建中自动隐藏。

## 生成的文档

| 工具          | 命令                | 输出                            |
| ------------- | ------------------- | ------------------------------- |
| Rust API 文档 | `npm run rust:doc`  | `src-tauri/target/doc/`（HTML） |
| CHANGELOG     | `npm run changelog` | `CHANGELOG.md`（来自 git log）  |

参见 [releases.zh.md](./releases.zh.md) 了解发布流程，包括 CHANGELOG 生成。
