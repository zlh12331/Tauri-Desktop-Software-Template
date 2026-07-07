# 错误处理

[English](error-handling.en.md) | **[中文](error-handling.zh.md)**

Rust 和 TypeScript 之间一致的错误处理模式。

## 错误传播流程

```
Rust Command (Result<T, E>) → tauri-specta → TypeScript 可辨识联合 → TanStack Query/UI
```

Rust `Result<T, E>` 类型会变成 TypeScript 可辨识联合：

```typescript
type Result<T, E> = { status: 'ok'; data: T } | { status: 'error'; error: E }
```

## Rust 错误类型

### 简单命令

对于只有一种失败模式的命令，使用 `String` 错误：

```rust
#[tauri::command]
#[specta::specta]
pub async fn simple_operation() -> Result<Data, String> {
    do_work().map_err(|e| format!("Operation failed: {e}"))
}
```

### 生产级命令

本项目使用 `AppError`（在 `src-tauri/src/error.rs` 中）包含 10 个变体：

```rust
#[derive(Debug, Clone, thiserror::Error, serde::Serialize, Type)]
#[serde(tag = "kind", content = "message")]  // 创建 TypeScript 可辨识联合
pub enum AppError {
    Io(String),
    Serialization(String),
    Path(String),
    Validation(String),
    NotFound(String),
    TaskJoin(String),
    Tray(String),
    QuickPane(String),
    Notification(String),
    Window(String),
}
```

`thiserror` 会自动生成 `Display` 和 `Error`。每个变体都有一个通过 `error_code()` 获得的稳定错误码（例如 `ERR_IO`、`ERR_VALIDATION`），并在 `src/lib/error-codes.ts` 中有镜像。

TypeScript 接收到的类型：

```typescript
type AppError =
  | { kind: 'Io'; message: string }
  | { kind: 'Serialization'; message: string }
  | { kind: 'Path'; message: string }
  | { kind: 'Validation'; message: string }
  | { kind: 'NotFound'; message: string }
  | { kind: 'TaskJoin'; message: string }
  | { kind: 'Tray'; message: string }
  | { kind: 'QuickPane'; message: string }
  | { kind: 'Notification'; message: string }
  | { kind: 'Window'; message: string }
```

对于恢复特定的错误，`RecoveryError`（在 `types.rs` 中）使用 `#[serde(tag = "kind")]`，带有命名字段变体，如 `DataTooLarge { max_bytes: u32 }`。

## TypeScript 错误处理

### 模式 1：显式处理（事件处理器）

```typescript
// ✅ 好：内联处理错误并提供用户反馈
const handleSave = async () => {
  const result = await commands.saveData(data)
  if (result.status === 'error') {
    toast.error('保存失败', { description: result.error })
    return
  }
  toast.success('已保存！')
}
```

### 模式 2：unwrapResult（TanStack Query）

```typescript
// ✅ 好：让 TanStack Query 处理错误
const { data, error } = useQuery({
  queryKey: ['data'],
  queryFn: async () => unwrapResult(await commands.loadData()),
})
```

### 模式 3：优雅降级

```typescript
// ✅ 好：出错时回退到默认值
const { data } = useQuery({
  queryKey: ['preferences'],
  queryFn: async () => {
    const result = await commands.loadPreferences()
    if (result.status === 'error') {
      logger.warn('加载偏好设置失败，使用默认值')
      return defaultPreferences
    }
    return result.data
  },
})
```

## 面向用户的错误与技术错误

### Rust：记录技术细节，返回用户消息

```rust
// ✅ 好：记录技术细节，返回用户友好的消息
pub async fn load_file(path: &str) -> Result<String, String> {
    log::debug!("Loading file: {path}");

    std::fs::read_to_string(path).map_err(|e| {
        log::error!("Failed to read file {path}: {e}");  // 技术日志
        format!("Could not read file")                   // 用户消息
    })
}
```

### TypeScript：Toast 面向用户，Logger 用于调试

```typescript
// ✅ 好：将用户反馈与技术日志分离
const result = await commands.saveData(data)
if (result.status === 'error') {
  logger.error('保存失败', { error: result.error, data }) // 技术
  toast.error('保存失败') // 面向用户
}
```

## 重试配置

根据错误类型配置 TanStack Query 的重试行为：

```typescript
// ✅ 好：智能重试逻辑
const { data } = useQuery({
  queryKey: ['data'],
  queryFn: loadData,
  retry: (failureCount, error) => {
    // 不重试客户端错误 (4xx)
    if (error.message.includes('API error: 4')) return false
    // 网络或服务器错误最多重试 3 次
    return failureCount < 3
  },
})
```

`query-client.ts` 中的默认重试设置：

| 查询类型  | 重试次数 | 原因                     |
| --------- | -------- | ------------------------ |
| Queries   | 1        | 瞬时故障可能恢复         |
| Mutations | 1        | 避免在慢速保存时重复写入 |

## 全局错误 Toast

避免为每个查询单独显示错误 Toast（会导致重复）。使用全局处理：

```typescript
// ✅ 好：在 query-client.ts 中集中处理
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.errorToast !== false) {
        toast.error('出错了')
      }
    },
  }),
})

// 为特定查询 opt out
useQuery({
  queryKey: ['optional-feature'],
  queryFn: loadOptional,
  meta: { errorToast: false },
})
```

## React 错误边界

错误边界捕获渲染错误，而非异步错误：

| 错误边界捕获         | 不捕获              |
| -------------------- | ------------------- |
| 渲染期间的错误       | 事件处理器中的错误  |
| 生命周期方法中的错误 | 异步代码（Promise） |
| 构造函数中的错误     | 错误边界自身的错误  |

对于异步 Tauri 命令错误，使用显式处理或配合 TanStack Query 使用 `unwrapResult`。

## 回滚模式

对于多步操作，失败时回滚：

```typescript
// ✅ 好：失败时回滚
const handleChange = async (newValue: string) => {
  const oldValue = currentValue

  // 步骤 1：更新后端
  const result = await commands.updateValue(newValue)
  if (result.status === 'error') {
    toast.error('更新失败')
    return
  }

  // 步骤 2：持久化
  try {
    await savePreferences.mutateAsync({ ...prefs, value: newValue })
  } catch {
    // 回滚步骤 1
    await commands.updateValue(oldValue)
    toast.error('保存失败，更改已回滚')
  }
}
```

## 快速参考

| 场景         | Rust 错误类型                | TypeScript 模式 | 用户反馈     |
| ------------ | ---------------------------- | --------------- | ------------ |
| 简单命令     | `AppError`                   | if/else + toast | 出错时 Toast |
| 多种失败模式 | `AppError` / `RecoveryError` | 匹配 `.kind`    | 上下文相关   |
| 数据获取     | `AppError`                   | `unwrapResult`  | 查询错误 UI  |
| 可选功能     | `AppError`                   | 优雅降级        | 静默回退     |
| 关键操作     | `AppError`                   | 显式处理 + 回滚 | Toast + 恢复 |

另请参阅：[tauri-commands.md](./tauri-commands.zh.md) 了解 Result 类型模式，[logging.md](./logging.zh.md) 了解日志最佳实践。

## 崩溃报告 (Sentry)

本项目集成了 Sentry，用于跨 React 前端和 Rust 后端进行远程错误跟踪。有关完整的架构，请参阅 [observability.md](./observability.zh.md)。

### 同意门控

所有 Sentry 事件（错误、日志、追踪、回放）都通过 `beforeSend` 回调进行检查，该回调会检查用户的同意状态。在没有明确用户同意的情况下，事件**绝不会发送**。

```
Frontend flow:
  Sentry captures event → beforeSend checks consentGranted → send / drop

Rust flow:
  Sentry captures event → before_send checks CONSENT_STATE → send / drop
```

同意由 `src/lib/sentry.ts` 中的 `setSentryConsent()` 管理，它还会通过 `set_consent` Tauri 命令将状态同步到 Rust 端。用户会在崩溃后的首次启动时被 `CrashReportDialog` 提示。

### 匿名用户标识

当同意被授予时，会生成一个匿名 UUID 并持久化到 `localStorage`（键：`sentry_anon_user_id`）。这让 Sentry 可以按设备分组事件，而无需收集 PII。同一设备在不同会话间会重用相同的 UUID。撤销同意会清除用户标识。

### Panic 恢复

当 Rust 后端发生 panic 时，自定义的 panic hook 会将崩溃详情写入 `crash-report.json` 文件。在下次启动时，`use-crash-reporting.ts` 会检测此文件，并根据情况将其报告给 Sentry（如果已授予同意）、显示同意对话框，或静默删除它。

### Source Map

生产构建会生成隐藏的 source map（`vite.config.ts` 中的 `build.sourcemap: 'hidden'`），并通过 `@sentry/vite-plugin` 上传到 Sentry。这使得 Sentry 能够显示从压缩代码到源码的堆栈跟踪。上传需要 `SENTRY_AUTH_TOKEN` 环境变量（在生产构建中设置在 CI 密钥中）。
