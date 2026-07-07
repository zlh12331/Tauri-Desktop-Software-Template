# 架构指南

[English](architecture-guide.en.md) | **[中文](architecture-guide.zh.md)**

本应用的高层架构概览和心智模型。

## 设计理念

1. **清晰优于巧妙** - 可预测的模式优于魔法
2. **AI 友好的架构** - AI 助手可以遵循的清晰模式
3. **性能源于设计** - 能够预防常见性能陷阱的模式
4. **安全优先** - 文件系统操作的内置安全模式
5. **可扩展的基础** - 易于添加新功能而无需重构

## 心智模型

### "洋葱"状态架构

状态管理遵循三层层次结构：

```
┌─────────────────────────────────────┐
│           useState                  │  ← 组件 UI 状态
│  ┌─────────────────────────────────┐│
│  │          Zustand                ││  ← 全局 UI 状态
│  │  ┌─────────────────────────────┐││
│  │  │      TanStack Query         │││  ← 持久化数据
│  │  └─────────────────────────────┘││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

**决策树：**

```
这些数据是否需要跨多个组件使用？
├─ 否 → useState
└─ 是 → 这些数据是否在应用会话之间持久化？
    ├─ 否 → Zustand
    └─ 是 → TanStack Query
```

有关实现细节，请参阅 [state-management.md](./state-management.zh.md)。

### 事件驱动桥接

Rust 和 React 通过事件进行通信以实现松耦合：

```
Rust 菜单点击 → 事件发射 → React 监听器 → 命令执行 → 状态更新
键盘快捷键 → 事件处理器 → 命令执行 → 状态更新
命令面板 → 命令选择 → 命令执行 → 状态更新
```

这确保了相同的操作在所有交互方式中保持一致的行为。

### 以命令为中心的设计

所有用户操作都通过集中的[命令系统](./command-system.zh.md)流转：

- **命令**是带有 `execute()` 函数的纯对象
- **上下文**提供命令所需的所有状态和操作
- **注册**在运行时合并来自不同领域的命令

这将 UI 触发器与实现解耦，并实现一致的行为。

## 模式依赖关系

理解各模式如何协同工作：

```
Command System
├── Depends on: State Management (context)
├── Integrates with: Keyboard Shortcuts, Menus
└── Enables: Consistent behavior across UI

State Management
├── Enables: Performance (getState pattern)
├── Supports: Data Persistence, UI State
└── Foundation for: All other systems

Event-Driven Bridge
├── Enables: Rust-React communication
├── Supports: Security (validation in Rust)
└── Foundation for: Menus, Updates, Notifications
```

## 核心系统

| 系统                 | 文档                                                |
| -------------------- | --------------------------------------------------- |
| Command System       | [command-system.md](./command-system.zh.md)         |
| Keyboard Shortcuts   | [keyboard-shortcuts.md](./keyboard-shortcuts.zh.md) |
| Native Menus         | [menus.md](./menus.zh.md)                           |
| Quick Panes          | [quick-panes.md](./quick-panes.zh.md)               |
| Data Persistence     | [data-persistence.md](./data-persistence.zh.md)     |
| Internationalization | [i18n-patterns.md](./i18n-patterns.zh.md)           |
| Cross-Platform       | [cross-platform.md](./cross-platform.zh.md)         |

## 组件层次结构

```
MainWindow (Top-level orchestrator)
├── TitleBar (Window controls + toolbar)
├── LeftSidebar (Collapsible panel)
├── MainWindowContent (Primary content area)
├── RightSidebar (Collapsible panel)
└── Global Overlays
    ├── PreferencesDialog (Settings)
    ├── CommandPalette (Cmd+K)
    └── Toaster (Notifications)
```

## 文件组织

```
locales/                  # 翻译 JSON 文件 (en.json, zh.json)
src/
├── components/
│   ├── layout/          # 布局组件 (MainWindow, 侧边栏, 内容区)
│   ├── titlebar/        # 跨平台标题栏 (macOS/Windows/Linux 控件)
│   ├── command-palette/ # 命令面板 (Cmd+K)
│   ├── preferences/     # 偏好设置对话框，包含多个面板 (通用、外观、高级)
│   ├── quick-pane/      # 快速面板浮窗应用
│   ├── crash-report/    # 崩溃报告同意对话框
│   └── ui/              # shadcn/ui 基础组件 (36 个组件)
├── hooks/               # 自定义 React Hook (10 个 Hook)
├── i18n/                # 国际化配置 (i18next + react-i18next)
├── lib/
│   ├── commands/        # 命令系统实现 (注册表 + 命令组)
│   ├── schemas/         # Zod 验证 schema
│   ├── menu.ts          # 带有 i18n 的原生菜单构建器
│   ├── notifications.ts # Toast (Sonner) + 原生通知封装
│   ├── logger.ts        # 自定义日志器 (开发环境 console, 生产环境 Sentry Logs)
│   ├── sentry.ts        # Sentry SDK 初始化 + 同意门控
│   └── bindings.ts      # tauri-specta 生成 (请勿编辑)
├── queries/             # TanStack Query Hook (偏好设置)
├── store/               # Zustand Store (ui, sidebar, dialog, crash-report)
├── test/                # 测试设置和工具
├── App.tsx              # 根组件 (Hook + Provider)
├── main.tsx             # 主窗口入口
└── quick-pane-main.tsx  # 快速面板窗口入口
```

## 多窗口架构

Tauri 应用可以有多个窗口，每个窗口运行独立的 JavaScript 上下文。窗口之间无法直接共享 React 状态。

**关键模式：**

1. **独立的入口点** - 每个窗口有自己的 HTML 文件和 React 根节点
2. **基于事件的通信** - 使用 Tauri 事件在窗口间通信
3. **窗口复用** - 在启动时创建窗口一次，然后根据需要显示/隐藏
4. **主题同步** - 发射主题变更事件，使所有窗口保持同步

```typescript
// 窗口 A：发射事件
await emit('data-updated', { value: 'new data' })

// 窗口 B：监听并响应
listen('data-updated', ({ payload }) => {
  setData(payload.value)
})
```

有关完整的实现示例，请参阅 [quick-panes.md](./quick-panes.zh.md)。

## 安全架构

### Tauri 权限

Tauri v2 使用基于权限的 capabilities 系统。每个窗口只获得其所需的权限。

**位置：** `src-tauri/capabilities/default.json`

```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:*",
    "fs:default",
    "notification:default"
  ]
}
```

**关键规则：**

- 使用具体的窗口标签，而非 `["*"]`
- 仅添加实际需要的权限
- 远程内容（如果有）应具有最小权限

### 内容安全策略

CSP 可防止 XSS 攻击。配置位于 `src-tauri/tauri.conf.json`。

**规则：**

- 切勿从 CDN 加载脚本 - 所有内容本地打包
- 除非绝对必要，避免使用 `'unsafe-eval'`
- 图片：尽可能限制为特定域名

### 安全存储

| 数据类型      | 存储方式                          | 安全级别 |
| ------------- | --------------------------------- | -------- |
| API 令牌/密钥 | 操作系统密钥链（`keyring` crate） | 高       |
| 应用偏好设置  | 应用数据目录 (JSON)               | 中       |
| 用户内容      | 应用数据目录 (JSON/recovery)      | 中       |

**注意**：`keyring` 和 SQLite 默认未安装。有关 keyring 设置请参阅 [external-apis.md](./external-apis.zh.md)，有关 SQLite 集成请参阅 [data-persistence.md](./data-persistence.zh.md)。切勿将敏感令牌存储在 `tauri-plugin-store` 中（磁盘上的纯 JSON）。

### Rust 优先的安全策略

所有文件操作都在 Rust 中进行，并内置验证：

```rust
fn is_blocked_directory(path: &Path) -> bool {
    let blocked_patterns = ["/System/", "/usr/", "/etc/", "/.ssh/"];
    blocked_patterns.iter().any(|pattern| path.starts_with(pattern))
}
```

### 输入净化

```rust
pub fn sanitize_filename(filename: &str) -> String {
    filename.chars()
        .filter(|c| !['/', '\\', ':', '*', '?', '"', '<', '>', '|'].contains(c))
        .collect()
}
```

### 原子文件操作

所有磁盘写入都使用原子操作以防止数据损坏：

```rust
// 写入临时文件，然后重命名（原子操作）
std::fs::write(&temp_path, content)?;
std::fs::rename(&temp_path, &final_path)?;
```

有关详细指导，请参阅 [Tauri 安全文档](https://v2.tauri.app/security/)。

## 类型安全的 Tauri 命令

所有 Tauri 命令都使用 [tauri-specta](https://github.com/specta-rs/tauri-specta) 实现类型安全：

```typescript
// ✅ 好：类型安全，带自动补全
import { commands } from '@/lib/tauri-bindings'

const result = await commands.loadPreferences()
if (result.status === 'ok') {
  console.log(result.data.theme)
}

// ❌ 坏：基于字符串的 invoke（无类型安全）
const prefs = await invoke<AppPreferences>('load_preferences')
```

有关添加新命令，请参阅 [tauri-commands.md](./tauri-commands.zh.md)。

## 质量门控

在提交任何更改之前：

```bash
npm run check:all
```

有关包含的所有工具，请参阅 [static-analysis.md](./static-analysis.zh.md)。

## 需要避免的反模式

| 反模式              | 危害                 | 正确做法                 |
| ------------------- | -------------------- | ------------------------ |
| 状态放在错误的层    | 混淆所有权，破坏模式 | 遵循洋葱模型             |
| Rust-React 直接耦合 | 紧耦合，难以维护     | 使用命令系统和事件       |
| 在回调中订阅 Store  | 导致渲染级联         | 使用 `getState()` 模式   |
| 跳过输入验证        | 安全漏洞             | 始终在 Rust 中验证       |
| 魔法/隐式模式       | AI 和人类都难以遵循  | 优先使用显式、清晰的代码 |

## 添加新功能

1. **命令** - 添加到相应的命令组文件
2. **状态** - 选择合适的层 (useState/Zustand/TanStack Query)
3. **UI** - 遵循组件架构
4. **持久化** - 使用既定的 [data-persistence.md](./data-persistence.zh.md) 模式
5. **测试** - 按照 [testing.md](./testing.zh.md) 模式添加测试
6. **文档** - 更新相关文档
