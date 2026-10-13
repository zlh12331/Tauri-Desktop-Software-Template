# 静态分析

[English](static-analysis.en.md) | **[中文](static-analysis.zh.md)**

本应用中配置的所有静态分析工具及其使用方法。

## 快速参考

| 工具           | 用途                  | 命令                           | 在 check:all 中 |
| -------------- | --------------------- | ------------------------------ | --------------- |
| TypeScript     | 类型检查              | `npm run typecheck`            | 是              |
| ESLint         | 语法、风格、TS 规则   | `npm run lint`                 | 是              |
| cspell         | 拼写检查              | `npm run cspell:check`         | 是              |
| Prettier       | 代码格式化            | `npm run format:check`         | 是              |
| ast-grep       | 架构模式              | `npm run ast:lint`             | 是              |
| i18n check     | 提取漂移 + 键同步     | `npm run i18n:check`           | 是              |
| React Compiler | 自动 memoization      | 构建时                         | 是              |
| cargo fmt      | Rust 格式化           | `npm run rust:fmt:check`       | 是              |
| clippy         | Rust lint             | `npm run rust:clippy`          | 是              |
| cargo-machete  | Rust 未使用依赖       | `npm run rust:machete`         | 是              |
| Vitest         | 前端测试              | `npm run test:run`             | 是              |
| cargo test     | Rust 测试             | `npm run rust:test`            | 是              |
| 门禁自测       | 自建守卫自身的测试    | `npm run test:scripts`         | 是              |
| 包体积预算     | 产物体积与 source map | `npm run bundle:check`         | 是              |
| npm audit      | 依赖漏洞              | `node scripts/check-audit.mjs` | 仅 CI           |
| knip           | 未使用代码检测        | `npm run knip`                 | 否              |
| jscpd          | 重复代码检测          | `npm run jscpd`                | 否              |

CI 额外运行 [actionlint](https://github.com/rhysd/actionlint) 检查所有 GitHub Actions workflow，以及 [gitleaks](https://github.com/gitleaks/gitleaks) 密钥扫描。

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

**有意钉住的版本（不要再抬）：**

- `brace-expansion` 只在真正需要它的那个子树里留在 1.x 线上。`package.json` 把它在
  `eslint-plugin-react → minimatch` 这一子树内 override 成 `^1.1.18`。1.x 的上限不是我们
  定的：`minimatch@3.1.5` 自己声明的是 `brace-expansion@^1.1.7`，所以 5.x 永远不可能在该
  子树内解析出来。caret 仍然浮动，因此该子树照旧接收 1.x 的补丁（实装 `1.1.21`）——这条
  override 抬的是下限，不是把版本冻住。没有任何东西被它拖住——`glob`、`i18next-cli`、
  `@typescript-eslint/typescript-estree` 各自在自己嵌套的 `minimatch@10.2.6` 下解析到
  `brace-expansion@5.0.12`。这里刻意不再保留直接的 `brace-expansion` 依赖：起作用的只有
  override 本身，多一条直接依赖只会让 `npm outdated` 和 Dependabot 报出一个被钉住的子树
  根本无法接受的 `1.1.21 → 5.0.12` 升级。只有当 `eslint-plugin-react` 不再依赖
  `minimatch@3` 时才需要重新评估，届时删掉这条 override。
- `jsdom` 留在 29.x 是另一个原因：jsdom 30 下，同一个测试文件里后面的用例无法再次打开 Radix
  Select。见 `src/test/setup.ts` 顶部的说明。

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

自定义 ast-grep 规则以 YAML 文件形式编写在 `.ast-grep/rules/` 中；规则语法请参考 AST-grep 官方文档。

### React Compiler

在构建时自动处理 memoization。你**不需要**手动添加：

- `useMemo` 用于计算值
- `useCallback` 用于函数引用
- `React.memo` 用于组件

编译器分析代码并在有益的地方添加 memoization。

**注意**：`getState()` 模式仍然关键 - 它避免的是 store 订阅，而非 memoization。参见 [state-management.zh.md](./state-management.zh.md)。

### 包体积预算

```bash
npm run build         # 产出 dist/ —— 检查读取它，自身不构建
npm run bundle:check
```

`scripts/check-bundle.mjs` 给应用交付的体积设上限，口径是 `dist/assets` 的 gzip。五条预算都在 `scripts/lib/bundle-metrics.mjs`，各自紧挨着推导它的基线值：

| 预算               | 度量对象                                                 |
| ------------------ | -------------------------------------------------------- |
| `jsGzip`           | 主窗口要解析的全部 JS 字节                               |
| `cssGzip`          | Tailwind 产物加组件 CSS                                  |
| `largestChunkGzip` | 最大的单个 chunk，让新增的重依赖无法藏在一行 lockfile 里 |
| `quickPaneJsGzip`  | 常驻隐藏窗口——从不使用它的用户也在为它付费               |
| `distGzipTotal`    | Tauri 嵌入二进制的全部 Web 资源                          |

这个门禁有三处是刻意设计的：

- **空 `dist` 不可能通过。** `measure([])` 对每条预算都是 0，所以 `isDistPopulated()` 单独检查，且 `dist/assets` 不存在时 CLI 直接拒绝运行。把"什么都没测到"读成"什么都没超标"，和覆盖率报表里没有任何语句是同一种失效形状。
- **React Compiler 用产物验证，而不是用配置验证。** `@rolldown/plugin-babel` 无论插件能否解析都会接受该 preset——构建成功，然后悄悄不再 memoize。编译器会产出 `Symbol.for('react.memo_cache_sentinel')`，而 `Symbol.for` 字符串能活过压缩，所以门禁直接在构建产物里数它。命中数为 0 判失败；远低于基线则告警。
- **`dist/` 里出现 source map 判失败。** `frontendDist` 下的每个文件都被嵌进可执行文件，所以一张残留的 `.map` 会发给每一个用户。`vite.config.ts` 只在同一次构建能把手图交给 Sentry 时才生成，这个检查就是确认该性质仍然成立。

预算只能向上调整，且必须在改动里说明理由——每个数字上方的基线注释就是评审面。`vite.config.ts` 里的 `build.chunkSizeWarningLimit: 600` 是 Vite 的告警阈值，不是预算：它是为了适配当时已存在的组件而被抬高的，而"把上限调到刚好放过现状"不构成约束。

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

### npm audit（仅 CI）

不在 `check:all` 中，因为审计接口由 npm 源站提供：镜像源不代理它时，这条命令在一台本身没问题的机器上就会报错。CI 直接对公共源站运行它。

```bash
node scripts/check-audit.mjs --registry=https://registry.npmjs.org
```

这个脚本取代裸的 `npm audit --audit-level=high`。部分公告还没有修复版本，而 npm 会把依赖它的每个包都标成同等严重，于是一个无法修补的传递依赖会让整条链变红。脚本 `IGNORED` 数组里列出的公告被豁免，但严重度是按剩余成因重新计算的，所以一条豁免只能隐藏它点名的那条公告。这遵循与 `src-tauri/deny.toml` 中豁免相同的约定：写明理由、给出复查时间，上游一出修复就删掉。

### 门禁脚本自测

```bash
npm run test:scripts    # node --test scripts/
```

`scripts/` 下每个自建守卫都在决定一件没有人会再看一眼的事：哪些漏洞被豁免、覆盖率是否下滑、两份翻译目录是否还对齐。比较逻辑写坏的守卫不会报错——它会永远报成功，而这和"正常工作"看起来一模一样。

这不是假设。`check-audit.mjs` 的早期版本把每个包的严重级别与 `RANK['none']` 比较，而 `none` 没有等级，于是比较对象是 `undefined`，每个 `severity > worst` 判定都为 false。对任何输入它都退出 0，包括确实存在 high 级漏洞的依赖树。发现它的唯一办法是把反向用例写下来：清空豁免表后跑一次，断言它此时必须点出包名。

因此判定逻辑放在 `scripts/lib/*.mjs` 里，是纯函数；`scripts/lib/*.test.mjs` 用 Node 内置测试运行器覆盖它们——不需要访问 registry，也不需要先跑覆盖率。`check-coverage.mjs` 携带的是同一类问题的反向守卫：`pct()` 对空分母返回 100，所以 CLI 只要发现某个维度的总数为 0 就直接失败，而不是把"什么都没测到"读成"全覆盖"。

新增守卫时，请在同一次改动里补上它的反向测试。不会失败的测试不是门禁。

## CI 集成

`check:all` 在 CI 中运行。推送前确保本地通过：

```bash
npm run check:all
```

## 添加新规则

**ESLint**：在 `eslint.config.js` 中添加规则

**ast-grep**：在 `.ast-grep/rules/` 中创建 YAML 文件；规则语法请参考 AST-grep 官方文档。

**Prettier**：修改 `prettier.config.js`
