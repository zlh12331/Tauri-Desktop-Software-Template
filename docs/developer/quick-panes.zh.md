# 快速面板

[English](quick-panes.en.md) | **[中文](quick-panes.zh.md)**

快速面板是通过全局键盘快捷键出现的小型浮窗，即使主应用未获得焦点也能触发。此模式常用于快速输入、命令面板和类似的快速访问功能。

## 概述

快速面板系统展示了：

- **全局快捷键** - 使用 `Cmd+Shift+.`（macOS）或 `Ctrl+Shift+.`（Windows/Linux）从任何应用触发
- **多窗口架构** - 主窗口和面板使用独立的 React 上下文
- **跨窗口通信** - 使用 Tauri 事件实现解耦的消息传递
- **平台特定行为** - macOS 上使用原生 NSPanel 实现全屏覆盖

## 架构

### 多窗口设置

每个 Tauri 窗口运行完全独立的 JavaScript 上下文。它们无法直接共享 React 状态。

```
index.html          → src/main.tsx          → 主 React 应用
quick-pane.html     → src/quick-pane-main.tsx → 快速面板 React 应用
```

**Vite 配置**会构建两个入口点：

```typescript
// vite.config.ts
build: {
  rollupOptions: {
    input: {
      main: resolve(__dirname, 'index.html'),
      'quick-pane': resolve(__dirname, 'quick-pane.html'),
    },
  },
}
```

### 窗口创建模式

快速面板在应用启动时创建一次（隐藏状态），然后通过命令显示/隐藏。这比每次重新创建窗口更快，并且在 macOS 上是必需的，因为 NSPanel 必须在主线程上创建。

```rust
// 在 setup() 闭包中 - 在主线程上运行
init_quick_pane(app.handle())?;

// 之后，从任何命令
toggle_quick_pane(app_handle);  // 显示/隐藏现有窗口
```

### 跨窗口通信

窗口通过 Tauri 事件通信（而非共享状态）：

```typescript
// 快速面板：提交时发射事件
await emit('quick-pane-submit', { text: text.trim() })

// 主窗口：监听事件
listen('quick-pane-submit', ({ payload }) => {
  // 处理提交 - 更新 Zustand、调用 API 等
  setLastQuickPaneEntry(payload.text)
})
```

此模式是有意设计为灵活的 - 操作可以是任何内容：

- 更新 Zustand Store（如演示所示）
- 调用 TanStack Query mutation
- 调用 Tauri 命令
- 发起 API 请求

### 主题同步

由于窗口不共享 React 上下文，主题必须手动同步：

```typescript
// 主窗口：主题变更时发射
emit('theme-changed', { theme })

// 快速面板：监听并应用
listen('theme-changed', () => applyTheme())

// 也在获得焦点时重新应用（捕获隐藏期间的变更）
onFocusChanged(({ payload: focused }) => {
  if (focused) applyTheme()
})
```

## 平台行为

| 平台          | 面板类型 | 全屏覆盖 | 关闭行为               |
| ------------- | -------- | -------- | ---------------------- |
| macOS         | NSPanel  | 是       | 点击外部、Escape、失焦 |
| Windows       | 置顶窗口 | 否       | Escape、失焦           |
| Linux X11     | 置顶窗口 | 否       | Escape、失焦           |
| Linux Wayland | 不支持   | -        | -                      |

### macOS NSPanel

在 macOS 上，快速面板使用 `tauri-nspanel` 实现原生面板行为：

- 显示在全屏应用之上
- 正确的焦点处理，无需激活主应用
- 失焦时原生面板关闭

**全屏覆盖的关键配置：**

```rust
// 这些设置对于正确的全屏行为是必需的。
// 有关完整的构建器链，请参阅 src-tauri/src/commands/quick_pane.rs，
// 其中还包括 .url()、.title()、.size()、.transparent()、.has_shadow()、
// .with_window() 配置和 .build()。

PanelBuilder::<_, QuickPanePanel>::new(app, label)
    .level(PanelLevel::Status)  // 高 z-order 用于全屏
    .style_mask(StyleMask::empty().nonactivating_panel())  // 必需！
    .collection_behavior(
        CollectionBehavior::new()
            .full_screen_auxiliary()
            .can_join_all_spaces(),
    )
    // ... 需要额外的构建器调用 ...
    .build()
```

`nonactivating_panel()` 样式掩码对于全屏覆盖可见性至关重要。

### 防止 Space 切换

在 macOS 上隐藏面板时，必须先 resign 关键窗口状态，以防止 macOS 激活主窗口（这会导致 Space 切换）：

```rust
panel.resign_key_window();  // 在隐藏之前 resign
panel.hide();
```

## 自定义

### 更改快捷键

默认快捷键是 `CommandOrControl+Shift+.`。用户可以在"偏好设置 > 通用"中自定义。

编程方式：

```typescript
await commands.updateQuickPaneShortcut('CommandOrControl+Alt+Space')
// 或重置为默认值
await commands.updateQuickPaneShortcut(null)
```

### 自定义面板内容

编辑 `src/components/quick-pane/QuickPaneApp.tsx`：

```typescript
export default function QuickPaneApp() {
  const [text, setText] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (text.trim()) {
      // 发射你的自定义事件
      await emit('quick-pane-submit', {
        action: 'create-task',  // 自定义操作类型
        payload: { text: text.trim() }
      })
      setText('')
    }
    await commands.dismissQuickPane()
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* 你的自定义 UI */}
    </form>
  )
}
```

### 连接到不同操作

在主窗口中，按需处理事件：

```typescript
// Zustand（演示所示）
listen('quick-pane-submit', ({ payload }) => {
  useUIStore.getState().setLastQuickPaneEntry(payload.text)
})

// TanStack Query mutation
listen('quick-pane-submit', ({ payload }) => {
  createTaskMutation.mutate({ title: payload.text })
})

// API 调用
listen('quick-pane-submit', async ({ payload }) => {
  await fetch('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ title: payload.text }),
  })
})

// Tauri 命令
listen('quick-pane-submit', async ({ payload }) => {
  await commands.createTask(payload.text)
})
```

### 更改窗口大小

更新 `src-tauri/src/lib.rs` 中的常量：

```rust
const QUICK_PANE_WIDTH: f64 = 500.0;
const QUICK_PANE_HEIGHT: f64 = 72.0;
```

同时更新 `init_quick_pane_macos` 和 `init_quick_pane_standard` 中的窗口创建。

## 实现说明

### 线程（macOS）

NSPanel 创建必须在主线程上进行。Tauri 异步运行时使用 tokio 线程池，而非主线程。

```rust
// 坏：异步命令在 tokio 线程池上运行
#[tauri::command]
async fn create_panel(app: AppHandle) {
    PanelBuilder::new(...).build()?;  // 可能崩溃！
}

// 好：在 setup() 中创建，它在主线程上运行
.setup(|app| {
    init_quick_pane(app.handle())?;
    Ok(())
})
```

### Escape 键声音

通过调用 `preventDefault()` 防止 Escape 键的系统提示音：

```typescript
const handleKeyDown = async (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    e.preventDefault() // 防止"嘟"声
    await commands.dismissQuickPane()
  }
}
```

### 窗口定位

快速面板会自动在包含鼠标光标的显示器上居中。这在 Rust 的 `show_quick_pane` 和 `toggle_quick_pane` 命令中处理。

## 依赖

```toml
# Cargo.toml

# 全局快捷键
tauri-plugin-global-shortcut = "2"

# macOS NSPanel（条件依赖）
[target.'cfg(target_os = "macos")'.dependencies]
tauri-nspanel = { git = "https://github.com/ahkohd/tauri-nspanel", branch = "v2.1" }
```

## 限制

- **Linux Wayland**：不支持全局快捷键
- **视觉模糊**：由于 `window-vibrancy` 和 `tauri-nspanel` 之间的冲突，原生毛玻璃模糊不可用。当前实现使用 CSS `backdrop-blur` 配合半透明背景。
