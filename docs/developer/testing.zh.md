# 测试

[English](testing.en.md) | **[中文](testing.zh.md)**

Rust 和 TypeScript 的测试模式，重点关注 Tauri 特定的 mock。

## 运行测试

```bash
npm run check:all      # 所有测试和检查
npm run test           # TypeScript 测试（watch 模式）
npm run test:run       # TypeScript 测试（单次运行）
npm run rust:test      # Rust 测试
```

## TypeScript 测试

使用 **Vitest** + **@testing-library/react**。配置在 `vitest.config.ts`。

### 测试文件位置

将测试文件放在被测代码旁边：

```
src/components/ui/Button.tsx
src/components/ui/Button.test.tsx
```

### Mock Tauri API（关键）

Tauri 命令必须被 mock，因为测试在 Tauri 环境之外运行。Mock 配置在 `src/test/setup.ts`：

```typescript
// src/test/setup.ts
import { vi } from 'vitest'

// Mock Tauri 事件 API
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn().mockResolvedValue(null),
}))

// Mock 类型化 Tauri 绑定（tauri-specta 生成）
vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    greet: vi.fn().mockResolvedValue('Hello, test!'),
    loadPreferences: vi
      .fn()
      .mockResolvedValue({ status: 'ok', data: { theme: 'system' } }),
    savePreferences: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    sendNativeNotification: vi
      .fn()
      .mockResolvedValue({ status: 'ok', data: null }),
    saveEmergencyData: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    loadEmergencyData: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    cleanupOldRecoveryFiles: vi
      .fn()
      .mockResolvedValue({ status: 'ok', data: 0 }),
  },
}))
```

### 使用 Mock 命令测试

```typescript
import { vi } from 'vitest'
import { commands } from '@/lib/tauri-bindings'

const mockCommands = vi.mocked(commands)

test('loads preferences', async () => {
  mockCommands.loadPreferences.mockResolvedValue({
    status: 'ok',
    data: { theme: 'dark' },
  })

  // 测试调用 loadPreferences 的代码
})
```

### Provider 的测试包裹器

使用 TanStack Query 的组件需要 provider 包裹器：

```typescript
// src/test/utils.ts
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

export function TestProviders({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

用法：

```typescript
import { render } from '@testing-library/react'
import { TestProviders } from '@/test/utils'

test('component with query', () => {
  render(
    <TestProviders>
      <MyComponent />
    </TestProviders>
  )
})
```

### 测试 Zustand Store

```typescript
import { renderHook, act } from '@testing-library/react'
import { useUIStore } from '@/store/ui-store'

test('toggles sidebar visibility', () => {
  const { result } = renderHook(() => useUIStore())

  expect(result.current.leftSidebarVisible).toBe(true)

  act(() => {
    result.current.setLeftSidebarVisible(false)
  })

  expect(result.current.leftSidebarVisible).toBe(false)
})
```

## Rust 测试

### 单元测试

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_preferences_default() {
        let prefs = AppPreferences::default();
        assert_eq!(prefs.theme, "system");
    }
}
```

### 异步测试

```rust
#[tokio::test]
async fn test_async_operation() {
    let result = some_async_fn().await;
    assert!(result.is_ok());
}
```

### 文件操作测试

需要文件系统访问的测试使用 `tempfile`：

```rust
use tempfile::TempDir;

#[test]
fn test_file_operations() {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("test.json");

    // 测试写入
    std::fs::write(&file_path, "{}").unwrap();

    // 测试读取
    let content = std::fs::read_to_string(&file_path).unwrap();
    assert_eq!(content, "{}");
}
```

## 添加新命令 Mock

添加新的 Tauri 命令时，更新 `src/test/setup.ts`：

```typescript
vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    // ... 现有 mock
    myNewCommand: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
  },
}))
```

## E2E 测试（Playwright）

使用 **Playwright**，通过浏览器注入的 Tauri API mock。配置在 `playwright.config.ts`。

### 运行 E2E 测试

```bash
npx playwright test                    # 所有 E2E 测试
npx playwright test e2e/keyboard-shortcuts.spec.ts  # 单个文件
npx playwright test --workers=1        # 顺序执行
```

### E2E 测试文件

| 文件                               | 覆盖范围                          |
| ---------------------------------- | --------------------------------- |
| `app-launch.spec.ts`               | 应用启动和初始渲染                |
| `sidebar.spec.ts`                  | 侧边栏切换和可调整面板行为        |
| `preferences.spec.ts`              | 偏好设置对话框打开/关闭和面板导航 |
| `command-palette.spec.ts`          | 命令面板搜索和执行                |
| `command-palette-keyboard.spec.ts` | 命令面板键盘导航                  |
| `theme-language.spec.ts`           | 主题切换和语言选择                |
| `crash-report.spec.ts`             | 崩溃报告对话框外观                |
| `crash-report-details.spec.ts`     | 崩溃报告发送/不发送流程           |
| `general-pane.spec.ts`             | 通用偏好设置面板控件              |
| `advanced-pane.spec.ts`            | 高级偏好设置面板控件              |
| `accessibility.spec.ts`            | AXE 无障碍审计                    |
| `keyboard-shortcuts.spec.ts`       | 全局键盘快捷键（Ctrl+1/2/,/K）    |
| `notifications.spec.ts`            | 通过命令面板的 Toast 通知系统     |
| `window-commands.spec.ts`          | 窗口控制命令（最小化/最大化等）   |
| `quick-pane-event.spec.ts`         | 快捷面板与主窗口的事件通信        |
| `i18n-completeness.spec.ts`        | 国际化标签和下拉框行为            |

### Tauri API Mock

mock（`e2e/mocks/tauri-mock.ts`）通过 `page.addInitScript()` 在任何页面脚本运行之前注入。它设置 `window.__TAURI_INTERNALS__`，包含：

- `invoke(cmd, args)` — 将 Tauri 命令路由到 mock 实现
- `transformCallback(callback, once)` — 注册事件监听器的回调

关键 mock 功能：

- **事件监听**：`plugin:event|listen` 存储 `{event, handlerId}` 对。Tauri 2.0 传递 `handler`（回调 ID）而非 `channel`。
- **事件发射**：`window.__testHelpers.emitEvent(eventName, payload)` 通过回调 ID 查找分发给已注册的监听器。
- **测试辅助**：`window.__testHelpers` 提供 `getRegisteredChannels()`、`getInvokeLog()`、`setCrashReport()`、`getPreferences()`、`setPreferences()`。

## 最佳实践

| 推荐                                 | 不推荐                     |
| ------------------------------------ | -------------------------- |
| 在 setup.ts 中 mock Tauri 命令       | 在测试中调用真实 Tauri API |
| 使用 `vi.mocked()` 进行类型安全 mock | 使用无类型 mock 断言       |
| 测试用户可见行为                     | 测试实现细节               |
| Rust 文件测试使用 `tempfile`         | 写入真实文件系统           |
| E2E 选择器中使用 `getByRole()`       | 使用脆弱的 CSS 选择器      |
| E2E 中等待 `__testHelpers`           | 假设监听器已就绪           |

## 覆盖率豁免清单

单元测试补充（batch 1-14）完成后，全量覆盖率：语句 97.07% / 分支 92.84% / 函数 95.97% / 行 97.49%（962 tests / 53 files）。

以下分支经判定豁免，不补测试：

| 位置                                                                             | 豁免类型               | 证据                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/components/preferences/panes/GeneralPane.tsx:42` `if (!preferences) return` | 客观不可达（防御兜底） | 行 137 `disabled={!preferences \|\| savePreferences.isPending}` 使 `ShortcutPicker` 在 preferences 缺失时禁用；`ShortcutPicker.tsx:180-190` 的 `handleClick`/`handleReset` 在 disabled 时直接 return，`onChange` 无法触发 `handleShortcutChange`，故该守卫分支永不执行。 |

其余全部模块（menu / use-auto-updater / use-square-corners-effect / QuickPaneApp / CommandPalette / GeneralPane / window-commands / commands index / TitleBar / i18n config / PreferencesDialog / CrashReportDialog）分支覆盖率均 ≥92%，无未覆盖分支。

### 后端（Rust）豁免清单

Rust 单元测试补充（batch 1-5）完成后：全量 region 82.00% / line 78.68%（430 tests）。核心域模块分支覆盖率：crash_report 87.53%、preferences 91.76%、recovery 90.94%、redact 100%、types 100%。

以下路径经判定豁免（客观不可达——需真实外部环境）：

| 位置                                                              | 豁免类型           | 证据                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `commands/notifications.rs` 命令体（show 调用）                   | 客观不可达         | `send_native_notification` 签名绑定 `AppHandle`（Wry）；`AppHandle<MockRuntime>` 类型不兼容，且成功/失败需真实 notification 插件 + OS 通知服务。验证逻辑已提取 `validate_notification` 并 100% 覆盖                                                     |
| `commands/tray.rs` `init_tray` / `handle_tray_event` / 窗口可见性 | 客观不可达         | 需真实系统托盘 + Wry window；`tray_quit` 分支 `app.exit(0)` 在 MockRuntime 下 panic（`mock_runtime.rs:144` "not implemented"）                                                                                                                          |
| `commands/quick_pane.rs` 窗口显示/隐藏、快捷键注册                | 客观不可达         | `register_quick_pane_shortcut` 需 global-shortcut 插件 + Wry；窗口定位需真实 cursor/monitor。验证逻辑已提取 `validate_shortcut` 并覆盖                                                                                                                  |
| `commands/crash_report.rs` `_impl` 包装 / `setup_panic_hook`      | 客观不可达         | `_impl` 需 AppHandle + `spawn_blocking` 真实目录；`setup_panic_hook` 修改进程全局 panic hook，测试会污染全部其它用例。纯逻辑（`init_consent_from_path`、`persist_consent_to_path`、`escape_json_string`、`read/delete_crash_report_from_path`）均已覆盖 |
| `lib.rs` / `main.rs` / `bindings.rs`                              | 快通道（装配样板） | Tauri 应用装配、插件注册、`run()` 事件循环需完整桌面环境；`export_ts_bindings` 是 `#[ignore]` 的手动命令                                                                                                                                                |
| `commands/notifications.rs` mobile 分支                           | 客观不可达         | `#[cfg(mobile)]` 在桌面测试编译下不存在                                                                                                                                                                                                                 |
| `utils/paths.rs` 2 个防御 `map_err` 闭包                          | 客观不可达         | MockRuntime 下 `app_data_dir()` 恒成功；TempDir 下 `create_dir_all` 恒成功                                                                                                                                                                              |
