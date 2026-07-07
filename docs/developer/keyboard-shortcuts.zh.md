# 键盘快捷键

[English](keyboard-shortcuts.en.md) | **[中文](keyboard-shortcuts.zh.md)**

使用原生 DOM 事件监听器的集中式键盘快捷键管理。

## 当前快捷键

| 快捷键       | Mac   | Windows/Linux | 操作              |
| ------------ | ----- | ------------- | ----------------- |
| 打开偏好设置 | Cmd+, | Ctrl+,        | 打开设置对话框    |
| 命令面板     | Cmd+K | Ctrl+K        | 打开命令搜索      |
| 切换左侧边栏 | Cmd+1 | Ctrl+1        | 显示/隐藏左侧面板 |
| 切换右侧边栏 | Cmd+2 | Ctrl+2        | 显示/隐藏右侧面板 |

## 架构

所有快捷键都在 `src/hooks/useMainWindowEventListeners.ts` 中处理：

```typescript
export function useMainWindowEventListeners() {
  const commandContext = useCommandContext()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case ',': {
            e.preventDefault()
            commandContext.openPreferences()
            break
          }
          case '1': {
            e.preventDefault()
            const { leftSidebarVisible, setLeftSidebarVisible } =
              useUIStore.getState()
            setLeftSidebarVisible(!leftSidebarVisible)
            break
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [commandContext])
}
```

**关键**：在事件处理器中使用 `getState()` 访问 Store 数据以避免渲染级联。请参阅[状态管理](./state-management.zh.md#the-getstate-pattern)。

## 添加新快捷键

### 1. 添加到事件处理器

```typescript
// src/hooks/useMainWindowEventListeners.ts
case '3': {
  e.preventDefault()
  commandContext.myNewAction()
  break
}
```

### 2. 添加到原生菜单（如适用）

```typescript
// src/lib/menu.ts
await MenuItem.new({
  id: 'my-action',
  text: t('menu.myAction'),
  accelerator: 'CmdOrCtrl+3',
  action: handleMyAction,
})
```

有关完整的菜单集成详情，请参阅[菜单](./menus.zh.md)。

## 修饰键

```typescript
// 跨平台修饰键（Mac 上是 Cmd，其他平台是 Ctrl）
if (e.metaKey || e.ctrlKey) {
}

// 配合 Shift
if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
}

// 功能键（无需修饰键）
if (e.key === 'F1') {
}
```

**始终调用 `e.preventDefault()`** 以阻止浏览器默认行为（如 Cmd+, 打开浏览器设置）。

## 为什么使用原生 DOM 事件

使用原生 DOM 事件监听器而非 `react-hotkeys-hook` 等库，是因为它们在 Tauri 环境中提供更可靠的执行。

## 约定

| 模式      | 按键                |
| --------- | ------------------- |
| 偏好设置  | Cmd/Ctrl + ,        |
| 搜索/命令 | Cmd/Ctrl + K        |
| 面板切换  | Cmd/Ctrl + 1,2,3... |
| 文件操作  | Cmd/Ctrl + N,O,S    |
| 撤销      | Cmd/Ctrl + Z        |
| 重做      | Cmd/Ctrl + Shift+Z  |

## 故障排除

| 问题                    | 检查                                                   |
| ----------------------- | ------------------------------------------------------ |
| 快捷键不触发            | `useMainWindowEventListeners` 是否在 MainWindow 中调用 |
| 浏览器拦截快捷键        | 添加 `e.preventDefault()`                              |
| Mac 与 Windows 行为不同 | 测试 `e.metaKey \|\| e.ctrlKey`                        |
