# 命令系统

[English](command-system.en.md) | **[中文](command-system.zh.md)**

命令系统提供了一种统一的方式来注册和执行整个应用中的操作，使键盘快捷键、菜单和命令面板之间保持一致的行为。

## 快速开始

### 定义命令

```typescript
// src/lib/commands/my-feature-commands.ts
import { SomeIcon } from 'lucide-react'
import type { AppCommand } from './types'

export const myFeatureCommands: AppCommand[] = [
  {
    id: 'my-action',
    labelKey: 'commands.myAction.label',
    descriptionKey: 'commands.myAction.description',
    icon: SomeIcon,
    group: 'my-feature',
    shortcut: '⌘+M',
    keywords: ['my', 'action', 'feature'],

    execute: context => {
      context.showToast('Action executed!')
    },

    isAvailable: () => true,
  },
]
```

### 注册命令

```typescript
// src/lib/commands/index.ts
import { myFeatureCommands } from './my-feature-commands'
import { registerCommands } from './registry'

export function initializeCommandSystem(): void {
  registerCommands(myFeatureCommands)
  // 注册其他命令组...
}
```

## 架构

### 命令结构

```typescript
interface AppCommand {
  id: string
  labelKey: string // 翻译键（例如 'commands.myAction.label'）
  descriptionKey?: string // 描述的翻译键
  icon?: LucideIcon
  group?: string // 用于命令面板分组
  keywords?: string[] // 额外的搜索词
  shortcut?: string // 显示快捷键（例如 '⌘+1'）
  execute: (context: CommandContext) => void | Promise<void>
  isAvailable?: (context: CommandContext) => boolean
}
```

### 命令上下文

上下文提供命令所需的操作，而无需紧耦合：

```typescript
interface CommandContext {
  openPreferences: () => void
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}
```

### 注册表模式

命令存储在中央注册表中：

```typescript
// 注册命令（在应用初始化时调用一次）
registerCommands(navigationCommands)

// 获取过滤后的命令（用于命令面板）
const commands = getAllCommands(context, searchValue, t)

// 按 ID 执行（返回成功/错误结果）
const result = await executeCommand(commandId, context)
```

**关键模式**：命令在 execute 函数中使用 `getState()`：

```typescript
// ✅ 好：在 execute 中直接访问 Store
execute: () => {
  const { leftSidebarVisible, setLeftSidebarVisible } = useUIStore.getState()
  setLeftSidebarVisible(!leftSidebarVisible)
}

// ❌ 坏：使用 Hook（会导致重新渲染）
const { leftSidebarVisible } = useUIStore()
execute: () => setLeftSidebarVisible(!leftSidebarVisible)
```

## 集成点

### 命令面板

命令面板（`Cmd+K`）显示所有可用命令及其翻译标签：

```typescript
const { t } = useTranslation()
const commands = getAllCommands(commandContext, search, t)

// 使用翻译文本渲染命令
<CommandItem onSelect={() => handleCommandSelect(command.id)}>
  {command.icon && <command.icon />}
  <span>{t(command.labelKey)}</span>
</CommandItem>
```

### 键盘快捷键

通过命令上下文将快捷键链接到命令：

```typescript
// src/hooks/use-keyboard-shortcuts.ts
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.metaKey || e.ctrlKey) {
    switch (e.key) {
      case ',': {
        e.preventDefault()
        commandContext.openPreferences()
        break
      }
    }
  }
}
```

### 原生菜单

菜单事件通过 Tauri 事件触发命令：

```typescript
// React 端 - 在 useMainWindowEventListeners 中
listen('menu-preferences', () => {
  commandContext.openPreferences()
})
```

## 添加新命令

### 步骤 1：添加翻译键

```json
// locales/en.json
{
  "commands": {
    "myAction": {
      "label": "My Action",
      "description": "Does something useful"
    }
  }
}
```

### 步骤 2：创建命令文件

```typescript
// src/lib/commands/my-feature-commands.ts
export const myFeatureCommands: AppCommand[] = [
  {
    id: 'my-action',
    labelKey: 'commands.myAction.label',
    descriptionKey: 'commands.myAction.description',
    group: 'my-feature',

    execute: context => {
      // 你的逻辑
      context.showToast('Done!')
    },
  },
]
```

### 步骤 3：在 index 中注册

```typescript
// src/lib/commands/index.ts
import { myFeatureCommands } from './my-feature-commands'

export function initializeCommandSystem(): void {
  registerCommands(navigationCommands)
  registerCommands(myFeatureCommands) // 在此添加
  // ...
}
```

### 步骤 4：扩展上下文（如果需要）

```typescript
// src/hooks/use-command-context.ts
export function useCommandContext(): CommandContext {
  return useMemo(
    () => ({
      // ... 现有操作
      myNewAction: () => {
        /* 实现 */
      },
    }),
    []
  )
}

// 在 types.ts 中更新 CommandContext 类型
```

## 命令组

将命令组织到逻辑分组中（用于命令面板标题）：

- **navigation**：侧边栏切换、视图切换
- **settings**：偏好设置、配置
- **notifications**：通知操作
- **window**：窗口管理（最小化、关闭等）

组标签通过 `commands.group.{groupName}` 键进行翻译。

## 最佳实践

| 应该                                | 不应该            |
| ----------------------------------- | ----------------- |
| 使用带翻译键的 `labelKey`           | 硬编码标签字符串  |
| 在 execute 函数中使用 `getState()`  | 在命令中使用 Hook |
| 为上下文相关命令检查 `isAvailable`  | 显示不可用的命令  |
| 提供 `keywords` 以提高搜索性        | 仅依赖标签匹配    |
| 使用 `context.showToast()` 提供反馈 | 静默执行无反馈    |
