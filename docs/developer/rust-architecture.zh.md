# Rust 架构

[English](rust-architecture.en.md) | **[中文](rust-architecture.zh.md)**

Tauri 后端的模块组织和模式。

## 模块结构

```
src-tauri/src/
├── main.rs              # 入口点（仅调用 lib::run()）
├── lib.rs               # 应用设置、插件注册、run() 入口
├── bindings.rs          # tauri-specta 命令注册 + TS 导出
├── error.rs             # AppError 枚举，包含 10 个变体 + error_code()
├── types.rs             # 共享类型：AppPreferences, CrashReportData, RecoveryError
├── commands/            # 按领域划分的命令处理器
│   ├── mod.rs           # 重新导出所有命令模块
│   ├── preferences.rs   # greet, loadPreferences, savePreferences
│   ├── notifications.rs # sendNativeNotification
│   ├── quick_pane.rs    # 快速面板显示/关闭/切换 + 快捷键管理
│   ├── recovery.rs      # 紧急数据保存/加载/清理
│   ├── tray.rs          # 托盘图标状态、窗口到托盘的定位
│   └── crash_report.rs  # 崩溃报告读取/删除、Sentry 同意
└── utils/               # 工具模块
    ├── mod.rs
    ├── paths.rs         # 应用数据目录路径解析
    ├── platform.rs      # 平台特定的辅助函数
    └── redact.rs        # 敏感数据脱敏（api_key, token 等）
```

**Rust 版本**：2024，**MSRV**：1.93（参见 `rust-toolchain.toml`）。

## 添加新命令

### 1. 创建或更新命令模块

```rust
// src-tauri/src/commands/my_feature.rs
use tauri::AppHandle;
use crate::error::AppError;

/// 简要描述此命令的功能。
#[tauri::command]
#[specta::specta]
pub async fn my_command(app: AppHandle, input: String) -> Result<String, AppError> {
    // 实现
    Ok(format!("Processed: {input}"))
}
```

为了可测试性，请提取一个通用的实现函数，并让 `#[tauri::command]` 函数委托给它。有关此模式，请参阅现有命令（例如 `preferences.rs`）。

### 2. 从 commands/mod.rs 导出

```rust
pub mod my_feature;
```

### 3. 在 bindings.rs 中注册

```rust
pub fn generate_bindings() -> Builder<tauri::Wry> {
    use crate::commands::{my_feature, /* ... */};

    Builder::<tauri::Wry>::new().commands(collect_commands![
        my_feature::my_command,
        // ... 其他命令
    ])
}
```

### 4. 重新生成 TypeScript 绑定

```bash
npm run rust:bindings
```

## 类型模式

### 共享类型 (types.rs)

命令间共享的类型放在 `types.rs` 中：

```rust
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MyData {
    pub field: String,
}
```

**注意：** specta 的 `#[derive(Type)]` 是 TypeScript 生成所必需的。

### 错误类型

本项目使用 `AppError`（在 `error.rs` 中）包含 10 个变体，以及 `RecoveryError`（在 `types.rs` 中）包含 5 个变体：

```rust
// src-tauri/src/error.rs
#[derive(Debug, Clone, thiserror::Error, serde::Serialize, Type)]
#[serde(tag = "kind", content = "message")]
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

`#[serde(tag = "kind", content = "message")]` 会创建一个 TypeScript 可辨识联合：

```typescript
if (error.kind === 'Validation') {
  console.log(error.message) // string
}
```

每个变体还有一个通过 `error_code()` 获得的稳定错误码（例如 `ERR_IO`、`ERR_VALIDATION`），并在 `src/lib/error-codes.ts` 中有镜像以供前端匹配。

### 验证函数

将验证逻辑放在 `types.rs` 中以便复用：

```rust
pub fn validate_input(input: &str) -> Result<(), String> {
    if input.is_empty() {
        return Err("Input cannot be empty".to_string());
    }
    Ok(())
}
```

## 平台特定代码

使用条件编译处理平台特定的行为：

```rust
#[cfg(target_os = "macos")]
fn macos_specific() { /* ... */ }

#[cfg(desktop)]
fn desktop_only() { /* ... */ }

#[cfg(not(target_os = "linux"))]
fn non_linux() { /* ... */ }
```

平台工具函数位于 `utils/platform.rs` 中。

## 插件注册 (lib.rs)

插件在 `lib.rs` 的应用设置阶段注册：

```rust
// 仅桌面端插件
#[cfg(desktop)]
{
    app_builder = app_builder.plugin(tauri_plugin_window_state::Builder::new().build());
}

// 所有平台
app_builder = app_builder
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
```

**顺序很重要：** 单实例插件必须最先注册。

## 约定

| 模式         | 示例                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| 命令命名     | `snake_case`（`load_preferences`，而非 `loadPreferences`）                    |
| 错误返回     | 大多数命令使用 `Result<T, AppError>`，恢复操作使用 `Result<T, RecoveryError>` |
| 日志         | 使用 `log::info!`、`log::debug!` 等                                           |
| 字符串格式化 | `format!("{variable}")` 而非 `format!("{}", variable)`                        |
| 应用句柄     | 尽可能传递 `AppHandle` 而非 `Window`                                          |

## 扩展此架构

添加新功能时：

1. **新的命令领域？** 在 `commands/` 中创建新文件
2. **新的共享类型？** 添加到 `types.rs`
3. **平台特定的工具？** 添加到 `utils/platform.rs`
4. **新的插件？** 在 `lib.rs` 设置中注册
