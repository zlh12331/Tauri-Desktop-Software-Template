# 跨平台开发

[English](cross-platform.en.md) | **[中文](cross-platform.zh.md)**

本应用支持 macOS、Windows 和 Linux。本指南涵盖平台专属的模式、工具和配置。

## 概述

| 平台    | 标题栏            | 窗口控件       | 装饰 |
| ------- | ----------------- | -------------- | ---- |
| macOS   | 自定义 + 透明效果 | 左侧（交通灯） | 隐藏 |
| Windows | 自定义            | 右侧           | 隐藏 |
| Linux   | 原生 + 工具栏     | 原生           | 可见 |

**设计决策：**

- macOS 是主要开发目标
- 无 Windows 代码签名（请自行配置证书）
- Linux 使用原生装饰以保证桌面环境兼容性
- 键盘快捷键使用 `mod+` 前缀（macOS 上为 Cmd，其他平台为 Ctrl）

## 平台检测

### 前端（React）

使用平台 Hook 进行 UI 决策：

```typescript
import { usePlatform, getPlatform } from '@/hooks/use-platform'

// 在组件中
function MyComponent() {
  const platform = usePlatform()

  if (platform === 'macos') {
    return <MacOSSpecificUI />
  }
  // ...
}

// 在回调或非 Hook 上下文中
function handleAction() {
  const platform = getPlatform()
  // ...
}
```

还提供了便捷 Hook：

```typescript
import { useIsMacOS, useIsWindows, useIsLinux } from '@/hooks/use-platform'

function MyComponent() {
  const isMacOS = useIsMacOS()
  // ...
}
```

### 后端（Rust）

使用条件编译处理平台专属代码：

```rust
// 编译时检查（性能优先）
#[cfg(target_os = "macos")]
fn macos_only() {
    // 仅在 macOS 上编译
}

#[cfg(target_os = "windows")]
fn windows_only() {
    // 仅在 Windows 上编译
}

#[cfg(target_os = "linux")]
fn linux_only() {
    // 仅在 Linux 上编译
}

// 运行时检查（用于动态行为）
use crate::utils::platform;

if platform::is_macos() {
    // macOS 运行时行为
}
```

## 平台专属字符串

使用 `getPlatformStrings()` 获取适合平台的 UI 标签：

```typescript
import { getPlatformStrings, formatShortcut } from '@/lib/platform-strings'
import { usePlatform } from '@/hooks/use-platform'

function FileMenu() {
  const platform = usePlatform()
  const strings = getPlatformStrings(platform)

  return (
    <MenuItem>
      {strings.revealInFileManager} {/* "Reveal in Finder" 或 "Show in Explorer" */}
    </MenuItem>
  )
}

// 格式化键盘快捷键用于显示
formatShortcut('macos', 'K') // "⌘K"
formatShortcut('windows', 'K') // "Ctrl+K"
formatShortcut('macos', 'S', ['shift', 'mod']) // "⇧⌘S"
```

可用字符串：

| 属性                  | macOS              | Windows            | Linux           |
| --------------------- | ------------------ | ------------------ | --------------- |
| `revealInFileManager` | "Reveal in Finder" | "Show in Explorer" | "Show in Files" |
| `fileManagerName`     | "Finder"           | "Explorer"         | "Files"         |
| `modifierKey`         | "Cmd"              | "Ctrl"             | "Ctrl"          |
| `modifierKeySymbol`   | "⌘"                | "Ctrl"             | "Ctrl"          |
| `optionKey`           | "Option"           | "Alt"              | "Alt"           |
| `preferencesLabel`    | "Preferences"      | "Settings"         | "Preferences"   |
| `quitLabel`           | "Quit"             | "Exit"             | "Quit"          |
| `trashName`           | "Trash"            | "Recycle Bin"      | "Trash"         |

## 标题栏架构

标题栏系统使用平台检测来渲染合适的控件：

```
TitleBar.tsx（路由器）
├── macOS: MacOSWindowControls（左）+ TitleBarContent
├── Windows: TitleBarContent + WindowsWindowControls（右）
└── Linux: LinuxTitleBar（仅工具栏，无窗口控件）
```

### 测试其他平台

在开发中，使用 `forcePlatform` prop 预览其他平台布局：

```tsx
// 仅在开发构建中有效
<TitleBar forcePlatform="windows" />
<TitleBar forcePlatform="linux" />
```

### 自定义标题栏

如果构建自定义标题栏，请使用共享组件：

```tsx
import {
  TitleBarLeftActions,
  TitleBarRightActions,
  TitleBarTitle,
} from '@/components/titlebar'

function CustomTitleBar() {
  return (
    <div data-tauri-drag-region className="...">
      <TitleBarLeftActions />
      <TitleBarTitle title="My App" />
      <TitleBarRightActions />
    </div>
  )
}
```

## 路径处理

Windows 在路径中使用反斜杠（`\`），但前端期望正斜杠（`/`）。从 Rust 发送到 React 时需规范化路径：

```rust
use crate::utils::platform::normalize_path_for_serialization;

#[tauri::command]
fn get_file_path() -> String {
    let path = some_path();
    // 将 "C:\Users\foo\file.txt" 转换为 "C:/Users/foo/file.txt"
    normalize_path_for_serialization(&path)
}
```

前端随后可以一致地使用路径：

```typescript
// 在所有平台上工作
const parts = filePath.split('/')
```

## Tauri 配置

Tauri v2 使用 [JSON Merge Patch](https://datatracker.ietf.org/doc/html/rfc7396) 自动合并平台专属配置文件。

### 配置文件

```
src-tauri/
├── tauri.conf.json         # 基础配置（安全默认值）
├── tauri.macos.conf.json   # macOS 覆盖
├── tauri.windows.conf.json # Windows 覆盖
└── tauri.linux.conf.json   # Linux 覆盖
```

### 关键差异

**基础配置**（`tauri.conf.json`）：

```json
{
  "app": {
    "windows": [
      {
        "decorations": true,
        "transparent": false
      }
    ]
  }
}
```

**macOS**（`tauri.macos.conf.json`）：

```json
{
  "app": {
    "windows": [
      {
        "decorations": false,
        "transparent": true,
        "windowEffects": {
          "effects": ["hudWindow"]
        }
      }
    ]
  }
}
```

**Windows**（`tauri.windows.conf.json`）：

```json
{
  "app": {
    "windows": [
      {
        "decorations": false,
        "transparent": false
      }
    ]
  }
}
```

**Linux**（`tauri.linux.conf.json`）：

```json
{
  "app": {
    "windows": [
      {
        "decorations": true,
        "transparent": false
      }
    ]
  }
}
```

### 重要：JSON Merge Patch 行为

JSON Merge Patch **完全替换数组**，而非逐元素替换。每个平台配置必须包含**完整的** `windows` 数组及所有属性，而不仅仅是覆盖部分。

## 各平台构建

### 开发

```bash
# 在当前平台运行
npm run dev
```

### 生产构建

构建是平台专属的。只能为当前操作系统构建（交叉编译需要额外设置）：

```bash
# 为当前平台构建
npm run build
```

### CI/CD 构建

GitHub Actions 发布工作流为所有平台构建：

| 平台    | Runner           | 输出        |
| ------- | ---------------- | ----------- |
| macOS   | `macos-latest`   | `.dmg`      |
| Windows | `windows-latest` | `.msi`      |
| Linux   | `ubuntu-22.04`   | `.AppImage` |

参见 `.github/workflows/release.yml` 中的完整配置。

### Linux 依赖

Linux 构建需要额外的系统库：

```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf
```

## CSS 注意事项

### Windows 拖拽区域

Windows 需要额外的 CSS 规则才能使拖拽区域支持触摸/笔输入：

```css
*[data-tauri-drag-region] {
  app-region: drag;
}
```

这已包含在应用的全局样式中。

### GPU 加速

对于 Windows 标题栏的不透明度过渡，使用 `transform-gpu` 修复 WebKit 渲染问题：

```tsx
<div className="transform-gpu transition-opacity" />
```

## 最佳实践

1. **使用 `forcePlatform` 测试** - 在开发过程中验证所有平台的布局
2. **使用平台字符串** - 永远不要硬编码平台专属标签
3. **规范化路径** - 发送到前端前始终转换 Windows 路径
4. **优先使用条件编译** - 在 Rust 中尽可能使用 `#[cfg(...)]` 而非运行时检查
5. **保持 Linux 简单** - 原生装饰在各桌面环境中效果最好
6. **记录平台假设** - 在注释中标注任何平台专属行为

## 文件参考

| 文件                                   | 用途               |
| -------------------------------------- | ------------------ |
| `src/hooks/use-platform.ts`            | 平台检测 Hook      |
| `src/lib/platform-strings.ts`          | 平台专属 UI 字符串 |
| `src/components/titlebar/TitleBar.tsx` | 平台感知标题栏     |
| `src-tauri/src/utils/platform.rs`      | Rust 平台工具      |
| `src-tauri/tauri.*.conf.json`          | 平台专属配置       |
