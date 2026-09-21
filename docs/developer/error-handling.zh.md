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

## 两套结果约定

这个应用里有两种不同的结果信封，它们不能混用，而且用错判别字段是一个静默 bug 而不是
类型错误，因为两者都是"看起来正常"的对象。

| 边界          | 形态                                                              | 由谁产生                                               | 错误字段                             |
| ------------- | ----------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------ |
| Rust → TS IPC | `{ status: 'ok', data }` / `{ status: 'error', error: AppError }` | `src/lib/bindings.ts` 里的 `commands.*()`              | 对象——取 `.message`，按 `.kind` 分支 |
| 前端命令总线  | `{ success: boolean, error?: string }`                            | `src/lib/commands/registry.ts` 里的 `executeCommand()` | 已经是可直接展示的字符串             |

```typescript
// Rust IPC：先看 .status，再读 .error.message
const result = await commands.savePreferences(prefs)
if (result.status === 'error') {
  toast.error(result.error.message) // 不能直接传 result.error，那是个对象
}

// 命令总线：看 .success；.error 已经是给 UI 用的字符串
const dispatched = await executeCommand('toggle-left-sidebar', context)
if (!dispatched.success && dispatched.error) {
  context.showToast(dispatched.error, 'error')
}
```

目前的命令只操作 store 和窗口 API，所以两种信封还没有真正交汇。等某个命令开始调用
Rust 命令时，请在它自己的 `execute()` 里处理 `result.status`，或者重新抛出一个带用户
可读 message 的 `Error`。别让裸 `AppError` 冒到调用方：`executeCommand()` 只对
`error instanceof Error` 做字符串化，其他值一律变成 `Unknown error`。

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

`thiserror` 会自动生成 `Display` 和 `Error`。线上传输的稳定标识就是 serde 的 `kind` 标签本身——也就是变体名（`Io`、`Validation` 等），TypeScript 通过下面的生成联合类型对它做分支。项目里没有单独的 `ERR_*` 错误码体系，也没有 `src/lib/error-codes.ts`；再加一套只会重复联合类型已经携带的信息。

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
const handleSave = async (prefs: AppPreferences) => {
  const result = await commands.savePreferences(prefs)
  if (result.status === 'error') {
    toast.error('保存失败', { description: result.error.message })
    return
  }
  toast.success('已保存！')
}
```

### 模式 2：在 mutation 内转成 throw

这个代码库里并没有 `unwrapResult` 辅助函数。TanStack Query 接管错误的方式是让
mutation 函数自己抛出，`src/queries/preferences.ts` 就是这么做的：

```typescript
// ✅ 好：先提示用户，再抛出，让 mutation 状态携带错误
return useMutation({
  mutationFn: async (preferences: AppPreferences) => {
    const result = await commands.savePreferences(preferences)
    if (result.status === 'error') {
      logger.error('Failed to save preferences', { error: result.error })
      toast.error(t('toast.error.preferencesSaveFailed'), {
        description: result.error.message,
      })
      throw new Error(result.error.message)
    }
  },
  onSuccess: (_, preferences) =>
    queryClient.setQueryData(['preferences'], preferences),
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
const result = await commands.savePreferences(prefs)
if (result.status === 'error') {
  logger.error('Failed to save preferences', { error: result.error }) // 技术
  toast.error('无法保存你的设置', {
    description: result.error.message, // 面向用户
  })
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

## 错误 Toast：在调用处处理

`query-client.ts` 里并没有全局的 `QueryCache`/`MutationCache` 错误处理器——已对照该
文件核实，它只设置了 `retry`、`staleTime`、`gcTime` 和 `refetchOnWindowFocus`。因此
每一条错误 Toast 都属于最清楚用户当时在做什么的那段代码：

```typescript
// ✅ 项目当前的做法（src/queries/preferences.ts）
const result = await commands.savePreferences(preferences)
if (result.status === 'error') {
  toast.error(i18n.t('toast.error.preferencesSaveFailed'), {
    description: result.error.message,
  })
  throw new Error(result.error.message)
}
```

相对地，查询不应该弹 toast——`usePreferences()` 会回退到默认值，让界面照常渲染。
如果将来要加全局处理器，位置就在 `query-client.ts`，并且必须避免与上面这种调用处
toast 重复弹出。

## React 错误边界

错误边界捕获渲染错误，而非异步错误：

| 错误边界捕获         | 不捕获              |
| -------------------- | ------------------- |
| 渲染期间的错误       | 事件处理器中的错误  |
| 生命周期方法中的错误 | 异步代码（Promise） |
| 构造函数中的错误     | 错误边界自身的错误  |

对于异步 Tauri 命令错误，请在调用处显式处理，或在 TanStack Query 函数里解包后抛出 `Error`。

## 回滚模式

对于多步操作，失败时回滚：

```typescript
// ✅ 好：持久化失败时回滚缓存
const changeTheme = async (theme: string) => {
  const previousPreferences = queryClient.getQueryData<AppPreferences>(
    preferencesQueryKeys.preferences()
  )

  queryClient.setQueryData(preferencesQueryKeys.preferences(), {
    ...previousPreferences,
    theme,
  })

  try {
    // useSavePreferences() 已经解包 AppError、弹出 toast 并重新抛出。
    await savePreferences.mutateAsync({ ...previousPreferences, theme })
  } catch {
    queryClient.setQueryData(
      preferencesQueryKeys.preferences(),
      previousPreferences
    )
  }
}
```

catch 块里只做「撤销」这一件事。[`useSavePreferences()`](../../src/queries/preferences.ts)
是唯一把 `AppError` 转成 toast 的地方，这里再弹一次会让同一个失败被报告两遍。

## 快速参考

| 场景         | Rust 错误类型                | TypeScript 模式                 | 用户反馈     |
| ------------ | ---------------------------- | ------------------------------- | ------------ |
| 简单命令     | `AppError`                   | if/else + toast                 | 出错时 Toast |
| 多种失败模式 | `AppError` / `RecoveryError` | 匹配 `.kind`                    | 上下文相关   |
| 数据获取     | `AppError`                   | 解包 + `throw`                  | 查询错误 UI  |
| 可选功能     | `AppError`                   | 优雅降级                        | 静默回退     |
| 关键操作     | `AppError`                   | 显式处理 + 回滚                 | Toast + 恢复 |
| 命令总线     | 不适用（纯前端）             | `executeCommand()` → `.success` | 失败时 Toast |

另请参阅：[tauri-commands.md](./tauri-commands.zh.md) 了解 Result 类型模式。

## 崩溃报告 (Sentry)

本项目集成了 Sentry，用于跨 React 前端和 Rust 后端进行远程错误跟踪。

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

`vite.config.ts` 只为"确实能把 map 交给 Sentry"的构建生成隐藏 source map，也就是同时
设置 `VITE_SENTRY_DSN` 与 `SENTRY_AUTH_TOKEN` 的情况。原因是打包而非成本：Tauri 会把
`frontendDist` 下的每个文件嵌进二进制，留在 `dist` 里的 `.map` 就会跟着发货——实测 4 个
map 占了 7.3 MB `dist` 里的 5.7 MB。两个变量都设置时，`@sentry/vite-plugin` 先上传，再靠
`filesToDeleteAfterUpload` 把它们删掉，于是 Sentry 拿到可符号化的堆栈，而嵌入体积停在
1.5 MB 左右。

目前 `release-v2.yml` 与 `ci.yml` 都没有设置这两个变量，所以发布出去的构建里崩溃上报是
关闭的。要启用，请把 `VITE_SENTRY_DSN` 和 `SENTRY_AUTH_TOKEN` 加进构建作业的环境变量。

关于那个删除动作有个坑：插件是在 `finally` 里调用它的，因此上传失败也会把本地 map 删掉。
所以发布构建日志里出现 `[sentry-vite-plugin] Warning: ... will not upload source maps`
就意味着这次发布没有符号化能力，应当当成发布阻塞项，而不是可忽略的噪声。
