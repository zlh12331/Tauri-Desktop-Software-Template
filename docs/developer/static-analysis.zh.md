# 静态分析

[English](static-analysis.en.md) | **[中文](static-analysis.zh.md)**

本应用中配置的所有静态分析工具及其使用方法。

## 快速参考

| 工具           | 用途                | 命令                     | 在 check:all 中 |
| -------------- | ------------------- | ------------------------ | --------------- |
| TypeScript     | 类型检查            | `npm run typecheck`      | 是              |
| ESLint         | 语法、风格、TS 规则 | `npm run lint`           | 是              |
| Prettier       | 代码格式化          | `npm run format:check`   | 是              |
| ast-grep       | 架构模式            | `npm run ast:lint`       | 是              |
| React Compiler | 自动 memoization    | 构建时                   | 是              |
| cargo fmt      | Rust 格式化         | `npm run rust:fmt:check` | 是              |
| clippy         | Rust lint           | `npm run rust:clippy`    | 是              |
| Vitest         | 前端测试            | `npm run test:run`       | 是              |
| cargo test     | Rust 测试           | `npm run rust:test`      | 是              |
| knip           | 未使用代码检测      | `npm run knip`           | 否              |
| jscpd          | 重复代码检测        | `npm run jscpd`          | 否              |

## 运行所有检查

```bash
npm run check:all    # 提交前必须通过
npm run fix:all      # 自动修复可修复的问题
```

## 工具详情

### ESLint

处理语法、风格和 TypeScript 专属规则。

```bash
npm run lint        # 检查问题
npm run lint:fix    # 自动修复问题
```

配置在 `eslint.config.js`。

### Prettier

一致的代码格式化。

```bash
npm run format:check   # 检查格式化
npm run format         # 修复格式化
```

配置在 `prettier.config.js`。

### ast-grep

强制执行 ESLint 无法检测的架构模式。捕获如 Zustand 解构和 Hook 在错误目录中的违规。

```bash
npm run ast:lint    # 扫描违规
npm run ast:fix     # 尽可能自动修复
```

**关键规则：**

- 禁止 Zustand 解构（会导致渲染级联）
- Hook 必须在 `hooks/` 目录中
- `lib/` 中禁止 store 订阅

参见 [writing-ast-grep-rules.zh.md](./writing-ast-grep-rules.zh.md) 了解如何创建新规则。

### React Compiler

在构建时自动处理 memoization。你**不需要**手动添加：

- `useMemo` 用于计算值
- `useCallback` 用于函数引用
- `React.memo` 用于组件

编译器分析代码并在有益的地方添加 memoization。

**注意**：`getState()` 模式仍然关键 - 它避免的是 store 订阅，而非 memoization。参见 [state-management.zh.md](./state-management.zh.md)。

### Rust 工具

```bash
npm run rust:fmt:check   # 检查格式化
npm run rust:fmt         # 修复格式化
npm run rust:clippy      # 使用 clippy 进行 lint
npm run rust:clippy:fix  # 自动修复 clippy 警告
npm run rust:test        # 运行 Rust 测试
```

### knip（定期清理）

检测未使用的导出、依赖和文件。不在 `check:all` 中 - 定期使用。

```bash
npm run knip
```

### jscpd（定期清理）

检测重复代码块。不在 `check:all` 中 - 定期使用。

```bash
npm run jscpd
```

使用 `npm run knip` 和 `npm run jscpd` 进行死代码和重复的引导分析和清理。

## CI 集成

`check:all` 在 CI 中运行。推送前确保本地通过：

```bash
npm run check:all
```

## 添加新规则

**ESLint**：在 `eslint.config.js` 中添加规则

**ast-grep**：在 `.ast-grep/rules/` 中创建 YAML 文件。参见 [writing-ast-grep-rules.zh.md](./writing-ast-grep-rules.zh.md)。

**Prettier**：修改 `prettier.config.js`
