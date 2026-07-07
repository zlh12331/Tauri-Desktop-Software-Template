# 原生菜单系统

[English](menus.en.md) | **[中文](menus.zh.md)**

使用 JavaScript 构建的跨平台原生菜单系统，支持 i18n，与键盘快捷键和命令系统集成。

## 概述

本应用使用 Tauri 的 JS Menu API（`@tauri-apps/api/menu`）从 **JavaScript** 构建菜单。这使得：

- 通过 react-i18next 实现运行时翻译
- 语言变更时动态重建菜单
- 与 React 状态（Zustand）直接集成

## 当前菜单结构

```
App Name
├── About App Name
├── ────────────────────
├── Check for Updates...
├── ────────────────────
├── Preferences...           (Cmd+,)
├── ────────────────────
├── Hide App Name            (Cmd+H)
├── Hide Others              (Cmd+Alt+H)
├── Show All
├── ────────────────────
└── Quit App Name            (Cmd+Q)

View
├── Toggle Left Sidebar      (Cmd+1)
└── Toggle Right Sidebar     (Cmd+2)
```

## 架构

### 菜单构建器 (`src/lib/menu.ts`)

菜单使用翻译标签和直接操作处理器构建：

```typescript
import {
  Menu,
  MenuItem,
  Submenu,
  PredefinedMenuItem,
} from '@tauri-apps/api/menu'
import i18n from '@/i18n/config'
import { useUIStore } from '@/store/ui-store'

export async function buildAppMenu(): Promise<Menu> {
  const t = i18n.t.bind(i18n)

  const appSubmenu = await Submenu.new({
    text: APP_NAME,
    items: [
      await MenuItem.new({
        id: 'preferences',
        text: t('menu.preferences'),
        accelerator: 'CmdOrCtrl+,',
        action: handleOpenPreferences,
      }),
      // ... 更多项
    ],
  })

  const menu = await Menu.new({
    items: [appSubmenu, viewSubmenu],
  })

  await menu.setAsAppMenu()
  return menu
}

function handleOpenPreferences(): void {
  useUIStore.getState().setPreferencesOpen(true)
}
```

### 语言变更处理

语言变更时菜单会自动重建：

```typescript
export function setupMenuLanguageListener(): void {
  i18n.on('languageChanged', async () => {
    await buildAppMenu()
  })
}
```

## 菜单项类型

### 自定义菜单项

```typescript
await MenuItem.new({
  id: 'my-action',
  text: t('menu.myAction'),
  accelerator: 'CmdOrCtrl+M',
  action: handleMyAction,
})
```

### 预定义项

Tauri 提供常见的系统菜单项：

```typescript
await PredefinedMenuItem.new({ item: 'Separator' })
await PredefinedMenuItem.new({ item: 'Hide', text: t('menu.hide') })
await PredefinedMenuItem.new({ item: 'Quit', text: t('menu.quit') })
await PredefinedMenuItem.new({ item: 'Copy' })
await PredefinedMenuItem.new({ item: 'Paste' })
```

### 子菜单

```typescript
const viewSubmenu = await Submenu.new({
  text: t('menu.view'),
  items: [
    await MenuItem.new({ id: 'toggle-sidebar', text: t('menu.toggleSidebar'), ... }),
  ],
})
```

## 添加新菜单项

### 步骤 1：添加翻译键

```json
// locales/en.json
{
  "menu.myNewAction": "My New Action"
}
```

### 步骤 2：添加到菜单构建器

```typescript
// src/lib/menu.ts
await MenuItem.new({
  id: 'my-new-action',
  text: t('menu.myNewAction'),
  accelerator: 'CmdOrCtrl+N',
  action: handleMyNewAction,
})

function handleMyNewAction(): void {
  // 使用 getState() 获取当前 Store 值
  const { someValue } = useUIStore.getState()
  // 执行操作
}
```

### 步骤 3：添加到其他语言

将相同的键添加到 `/locales/` 中的所有语言文件。

## 操作处理器

菜单操作使用 Zustand 的 `getState()` 模式访问当前状态：

```typescript
function handleToggleLeftSidebar(): void {
  const store = useUIStore.getState()
  store.setLeftSidebarVisible(!store.leftSidebarVisible)
}
```

这确保处理器始终可以访问当前状态值。

## 平台差异

| 平台          | 菜单位置   | 修饰键 |
| ------------- | ---------- | ------ |
| macOS         | 系统菜单栏 | Cmd    |
| Windows/Linux | 窗口标题栏 | Ctrl   |

`CmdOrCtrl` 加速器会自动在每个平台上使用正确的修饰键。

## 故障排除

| 问题       | 解决方案                                     |
| ---------- | -------------------------------------------- |
| 菜单不显示 | 确保在应用初始化期间调用了 `buildAppMenu()`  |
| 翻译不更新 | 验证是否调用了 `setupMenuLanguageListener()` |
| 操作不工作 | 检查处理器是否使用 `getState()` 获取当前值   |
| 加速键冲突 | 验证快捷键是否在应用的其他地方被使用         |
