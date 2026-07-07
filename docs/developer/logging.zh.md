# 日志

[English](logging.en.md) | **[中文](logging.zh.md)**

本项目有**三种日志机制**，每种都有单一且不重叠的职责。它们共同覆盖 Rust 后端、TypeScript 前端和远程聚合，不会重复输出。

| 机制                                                   | 语言               | 开发环境目标            | 生产环境目标                                | 用途                                             |
| ------------------------------------------------------ | ------------------ | ----------------------- | ------------------------------------------- | ------------------------------------------------ |
| **自定义 Logger**（`src/lib/logger.ts`）               | TypeScript（前端） | 浏览器控制台            | 通过 `Sentry.logger` 发送到 **Sentry Logs** | 人体工学的前端日志，支持级别和上下文             |
| **Sentry SDK**（`@sentry/react`，`src/lib/sentry.ts`） | TypeScript（前端） | —（同意前缓冲）         | 自托管 Sentry                               | 远程错误和日志聚合、追踪、会话回放               |
| **`tauri-plugin-log`**（Rust，`src-tauri/Cargo.toml`） | Rust（后端）       | stdout + webview 控制台 | stdout + 应用日志目录                       | Rust 端结构化日志                                |
| **Sentry `log` 集成**（`sentry` crate，`Cargo.toml`）  | Rust（后端）       | —（同意前缓冲）         | **Sentry Breadcrumbs + Logs**               | Rust `log::*` 调用变为 Sentry 面包屑和结构化日志 |

### 它们如何协同工作

- **自定义 Logger** 是前端 JS 代码的唯一入口。在开发环境中，它写入浏览器控制台以实现快速本地迭代。在生产环境中，它转发到 `Sentry.logger`，使前端日志与捕获的错误和追踪出现在同一个 Sentry 仪表板中 — 无需单独的后端往返。
- **Sentry SDK** 捕获错误、性能追踪、会话回放以及（通过 `enableLogs: true`）结构化日志。它是自定义 logger 生产输出的_消费者_，而非竞争 logger。事件仅在用户授予同意后发送（`setSentryConsent(true)`）；参见 [error-handling.zh.md](./error-handling.zh.md)。
- **`tauri-plugin-log`** 仅处理 Rust 后端。Rust 日志在开发环境中转发到 webview 控制台（使后端输出出现在 DevTools 中），在生产环境中转发到平台专属的日志文件。
- **Sentry `log` 集成**（`sentry` crate 带 `"log"` 和 `"logs"` 功能）自动将 Rust 中所有 `log::*` 调用桥接到 Sentry。每个 `log::info!` 调用都会同时成为面包屑（在错误事件中可见）和 Sentry Logs 产品中的结构化日志条目。这在 `Cargo.toml` 中配置：`sentry = { version = "0.48", features = ["log", "logs"] }`。

> **为什么前端不使用 `@tauri-apps/plugin-log`？**
> 前端不再包装 `@tauri-apps/plugin-log`。通过 Tauri 路由前端日志会重复工作（Rust 插件已经负责后端日志）并增加不必要的 IPC 跳转。相反，前端日志在生产环境中直接发送到 Sentry Logs，保持数据流线性：
> `logger → Sentry.logger → 自托管 Sentry`。

## 快速开始

### Rust（后端）

```rust
log::info!("Application starting up");
log::debug!("Debug info: {}", some_value);
log::warn!("Something unexpected happened");
log::error!("Error occurred: {}", error);
```

### TypeScript（前端）

```typescript
import { logger } from '@/lib/logger'

logger.info('User action completed')
logger.debug('Debug data', { userId: 123, action: 'click' })
logger.warn('Performance warning')
logger.error('Request failed', { error: response.error })
```

- 在**开发环境**中，这些调用以 `[timestamp] [LEVEL]` 前缀打印到浏览器控制台。
- 在**生产环境**中，它们被转发到 `Sentry.logger`（自托管 Sentry 仪表板中的结构化日志）。控制台输出被抑制。

## 配置

### Rust 后端

- 使用 `tauri-plugin-log` 配合标准 Rust `log` crate
- **开发环境**：Debug 级别，日志输出到 stdout + webview 控制台
- **生产环境**：Info 级别，日志输出到 stdout + 应用日志目录
- 配置在 `src-tauri/src/lib.rs`

### TypeScript 前端（自定义 Logger）

- **开发环境**：所有日志输出到浏览器控制台（带时间戳 + 级别前缀）
- **生产环境**：日志通过 `Sentry.logger` 转发到 Sentry Logs
- Logger 工具位于 `src/lib/logger.ts`
- logger 直接导入 `@sentry/react`（而非 `@/lib/sentry`）以避免循环依赖 — `sentry.ts` 依赖 `@/lib/tauri-bindings`，而 `logger.ts` 保持无 Tauri 耦合

### Sentry SDK（远程聚合）

- 在 `src/lib/sentry.ts` → `initSentry()` 中初始化
- `enableLogs: true` 启用结构化日志摄取（`Sentry.logger.*`）
- 事件（错误、日志、追踪、回放）在用户通过 `setSentryConsent(true)` 授予同意前会被缓冲（`beforeSend` 门控在此之前丢弃所有事件）
- DSN 通过 `VITE_SENTRY_DSN` 环境变量配置
- `@sentry/vite-plugin`（在 `vite.config.ts` 中）在生产构建期间自动上传 source map 到 Sentry，实现压缩到源码的堆栈追踪
- 匿名用户 ID（localStorage 中的 `crypto.randomUUID()`）在授予同意时设置，允许 Sentry 按设备分组事件而不收集 PII

## 日志级别

| 级别    | 使用场景     | 开发（控制台） | 生产（Sentry Logs） |
| ------- | ------------ | -------------- | ------------------- |
| `trace` | 最详细的调试 | 是             | 是                  |
| `debug` | 开发调试     | 是             | 是                  |
| `info`  | 一般信息     | 是             | 是                  |
| `warn`  | 警告条件     | 是             | 是                  |
| `error` | 错误条件     | 是             | 是                  |

> 在生产环境中，所有级别都转发到 Sentry Logs。使用 Sentry 仪表板按级别过滤 — 不要依赖在生产环境中客户端抑制日志。

## 日志出现位置

### 开发环境

- **Rust**：终端（stdout）+ 浏览器 DevTools 控制台（webview 目标）
- **TypeScript**：浏览器 DevTools 控制台（通过自定义 logger）
- **Sentry**：SDK 已初始化但事件被缓冲（同意门控）；本地调试不受影响

### 生产环境

- **Rust**：终端（stdout）+ 应用日志目录中的日志文件
- **TypeScript**：Sentry Logs 仪表板（通过 `Sentry.logger`）；浏览器控制台输出被抑制
- **Sentry**：错误、日志、追踪和回放在同意后发送

日志目录位置因平台而异（例如 macOS 上为 `~/Library/Logs/`）。

## 示例

### Rust Tauri 命令

```rust
#[tauri::command]
async fn save_data(data: MyData) -> Result<(), String> {
    log::info!("Saving data for user: {}", data.user_id);

    match save_to_disk(&data).await {
        Ok(_) => {
            log::info!("Data saved successfully");
            Ok(())
        }
        Err(e) => {
            log::error!("Failed to save data: {}", e);
            Err(format!("Save failed: {}", e))
        }
    }
}
```

### TypeScript React 组件

```typescript
import { logger } from '@/lib/logger'

function MyComponent() {
  const handleClick = () => {
    logger.debug('Button clicked', { component: 'MyComponent' })

    try {
      performAction()
      logger.info('Action completed successfully')
    } catch (error) {
      logger.error('Action failed', { error })
    }
  }

  return <button onClick={handleClick}>Click me</button>
}
```

## 最佳实践

1. **使用自定义 logger，而非直接使用 `console.*`** — `console.log` 绕过级别/前缀逻辑，在生产环境中不会转发到 Sentry。
2. **使用合适的日志级别** — 不要将所有内容都记录为 `info`。
3. **包含上下文** — 添加相关数据以帮助调试；`context` 参数成为 Sentry 日志属性。
4. **记录带详情的错误** — 包含错误消息和上下文。
5. **保持消息简洁** — 但要足够描述性以发挥作用。
6. **不记录敏感数据** — 密码、令牌和 PII 绝不能被记录（它们会出现在 Sentry 仪表板中）。

参见 [error-handling.zh.md](./error-handling.zh.md) 了解何时记录日志 vs 向用户显示错误的模式。

## 生产环境注意事项

- Rust 日志通过 `tauri-plugin-log` 输出到应用日志目录（平台专属位置），该插件在文件达到大小限制时支持日志轮转。
- 前端日志转发到 Sentry Logs — 它们不会留在浏览器中。
- Sentry 事件（包括日志）仅在用户授予同意后发送；在此之前，事件被捕获但被 `beforeSend` 门控丢弃。
- 不应记录敏感数据（密码、令牌等） — 所有生产前端日志都传输到自托管 Sentry 实例。
