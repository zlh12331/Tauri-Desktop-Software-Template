# 包优化

[English](bundle-optimization.en.md) | **[中文](bundle-optimization.zh.md)**

Tauri React 应用的包大小优化。

## 内置优化

本应用开箱即用包含多项优化：

### Rust 二进制文件（20-30% 大小减少）

**文件**：`src-tauri/Cargo.toml`

```toml
[profile.release]
codegen-units = 1     # 更好的 LLVM 优化
lto = true            # 链接时优化
opt-level = "s"       # 优化大小
panic = "unwind"      # Sentry panic 捕获所需
strip = true          # 移除调试符号
```

### Tauri 构建

**文件**：`src-tauri/tauri.conf.json`

```json
{
  "build": {
    "removeUnusedCommands": true
  }
}
```

移除前端未调用的 Tauri 命令。

## 分析包大小

```bash
npm run build:analyze   # 构建并分析

# 手动分析
npm run build
du -sh dist/*           # 检查输出大小
ls -lah dist/assets/    # 检查分块
```

## 何时进一步优化

内置优化对大多数应用已足够。以下情况考虑进一步优化：

- 构建后的应用 > 10MB
- 初始加载 > 3 秒
- 有大型依赖但未完全使用

## Tree Shaking

### 导入优化

```typescript
// 错误：导入整个库
import * as icons from 'lucide-react'

// 正确：仅导入所需内容
import { Search, Settings, User } from 'lucide-react'

// 错误：完整的 lodash
import _ from 'lodash'

// 正确：特定函数
import { debounce } from 'lodash-es'
```

### 日期库

```typescript
// 正确：可 tree-shake 的导入
import { format } from 'date-fns/format'
import { parseISO } from 'date-fns/parseISO'

// 或使用原生 API
new Intl.DateTimeFormat('en-US').format(date)
```

## 代码分割

对于有多个路由/功能的应用：

```typescript
import { lazy, Suspense } from 'react'

const Dashboard = lazy(() => import('./Dashboard'))
const Settings = lazy(() => import('./Settings'))

// 在组件中
<Suspense fallback={<div>Loading...</div>}>
  <Dashboard />
</Suspense>
```

### 手动分块（高级）

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
  },
})
```

## Tauri 专属优化

### 移除未使用的插件

```toml
# src-tauri/Cargo.toml - 注释掉未使用的插件
[dependencies]
# tauri-plugin-fs = "2"        # 如果未使用则移除
```

### 最小化 Capabilities

仅在 `src-tauri/capabilities/desktop.json` 中包含你使用的权限。

## 常见问题

| 问题                 | 解决方案                                        |
| -------------------- | ----------------------------------------------- |
| 初始包过大           | 实现代码分割                                    |
| 重复依赖             | `npm ls react` 然后 `npm dedupe`                |
| 未使用的 shadcn 组件 | 从 `src/components/ui/` 移除                    |
| 重量级日期库         | 使用 `date-fns` 配合 tree shaking 或原生 `Intl` |

## 衡量影响

```bash
# Rust 二进制文件大小
cd src-tauri && cargo build --release
ls -lah target/release/tauri-app

# 前端包
npm run build && du -sh dist/
```

**记住**：优化前先衡量。不要过早过度优化。
