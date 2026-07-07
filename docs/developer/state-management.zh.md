# 状态管理

[English](state-management.en.md) | **[中文](state-management.zh.md)**

三层"洋葱"状态管理架构。

## 三层结构

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

### 第 1 层：TanStack Query（持久化数据）

适用于以下数据：

- 来自 Tauri 后端（文件系统、外部 API）
- 需要缓存和自动重新获取
- 具有加载中、错误和成功状态

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => commands.getUser({ userId }),
  enabled: !!userId,
})
```

有关重试配置和错误显示模式，请参阅 [error-handling.md](./error-handling.zh.md)。

### 第 2 层：Zustand（全局 UI 状态）

适用于瞬态全局状态：

- 面板可见性、布局状态
- 命令面板打开/关闭
- UI 模式和导航

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface UIState {
  sidebarVisible: boolean
  toggleSidebar: () => void
}

export const useUIStore = create<UIState>()(
  devtools(
    set => ({
      sidebarVisible: true,
      toggleSidebar: () =>
        set(state => ({ sidebarVisible: !state.sidebarVisible })),
    }),
    { name: 'ui-store' }
  )
)
```

### 第 3 层：useState（组件状态）

适用于以下状态：

- 仅影响 UI 展示
- 从 props 或全局状态派生
- 与组件生命周期紧密耦合

```typescript
const [isDropdownOpen, setIsDropdownOpen] = useState(false)
const [windowWidth, setWindowWidth] = useState(window.innerWidth)
```

## 性能模式（关键）

### `getState()` 模式

**问题**：在回调中订阅 Store 数据会导致渲染级联。

**解决方案**：在需要当前状态的回调中使用 `getState()`。

```typescript
// ❌ 坏：每次 Store 变更都会导致渲染级联
const { currentFile, isDirty, saveFile } = useEditorStore()

const handleSave = useCallback(() => {
  if (currentFile && isDirty) {
    void saveFile()
  }
}, [currentFile, isDirty, saveFile]) // 每次变更都会重新创建！

// ✅ 好：无级联，稳定的回调
const handleSave = useCallback(() => {
  const { currentFile, isDirty, saveFile } = useEditorStore.getState()
  if (currentFile && isDirty) {
    void saveFile()
  }
}, []) // 稳定的依赖数组
```

**何时使用 `getState()`：**

- 在 `useCallback` 依赖中，需要当前状态但不希望触发重新渲染时
- 在事件处理器中，访问最新状态而无需订阅时
- 在带有空依赖的 `useEffect` 中，仅在挂载时需要当前状态时
- 在异步操作中，状态可能在执行期间发生变化时

### Store 订阅优化

```typescript
// ❌ 坏：对象解构会订阅整个 Store
const { currentFile } = useEditorStore()

// ✅ 好：选择器仅在此特定值变更时重新渲染
const currentFile = useEditorStore(state => state.currentFile)

// ✅ 好：派生选择器实现最小化重新渲染
const hasCurrentFile = useEditorStore(state => !!state.currentFile)
const currentFileName = useEditorStore(state => state.currentFile?.name)
```

### CSS 可见性与条件渲染

对于有状态的 UI 组件（如 `react-resizable-panels`），使用 CSS 可见性：

```typescript
// ❌ 坏：条件渲染会破坏有状态组件
{sidebarVisible ? <ResizablePanel /> : null}

// ✅ 好：CSS 可见性保留组件树
<ResizablePanel className={sidebarVisible ? '' : 'hidden'} />
```

### React Compiler（自动记忆化）

本应用使用 React Compiler，它会自动处理记忆化。你**不需要**手动添加：

- 用于计算值的 `useMemo`
- 用于函数引用的 `useCallback`
- 用于组件的 `React.memo`

**注意：** `getState()` 模式仍然至关重要 - 它避免的是 Store 订阅，而非记忆化。

## Store 边界

**UIStore** - 用于：

- 面板可见性
- 布局状态
- 命令面板状态
- UI 模式和导航

**功能特定的 Store** - 用于：

- 领域特定状态（例如 `useDocumentStore`）
- 功能开关和配置
- 临时工作流状态

## 添加新 Store

1. 在 `src/store/` 中创建 Store 文件
2. 遵循使用 `devtools` 中间件的模式
3. 在 `.ast-grep/rules/zustand/no-destructure.yml` 中添加禁止解构规则

```yaml
rule:
  any:
    - pattern: const { $$$PROPS } = useUIStore($$$ARGS)
    - pattern: const { $$$PROPS } = useNewStore($$$ARGS) # 添加新 Store
```
