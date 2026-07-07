# Tauri 命令 (tauri-specta)

[English](tauri-commands.en.md) | **[中文](tauri-commands.zh.md)**

使用 [tauri-specta](https://github.com/specta-rs/tauri-specta) 的类型安全 Tauri 命令绑定。

## 概述

本应用使用 tauri-specta 从 Rust 命令生成 TypeScript 绑定，提供：

- **编译时类型检查** - TypeScript 在运行前捕获错误
- **自动生成的类型** - Rust 和 TypeScript 之间无需手动同步
- **IDE 自动补全** - 命令名、参数和返回类型的完整 IntelliSense
- **安全重构** - 可以安全地跨技术栈重命名命令

## 用法

### 调用命令

```typescript
import { commands, type AppPreferences } from '@/lib/tauri-bindings'

// 命令返回 Result 类型用于错误处理
const result = await commands.loadPreferences()

if (result.status === 'ok') {
  console.log(result.data.theme) // 类型安全的访问
} else {
  console.error(result.error) // 类型安全的错误
}
```

### Result 类型模式

可能失败的命令返回 `Result<T, E>` 类型：

```typescript
type Result<T, E> = { status: 'ok'; data: T } | { status: 'error'; error: E }
```

有关包含结构化错误类型、重试逻辑和用户反馈的全面错误处理模式，请参阅 [error-handling.md](./error-handling.zh.md)。

处理两种情况：

```typescript
const result = await commands.savePreferences({ theme: 'dark' })

if (result.status === 'error') {
  toast.error('保存失败', { description: result.error })
  return
}

// result.data 在此处可用
toast.success('已保存！')
```

### unwrapResult 辅助函数

当你希望错误传播（抛出）而非内联处理时，使用 `unwrapResult` 辅助函数：

```typescript
import { commands, unwrapResult } from '@/lib/tauri-bindings'

// 出错时抛出，成功时返回 data
const preferences = unwrapResult(await commands.loadPreferences())
```

**何时使用每种模式：**

| 模式           | 适用场景                                       |
| -------------- | ---------------------------------------------- |
| `unwrapResult` | TanStack Query 函数，错误应传播到边界          |
| 手动 `if/else` | 事件处理器，需要显式错误处理（toast、UI 状态） |

**TanStack Query 示例**（数据获取的首选模式）：

```typescript
import { useQuery } from '@tanstack/react-query'
import { commands, unwrapResult } from '@/lib/tauri-bindings'

const { data, error } = useQuery({
  queryKey: ['preferences'],
  queryFn: async () => unwrapResult(await commands.loadPreferences()),
})
// TanStack Query 自动处理抛出的错误
```

**事件处理器示例**（显式错误处理）：

```typescript
const handleSave = async () => {
  const result = await commands.savePreferences(preferences)
  if (result.status === 'error') {
    toast.error('保存失败', { description: result.error })
    return
  }
  toast.success('偏好设置已保存！')
}
```

## 添加新命令

### 1. 定义 Rust 命令

在 `src-tauri/src/commands/` 中创建新文件或添加到现有模块：

```rust
// src-tauri/src/commands/my_feature.rs
use tauri::AppHandle;
use crate::error::AppError;

/// 简要描述此命令的功能。
#[tauri::command]
#[specta::specta]
pub async fn my_new_command(app: AppHandle, arg: String) -> Result<MyType, AppError> {
    // 实现
    Ok(MyType { field: arg })
}
```

使用 `AppError`（来自 `src-tauri/src/error.rs`）作为类型化错误。对于恢复特定的错误，使用 `src-tauri/src/types.rs` 中的 `RecoveryError`。

### 2. 为结构体添加 Type derive

```rust
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MyType {
    pub field: String,
}
```

### 3. 在 bindings.rs 中注册

```rust
// src-tauri/src/bindings.rs

pub fn generate_bindings() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![
        // ... 现有命令
        crate::my_new_command,  // 在此添加
    ])
}
```

### 4. 重新生成 TypeScript 绑定

```bash
npm run rust:bindings
```

这会运行 `cargo test export_bindings -- --ignored`，生成 `src/lib/bindings.ts`。

### 5. 在前端使用

```typescript
import { commands, type MyType } from '@/lib/tauri-bindings'

const result = await commands.myNewCommand('arg')
```

### 6. 提交两个文件

始终提交：

- Rust 更改（`src-tauri/src/lib.rs`、`src-tauri/src/bindings.rs`）
- 生成的 TypeScript（`src/lib/bindings.ts`）

## 文件结构

```
src-tauri/src/
├── lib.rs              # 应用设置、插件注册、run() 入口
├── bindings.rs         # tauri-specta 命令注册 + TS 导出
├── error.rs            # AppError 枚举（10 个变体，error_code() 映射）
├── types.rs            # 共享类型：AppPreferences, CrashReportData, RecoveryError
├── commands/           # 按领域划分的命令处理器
│   ├── mod.rs
│   ├── preferences.rs  # greet, loadPreferences, savePreferences
│   ├── notifications.rs # sendNativeNotification
│   ├── recovery.rs     # saveEmergencyData, loadEmergencyData, cleanupOldRecoveryFiles
│   ├── quick_pane.rs   # showQuickPane, dismissQuickPane, toggleQuickPane, shortcut cmds
│   ├── tray.rs         # setTrayIconState, moveWindowToTray
│   └── crash_report.rs # readCrashReport, deleteCrashReport, setConsent
└── utils/              # 工具模块
    ├── mod.rs
    ├── paths.rs        # 应用数据目录路径解析
    ├── platform.rs     # 平台特定的辅助函数
    └── redact.rs       # 敏感数据脱敏

src/lib/
├── bindings.ts         # 生成的（请勿编辑）
└── tauri-bindings.ts   # 带项目约定的重新导出
```

## 已知限制

### JSON 数据使用 String 参数

接受任意 JSON 的命令（如 `saveEmergencyData`）使用 `String` 参数而非 `serde_json::Value`，以避免 specta 递归问题。传入预序列化的 JSON：

```typescript
const json = JSON.stringify({ key: 'value' })
await commands.saveEmergencyData('backup.json', json)
```

`loadEmergencyData` 返回原始 JSON 字符串，你可以在前端解析：

```typescript
const result = await commands.loadEmergencyData('backup.json')
if (result.status === 'ok') {
  const data = JSON.parse(result.data)
}
```

### 运行时生成绑定

TypeScript 绑定在应用以 debug 模式运行时生成，或通过以下方式：

```bash
npm run rust:bindings
```

更改 Rust 命令后必须运行此命令。

## 测试

在测试中 mock 命令：

```typescript
// src/test/setup.ts
vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    loadPreferences: vi
      .fn()
      .mockResolvedValue({ status: 'ok', data: { theme: 'system' } }),
    savePreferences: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    // ... 其他命令
  },
}))
```

## 可用命令

### 偏好设置

| 命令              | 参数                          | 返回值                             | 描述             |
| ----------------- | ----------------------------- | ---------------------------------- | ---------------- |
| `greet`           | `name: string`                | `Result<string, AppError>`         | 演示问候命令     |
| `loadPreferences` | 无                            | `Result<AppPreferences, AppError>` | 加载应用偏好设置 |
| `savePreferences` | `preferences: AppPreferences` | `Result<null, AppError>`           | 保存应用偏好设置 |

### 通知

| 命令                     | 参数                                  | 返回值                   | 描述     |
| ------------------------ | ------------------------------------- | ------------------------ | -------- |
| `sendNativeNotification` | `title: string, body: string \| null` | `Result<null, AppError>` | 系统通知 |

### 紧急恢复

| 命令                      | 参数                             | 返回值                          | 描述                    |
| ------------------------- | -------------------------------- | ------------------------------- | ----------------------- |
| `saveEmergencyData`       | `filename: string, data: string` | `Result<null, RecoveryError>`   | 保存 JSON 恢复数据      |
| `loadEmergencyData`       | `filename: string`               | `Result<string, RecoveryError>` | 加载 JSON 恢复数据      |
| `cleanupOldRecoveryFiles` | 无                               | `Result<number, RecoveryError>` | 删除超过 7 天的恢复文件 |

### 快速面板

| 命令                          | 参数                       | 返回值                   | 描述                          |
| ----------------------------- | -------------------------- | ------------------------ | ----------------------------- |
| `showQuickPane`               | 无                         | `Result<null, AppError>` | 显示并聚焦快速面板窗口        |
| `dismissQuickPane`            | 无                         | `Result<null, AppError>` | 隐藏快速面板窗口              |
| `toggleQuickPane`             | 无                         | `Result<null, AppError>` | 切换快速面板可见性            |
| `getDefaultQuickPaneShortcut` | 无                         | `string`                 | 获取默认快捷键字符串          |
| `updateQuickPaneShortcut`     | `shortcut: string \| null` | `Result<null, AppError>` | 更新全局快捷键（null = 重置） |

### 系统托盘

| 命令               | 参数                                          | 返回值                   | 描述                                    |
| ------------------ | --------------------------------------------- | ------------------------ | --------------------------------------- |
| `setTrayIconState` | `state: TrayIconState`                        | `Result<null, AppError>` | 设置托盘图标状态（Normal/Notification） |
| `moveWindowToTray` | `windowLabel: string, position: TrayPosition` | `Result<null, AppError>` | 将窗口相对于托盘图标移动                |

### 崩溃报告

| 命令                | 参数                       | 返回值                                      | 描述                 |
| ------------------- | -------------------------- | ------------------------------------------- | -------------------- |
| `readCrashReport`   | 无                         | `Result<CrashReportData \| null, AppError>` | 读取本地崩溃报告文件 |
| `deleteCrashReport` | 无                         | `Result<null, AppError>`                    | 删除崩溃报告（幂等） |
| `setConsent`        | `consent: boolean \| null` | `Result<null, AppError>`                    | 设置 Sentry 同意状态 |

## 依赖

```toml
# src-tauri/Cargo.toml
specta = { version = "=2.0.0-rc.25", features = ["derive", "serde_json"] }
tauri-specta = { version = "=2.0.0-rc.25", features = ["typescript"] }
specta-typescript = "=0.0.12"
```

注意：在 RC 阶段使用精确版本（`=`）以防止破坏性变更。

## 参考

- [tauri-specta GitHub](https://github.com/specta-rs/tauri-specta)
- [Specta 文档](https://specta.dev/docs/tauri-specta/v2)
