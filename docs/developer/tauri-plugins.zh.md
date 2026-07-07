# Tauri 插件

[English](tauri-plugins.en.md) | **[中文](tauri-plugins.zh.md)**

本应用中安装的所有 Tauri 插件指南，包括内置功能以及何时添加更多插件的指导。

## 已安装插件

### 核心功能

| 插件                | 用途                                | 前端包                            | 平台   |
| ------------------- | ----------------------------------- | --------------------------------- | ------ |
| **single-instance** | 防止多个应用实例运行                | 无（仅 Rust）                     | 桌面端 |
| **window-state**    | 保存/恢复窗口位置和大小             | `@tauri-apps/plugin-window-state` | 桌面端 |
| **positioner**      | 相对于托盘的窗口定位                | 无（仅 Rust）                     | 桌面端 |
| **autostart**       | 系统启动时自动运行                  | `@tauri-apps/plugin-autostart`    | 全平台 |
| **deep-link**       | 自定义 URL scheme（`tauri-app://`） | `@tauri-apps/plugin-deep-link`    | 桌面端 |
| **updater**         | 应用内自动更新                      | `@tauri-apps/plugin-updater`      | 桌面端 |
| **global-shortcut** | 系统级键盘快捷键                    | 无（仅 Rust）                     | 桌面端 |

### 文件系统与存储

| 插件                | 用途                     | 前端包                      |
| ------------------- | ------------------------ | --------------------------- |
| **fs**              | 文件系统访问             | `@tauri-apps/plugin-fs`     |
| **persisted-scope** | 持久化文件访问权限       | 无（仅 Rust）               |
| **dialog**          | 原生打开/保存/消息对话框 | `@tauri-apps/plugin-dialog` |
| **store**           | 原子化 KV 持久化存储     | `@tauri-apps/plugin-store`  |

### 系统集成

| 插件                  | 用途                     | 前端包                                 |
| --------------------- | ------------------------ | -------------------------------------- |
| **opener**            | 使用默认应用打开文件/URL | `@tauri-apps/plugin-opener`            |
| **clipboard-manager** | 剪贴板读写               | `@tauri-apps/plugin-clipboard-manager` |
| **notification**      | 系统通知                 | `@tauri-apps/plugin-notification`      |
| **process**           | 退出/重启应用            | `@tauri-apps/plugin-process`           |
| **os**                | 操作系统信息             | `@tauri-apps/plugin-os`                |
| **http**              | HTTP 客户端（绕过 CORS） | `@tauri-apps/plugin-http`              |
| **shell**             | Shell 命令和打开默认应用 | `@tauri-apps/plugin-shell`             |
| **log**               | Rust 日志写入文件/控制台 | 无（仅 Rust）                          |

### 平台专用

| 插件              | 用途                        | 平台     |
| ----------------- | --------------------------- | -------- |
| **tauri-nspanel** | 快捷面板的原生 NSPanel 行为 | 仅 macOS |

## 插件使用模式

### 单实例

防止应用的多个实例同时运行。当用户尝试打开第二个实例时，会聚焦到已有窗口。

**配置**（`src-tauri/src/lib.rs`）：

```rust
#[cfg(desktop)]
{
    app_builder = app_builder.plugin(tauri_plugin_single_instance::init(
        |app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        },
    ));
}
```

**重要**：此插件必须在插件链中第一个注册。

### 窗口状态

自动保存和恢复窗口位置、大小及状态（最大化等）。

**工作原理**：

- 应用关闭时保存窗口状态
- 应用打开时恢复状态
- 仅对 capabilities 中列出的窗口生效（仅主窗口，不包括快捷面板）

**无需前端代码** - 自动工作。

### 上下文菜单

使用 Tauri 内置 Menu API 实现原生上下文菜单（无需插件）。

**用法**（`src/lib/context-menu.ts`）：

```typescript
import { showContextMenu, showEditContextMenu } from '@/lib/context-menu'

// 自定义菜单
await showContextMenu([
  { id: 'copy', label: 'Copy', accelerator: 'CmdOrCtrl+C', action: handleCopy },
  { type: 'separator' },
  { id: 'delete', label: 'Delete', action: handleDelete },
])

// 标准编辑菜单（剪切、复制、粘贴、全选）
await showEditContextMenu()

// 文本输入菜单（包含撤销/重做）
await showTextInputContextMenu()
```

### 对话框

原生文件打开/保存对话框和消息框。

```typescript
import { open, save, message, ask, confirm } from '@tauri-apps/plugin-dialog'

// 打开文件对话框
const file = await open({
  multiple: false,
  filters: [{ name: 'Text', extensions: ['txt', 'md'] }],
})

// 保存对话框
const path = await save({
  defaultPath: 'document.txt',
})

// 消息框
await message('Operation complete!', { title: 'Success', kind: 'info' })

// 确认对话框
const confirmed = await confirm('Are you sure?', {
  title: 'Confirm',
  kind: 'warning',
})
```

### 通知

系统通知。

```typescript
import { sendNotification } from '@tauri-apps/plugin-notification'

sendNotification({
  title: 'Download Complete',
  body: 'Your file has been downloaded.',
})
```

或使用类型化命令：

```typescript
import { commands } from '@/lib/tauri-bindings'
await commands.sendNativeNotification('Title', 'Body text')
```

### 剪贴板

读写系统剪贴板。

```typescript
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager'

await writeText('Hello, clipboard!')
const text = await readText()
```

### 打开器

使用默认系统应用打开文件/URL。

```typescript
import { openUrl, openPath } from '@tauri-apps/plugin-opener'

// 在默认浏览器中打开 URL
await openUrl('https://example.com')

// 使用默认应用打开文件
await openPath('/path/to/document.pdf')
```

## 内置功能（无需插件）

### 系统托盘

通过 `tray-icon` 功能内置于 Tauri v2。参见 [Tauri 文档](https://v2.tauri.app/learn/system-tray/)。

### 应用菜单

Menu API 内置于 `@tauri-apps/api/menu`。本应用将其用于：

- 应用菜单（文件、编辑、视图等）
- 通过 `src/lib/context-menu.ts` 实现的上下文菜单

## 考虑添加的插件

以下插件未包含但通常需要：

| 插件                | 何时添加                           |
| ------------------- | ---------------------------------- |
| **sql**             | 用于结构化数据的本地 SQLite 数据库 |
| **stronghold**      | 加密密钥存储（多密钥、加密）       |
| **keyring**         | 用于 API 令牌的 OS 钥匙串访问      |
| **barcode-scanner** | 摄像头条码扫描                     |
| **biometric**       | 生物识别认证                       |

## 添加新插件

1. **通过 CLI 安装**：

   ```bash
   npm run tauri add PLUGIN_NAME
   ```

2. **在 `lib.rs` 中检查位置**：
   - `single-instance` 必须第一个
   - 仅桌面端插件应包裹在 `#[cfg(desktop)]` 中

3. **如需要，添加 capability 权限**（查看插件文档）

4. **如果插件需要封装，在 `src/lib/` 中创建前端工具函数**

## 插件注册顺序

插件在 `lib.rs` 中的注册顺序很重要（共 20 个插件）：

1. **single-instance** - 必须第一个（仅桌面端）
2. **window-state** - 在其他窗口插件之前（仅桌面端）
3. **positioner** - 在 window-state 之后（仅桌面端）
4. **autostart** - 仅桌面端
5. **deep-link** - 仅桌面端
6. **updater** - 仅桌面端
7. **http** - 全平台
8. **shell** - 仅桌面端
9. **store** - 全平台
10. **process** - 全平台
11. **notification** - 全平台
12. **log** - 全平台
13. **tauri-nspanel** - 仅 macOS
14. **fs** - 全平台
15. **persisted-scope** - 全平台
16. **dialog** - 全平台
17. **clipboard-manager** - 全平台
18. **opener** - 全平台
19. **os** - 全平台
20. **global-shortcut** - 在 setup 中动态注册（仅桌面端）

## 参考

- [Tauri v2 插件文档](https://v2.tauri.app/plugin/)
- [官方插件仓库](https://github.com/tauri-apps/plugins-workspace)
- [Window State 插件](https://v2.tauri.app/plugin/window-state/)
- [Single Instance 插件](https://v2.tauri.app/plugin/single-instance/)
