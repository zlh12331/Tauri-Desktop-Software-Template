# 通知

[English](notifications.en.md) | **[中文](notifications.zh.md)**

简单的通知系统，支持应用内 Toast（Sonner）和原生系统通知（Tauri）。

## 快速开始

### 基本用法

```typescript
import { notify, notifications } from '@/lib/notifications'

// 简单信息 Toast
notify('File saved', 'Successfully saved to disk')

// 特定通知类型
notifications.success('Success!', 'Operation completed')
notifications.error('Error', 'Something went wrong')
notifications.warning('Warning', 'Please check your input')
notifications.info('Info', 'Here is some information')

// 原生系统通知
notify('Update Available', 'Click to install', { native: true })
```

### 可用函数

| 函数                                | 描述                     |
| ----------------------------------- | ------------------------ |
| `notify(title, message?, options?)` | 发送通知（Toast 或原生） |
| `notifications.success()`           | 成功 Toast 或原生通知    |
| `notifications.error()`             | 错误 Toast 或原生通知    |
| `notifications.info()`              | 信息 Toast 或原生通知    |
| `notifications.warning()`           | 警告 Toast 或原生通知    |

## 配置

### Toast 通知（Sonner）

- **应用内**：出现在右下角
- **主题适配**：自动适应亮色/暗色主题
- **自动消失**：默认行为（可自定义）
- **定位**：始终在应用窗口内可见

### 原生系统通知

- **macOS**：出现在通知中心
- **平台感知**：由操作系统通知系统处理
- **权限**：需要时自动请求权限
- **回退**：原生通知失败时回退到 Toast

## 选项

```typescript
interface NotificationOptions {
  type?: 'success' | 'error' | 'info' | 'warning' // 通知类型
  native?: boolean // 使用原生通知
  duration?: number // Toast 持续时间（毫秒，0 = 不自动消失）
}
```

## 示例

### React 组件用法

```typescript
import { notifications } from '@/lib/notifications'

function SaveButton() {
  const handleSave = async () => {
    try {
      await saveFile()
      notifications.success('Saved', 'File saved successfully')
    } catch (error) {
      notifications.error('Save Failed', error.message)
    }
  }

  return <button onClick={handleSave}>Save</button>
}
```

### 命令面板集成

通知系统包含可通过命令面板（Cmd+K）访问的测试命令：

- **测试成功 Toast** - 显示成功 Toast
- **测试错误 Toast** - 显示错误 Toast
- **测试信息 Toast** - 显示信息 Toast
- **测试警告 Toast** - 显示警告 Toast
- **测试原生成功通知** - 显示原生通知
- **测试原生信息通知** - 显示带详情的原生通知

### 高级用法

```typescript
// 自定义持续时间（5 秒）
notify('Long message', 'This will stay visible for 5 seconds', {
  duration: 5000,
})

// 持久 Toast（不自动消失）
notify('Important', 'This requires manual dismissal', {
  duration: 0,
})

// 带回退的原生通知
try {
  await notify('System Alert', 'Check this out', { native: true })
} catch (error) {
  // 自动回退到 Toast 通知
  console.log('Native notification failed, showed toast instead')
}
```

## 实现细节

### 前端（TypeScript）

- **位置**：`src/lib/notifications.ts`
- **依赖**：Sonner 用于 Toast，Tauri API 用于原生通知
- **错误处理**：从原生通知自动回退到 Toast
- **日志**：所有通知操作通过 logger 工具记录

### 后端（Rust）

- **命令**：`send_native_notification`
- **插件**：`tauri-plugin-notification`
- **平台支持**：仅桌面端（移动端显示错误）
- **日志**：全面记录通知尝试

### 权限

原生通知需要在 `src-tauri/capabilities/default.json` 中配置 `notification:default` 权限：

```json
{
  "permissions": ["notification:default"]
}
```

## 最佳实践

1. **选择正确的类型**：应用内反馈使用 Toast，系统级提醒使用原生通知
2. **保持消息简洁**：简短的标题和清晰的消息效果最好
3. **使用合适的类型**：通知类型应与操作结果匹配
4. **处理错误**：系统包含自动回退处理
5. **测试两种模式**：使用命令面板测试命令验证功能

## 故障排除

### 原生通知不工作

1. **检查权限**：确保在 macOS 系统偏好设置中已授予通知权限
2. **检查控制台**：查看权限请求对话框或错误消息
3. **测试回退**：原生通知失败时自动回退到 Toast
4. **开发模式**：通知在开发和生产构建中均可工作

### Toast 通知不出现

1. **检查 Toaster 组件**：确保 `<Toaster />` 在 MainWindow 中渲染
2. **检查主题**：Toast 应自动适应当前主题
3. **检查定位**：默认位置是右下角

### 命令面板测试

使用内置测试命令验证 Toast 和原生通知是否正常工作：

1. 打开命令面板（Cmd+K）
2. 搜索 "notification" 或 "toast"
3. 运行测试命令验证功能
