# 编写 ast-grep 规则

[English](writing-ast-grep-rules.en.md) | **[中文](writing-ast-grep-rules.zh.md)**

创建自定义 ast-grep 规则的参考。面向 AI 代理，也可供人类阅读。

## 何时添加规则

在以下情况添加 ast-grep 规则：

- 你发现重复的架构违规
- ESLint 无法表达该规则（需要基于模式的匹配）
- 该模式已导致 bug 或性能问题

## 规则结构

```yaml
id: rule-name
message: |
  Brief description with examples.

  BAD: example
  GOOD: example
severity: error # or warning
language: Tsx # or TypeScript
files: # Optional: restrict to paths
  - 'src/lib/**/*.ts'
rule:
  pattern: $PATTERN
note: |
  Additional context for developers.
```

## 模式语法

| 语法      | 含义           | 示例                       |
| --------- | -------------- | -------------------------- |
| `$VAR`    | 单个 AST 节点  | `const $NAME = useStore()` |
| `$$$ARGS` | 零个或多个节点 | `function($$$ARGS)`        |
| `$$`      | 匿名通配符     | `{ $$, field: $VALUE }`    |

## 测试模式

对代码库测试模式：

```bash
npx ast-grep run --pattern 'const { $$$PROPS } = useUIStore($$$ARGS)' src/
```

测试规则文件：

```bash
npx ast-grep scan -r .ast-grep/rules/zustand/no-destructure.yml
```

## 示例：禁止 Zustand 解构

**文件：** `.ast-grep/rules/zustand/no-destructure.yml`

```yaml
id: no-destructure-zustand
message: |
  Don't destructure Zustand stores - use selectors instead.

  BAD: const { visible } = useUIStore()
  GOOD: const visible = useUIStore(state => state.visible)
severity: error
language: Tsx
rule:
  any:
    - pattern: const { $$$PROPS } = useUIStore($$$ARGS)
    - pattern: const { $$$PROPS } = usePreferencesStore($$$ARGS)
note: |
  Destructuring subscribes to the entire store, causing unnecessary re-renders.
  See docs/developer/state-management.zh.md for details.
```

## 向现有规则添加新 Store

添加新的 Zustand store 时，更新 no-destructure 规则：

```yaml
rule:
  any:
    - pattern: const { $$$PROPS } = useUIStore($$$ARGS)
    - pattern: const { $$$PROPS } = useNewStore($$$ARGS) # Add new store
```

## 常见模式

### 捕获 hooks 目录之外的 hook 调用

```yaml
id: hooks-in-hooks-dir
language: TypeScript
files:
  - 'src/lib/**/*.ts'
rule:
  pattern: export function use$NAME($$$ARGS)
```

### 捕获 lib/ 中的 store 订阅

```yaml
id: no-store-in-lib
language: TypeScript
files:
  - 'src/lib/**/*.ts'
rule:
  pattern: const $VAR = $STORE(state => $$$SELECTOR)
```

## 调试

**规则不匹配：**

1. 检查 `language` 是否匹配文件类型（`.tsx` 用 `Tsx`，`.ts` 用 `TypeScript`）
2. 用 `npx ast-grep run` 直接测试模式
3. 如果使用了路径限制，验证 `files` glob 模式

**误报：**

- 在规则中使用 `ignores` 添加例外
- 更新 `sgconfig.yml` 排除路径

## 资源

- [模式语法](https://ast-grep.github.io/guide/pattern-syntax.html)
- [规则配置](https://ast-grep.github.io/reference/yaml.html)
- [规则目录](https://ast-grep.github.io/catalog/)
