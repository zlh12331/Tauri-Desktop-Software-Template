# UI 模式

[English](ui-patterns.en.md) | **[中文](ui-patterns.zh.md)**

## 概述

本应用使用针对 Tauri 桌面应用优化的现代 CSS 技术栈：

- **Tailwind CSS v4**，基于 CSS 的配置
- **shadcn/ui v4** 组件库
- **OKLCH 色彩空间**，实现感知均匀的颜色
- **桌面端专属默认值**，提供原生应用体验

## Tailwind v4 配置

Tailwind v4 使用基于 CSS 的配置，而非 `tailwind.config.js`。

### 文件结构

```
src/
├── App.css              # 主窗口样式 + Tailwind 导入
├── quick-pane.css       # 快捷面板窗口样式
└── theme-variables.css  # 共享主题变量（颜色、圆角）
```

**多窗口主题**：`theme-variables.css` 被 `App.css` 和 `quick-pane.css` 同时导入，因此所有窗口共享相同的主题令牌。添加新的颜色变量时，请将其添加到 `theme-variables.css`。

### 结构

```css
@import 'tailwindcss'; /* 核心 Tailwind */
@import 'tw-animate-css'; /* 动画工具 */

@custom-variant dark (&:is(.dark *)); /* 暗色模式变体 */

@theme inline {
  /* 将 CSS 变量映射到 Tailwind 令牌 */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  /* ... */
}

:root {
  /* 亮色模式值 */
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
}

.dark {
  /* 暗色模式覆盖 */
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
}

@layer base {
  /* 全局基础样式 */
}
```

### 关键概念

| 指令                   | 用途                                      |
| ---------------------- | ----------------------------------------- |
| `@theme inline`        | 将 CSS 变量映射到 Tailwind 的设计令牌系统 |
| `@custom-variant dark` | 基于 `.dark` 类启用 `dark:` 前缀          |
| `@layer base`          | 全局应用的基础样式                        |

### 添加自定义颜色

添加新的语义颜色：

```css
@theme inline {
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
}

:root {
  --success: oklch(0.7 0.15 145);
  --success-foreground: oklch(1 0 0);
}

.dark {
  --success: oklch(0.6 0.15 145);
  --success-foreground: oklch(1 0 0);
}
```

然后使用 Tailwind：`bg-success text-success-foreground`

## 暗色模式

### 工作原理

1. **ThemeProvider**（`src/components/ThemeProvider.tsx`）管理主题状态
2. 暗色模式激活时向 `<html>` 元素添加 `.dark` 类
3. `.dark` 中的 CSS 变量覆盖 `:root` 值
4. Tailwind 的 `dark:` 变体条件性应用样式

### 主题选项

- `light` - 强制亮色模式
- `dark` - 强制暗色模式
- `system` - 跟随操作系统偏好（默认）

### 在组件中使用

```tsx
// 在组件中访问主题
import { useTheme } from '@/hooks/use-theme'

function MyComponent() {
  const { theme, setTheme } = useTheme()

  return <button onClick={() => setTheme('dark')}>Current: {theme}</button>
}
```

### 为什么使用 `.dark` 类（而非 `light-dark()`）

本应用使用 `.dark` 类方式而非 CSS `light-dark()`，因为：

- shadcn/ui 生态系统的标准模式
- JavaScript 控制主题切换
- 支持 "system" 偏好检测
- 兼容所有 shadcn 组件

## OKLCH 颜色

所有颜色使用 OKLCH 色彩空间以实现感知均匀性。

### 格式

```css
oklch(lightness chroma hue)
oklch(0.7 0.15 250)  /* L: 0-1, C: 0-0.4, H: 0-360 */
```

### 为什么使用 OKLCH

- **感知均匀** - 值的等距变化 = 等量的感知变化
- **广色域** - 支持 P3 显示色彩
- **直观** - 亮度可预测（不同于 HSL）

### 调色板结构

| 令牌                                     | 用途             |
| ---------------------------------------- | ---------------- |
| `--background` / `--foreground`          | 页面背景和文本   |
| `--card` / `--card-foreground`           | 卡片表面         |
| `--primary` / `--primary-foreground`     | 主要操作         |
| `--secondary` / `--secondary-foreground` | 次要操作         |
| `--muted` / `--muted-foreground`         | 弱化元素         |
| `--accent` / `--accent-foreground`       | 高亮             |
| `--destructive`                          | 危险操作（红色） |
| `--border` / `--input` / `--ring`        | 边框和焦点环     |

## 桌面端专属样式

`@layer base` 部分包含使应用在桌面端有原生感的样式。

### 文本选择

```css
body {
  user-select: none; /* 默认禁用 */
}

input,
textarea,
[contenteditable='true'] {
  user-select: text !important; /* 在可编辑区域启用 */
}
```

**原因**：桌面应用通常不允许选择 UI 文本，只能选择内容。

### 光标

```css
* {
  cursor: default; /* 到处使用箭头光标 */
}

input,
textarea {
  cursor: text !important;
}

.cursor-pointer {
  cursor: pointer !important;
}
```

**原因**：原生应用使用箭头光标，而非标签上的文本光标。

### 滚动行为

```css
body {
  overscroll-behavior: none; /* 防止回弹/刷新 */
  overflow: hidden; /* 防止 body 滚动 */
}
```

**原因**：防止在桌面应用中不合适的下拉刷新和弹性滚动。

### 拖拽区域

```css
*[data-tauri-drag-region] {
  -webkit-app-region: drag;
  app-region: drag;
}
```

为需要拖动窗口的元素（如标题栏）应用 `data-tauri-drag-region`。

## 组件组织

```
src/components/
├── layout/           # 应用结构
│   ├── MainWindow.tsx
│   ├── LeftSideBar.tsx
│   ├── RightSideBar.tsx
│   └── MainWindowContent.tsx
├── titlebar/         # 窗口外观
│   ├── TitleBar.tsx
│   ├── MacOSWindowControls.tsx
│   └── WindowsWindowControls.tsx
├── ui/               # shadcn 基础组件
│   ├── button.tsx
│   ├── dialog.tsx
│   └── ...
├── command-palette/  # 命令面板功能
├── preferences/      # 偏好设置对话框
├── ThemeProvider.tsx
└── ErrorBoundary.tsx
```

### 约定

- **layout/** - 定义应用区域的结构组件
- **titlebar/** - 平台专属窗口控件
- **ui/** - shadcn/ui 基础组件（不要直接修改）
- **功能文件夹** - 将相关组件分组在一起

## shadcn/ui 使用

### 添加组件

```bash
npx shadcn@latest add button
npx shadcn@latest add dialog
```

组件被复制到 `src/components/ui/`，可以自定义。

### 自定义组件

shadcn 组件归你所有，可以修改。常见自定义：

```tsx
// src/components/ui/button.tsx
const buttonVariants = cva('...', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground',
      // 添加自定义变体
      success: 'bg-success text-success-foreground',
    },
  },
})
```

### 可用组件

本应用包含常用组件。运行 `npx shadcn@latest add [component]` 可从 [ui.shadcn.com](https://ui.shadcn.com/docs/components) 添加更多。

## `cn()` 工具函数

所有组件使用 `cn()` 工具函数处理条件类名：

```tsx
import { cn } from '@/lib/utils'

function MyComponent({ className, disabled }) {
  return (
    <div
      className={cn(
        'base-styles here',
        disabled && 'opacity-50',
        className // 允许覆盖
      )}
    >
      ...
    </div>
  )
}
```

**模式**：始终接受 `className` prop 并使用 `cn()` 合并，以保持灵活性。

## 组件模式

### 布局组件

布局组件应该：

- 接受 `children` 和 `className` props
- 使用 flexbox 配合 `overflow-hidden` 防止内容溢出
- 不设置外边距（由父级控制间距）

```tsx
interface SideBarProps {
  children?: React.ReactNode
  className?: string
}

export function LeftSideBar({ children, className }: SideBarProps) {
  return (
    <div className={cn('flex flex-col h-full overflow-hidden', className)}>
      {children}
    </div>
  )
}
```

### 使用 CSS 控制可见性

对于切换可见性的面板，优先使用 CSS 而非条件渲染：

```tsx
// 推荐：保留组件状态
;<ResizablePanel className={cn(!visible && 'hidden')}>
  <SideBar />
</ResizablePanel>

// 避免：隐藏/显示时丢失组件状态
{
  visible && <SideBar />
}
```

这样可以保留滚动位置、表单状态和调整尺寸。

## 最佳实践

### 推荐

- 使用语义颜色令牌（`bg-background`、`text-foreground`）
- 在组件上接受 `className` prop
- 使用 `cn()` 处理条件类名
- 保持桌面端 UX 约定（光标、选择、滚动）
- 遵循代码库中的现有模式

### 不推荐

- 使用原始颜色值（`bg-white`、`text-gray-900`）
- 硬编码亮色/暗色特定值
- 直接覆盖 shadcn 组件（应复制并修改）
- 到处添加 `cursor-pointer`（仅用于实际可点击的元素）
- 使用基于视口的响应式设计（这是固定尺寸的桌面应用）
