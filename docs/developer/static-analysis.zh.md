# 静态分析

[English](static-analysis.en.md) | **[中文](static-analysis.zh.md)**

本应用中配置的所有静态分析工具及其使用方法。

## 快速参考

| 工具           | 用途                       | 命令                           | 在 check:all 中 |
| -------------- | -------------------------- | ------------------------------ | --------------- |
| TypeScript     | 类型检查                   | `npm run typecheck`            | 是              |
| ESLint         | 语法、风格、TS 规则        | `npm run lint`                 | 是              |
| cspell         | 拼写检查                   | `npm run cspell:check`         | 是              |
| Prettier       | 代码格式化                 | `npm run format:check`         | 是              |
| ast-grep       | 架构模式                   | `npm run ast:lint`             | 是              |
| i18n check     | 提取漂移 + 键同步          | `npm run i18n:check`           | 是              |
| React Compiler | 自动 memoization           | 构建时                         | 是              |
| cargo fmt      | Rust 格式化                | `npm run rust:fmt:check`       | 是              |
| clippy         | Rust lint                  | `npm run rust:clippy`          | 是              |
| cargo-machete  | Rust 未使用依赖            | `npm run rust:machete`         | 是              |
| Vitest         | 前端测试                   | `npm run test:run`             | 是              |
| cargo test     | Rust 测试                  | `npm run rust:test`            | 是              |
| 门禁自测       | 自建守卫自身的测试         | `npm run test:scripts`         | 是              |
| 规则契约       | 每条 ast-grep 规则仍咬得住 | `npm run test:scripts`         | 是              |
| 包体积预算     | 产物体积与 source map      | `npm run bundle:check`         | 是              |
| 启动预算       | 生产产物的时序             | `npm run e2e:startup`          | CI 必需检查     |
| Playwright E2E | 97 条走 mock 的 UI 流程    | `npm run e2e`                  | CI 必需检查     |
| npm audit      | 依赖漏洞                   | `node scripts/check-audit.mjs` | 仅 CI           |
| knip           | 未使用代码检测             | `npm run knip`                 | 否              |
| jscpd          | 重复代码检测               | `npm run jscpd`                | 否              |

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

**扫描全绿并不证明规则还有效。** `ast-grep scan` 报 0 条命中，与一条已经不再匹配的
规则看起来完全一样：CLI 升级、规则被改过、或者 `files:` 通配已经覆盖不到它本该管的
目录。`scripts/lib/ast-grep-contracts.mjs` 为每条规则钉住一段必须命中的反例与一段
必须不命中的正例，然后用真实二进制各扫一遍，断言反例树里每条规则恰好命中一次、正例
树里一次都不命中。新增规则却不写契约会让 `npm run test:scripts` 直接失败——这就是
防止这套契约悄悄缩水的那道闸。每对 fixture 要声明自己靠哪个维度区分：
`hooks-in-hooks-dir` 这类"作用域规则"用 `path`（它管的就是目录，两段代码故意相同），
`no-store-subscription-in-lib` 这类语法规则用 `code`。fixture 只在
`node_modules/.cache` 下临时生成、跑完即删，所以故意写坏的反例永远不会进工作区。

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

### Playwright E2E——是必需检查，但不进 `check:all`（刻意为之）

```bash
npm run e2e    # 单 worker，约 4.5 分钟，需要先 `npx playwright install chromium`
```

`E2E Tests` 是本分支的必需状态检查之一，所以无论你的 pre-push 钩子有没有跑它，一条坏掉的 UI 流程都会挡住合并。把它放进 `check:all`，换来的是更早的反馈，代价是每次推送多约 4.5 分钟，外加每个新 clone 都必须装好 Playwright 浏览器——而一个"第一次 `git push` 因为机器没有 Chromium 而失败"的模板，第一小时体验是坏的。发版前、或改动用户流程后，手动跑一次即可。

一处不显然的设置：`playwright.config.ts` 里的 `workers: 1`，本地也一样。在 Windows 开发机上实测：按 Playwright 默认的并行度（逻辑核心数的一半），97 条里有 2 条卡在 10 秒 `expect` 超时——因为这些首次页面加载全部打到同一个 Vite 开发服务器上，而它是按需编译模块图的；这两条单独整文件跑时都能过。CI 本来就用单 worker，所以这一改是让本地与 CI 判定同一件事，而不是各说各话。

但它**没有**让这套用例变确定，而如实记录比圆场的故事重要：`advanced-pane.spec.ts:184`（"API config form submit with valid data shows success toast"）在单 worker 下独立重跑 3 次红了 1 次，一次完整单 worker 全量跑里也红了 1 次。它的失败形态是：用例第一次 `fill` 之前就已经有一次指向根 URL 的导航在飞，所以那次重载不是提交表单造成的——react-hook-form 的 `handleSubmit` 确实会 `preventDefault`，偏好设置组件树里也只有唯一一个 `<form>`。它在 CI 里能变绿，只是因为 `retries: 2` 把它吸收了。真要处理这条，起点应该是"谁触发了导航"，而不是提交处理器。

### E2E 这套体系覆盖不到的东西

这 97 条 Playwright 用例跑在 Vite 开发服务器上，IPC 层是 mock 的
（`e2e/mocks/tauri-mock.ts`，由 `addInitScript` 注入），从不启动 Rust 进程。因此它们验证的是
"前端在 IPC 契约下的行为"，对原生窗口、托盘、全局快捷键、NSPanel 层级、安装包
不做任何证明。那部分依赖 423 个 Rust 测试，加上 `Build (<平台>)` 里的编译检查——该作业现在
还会断言确实产出了 release 二进制，并把体积记进 job summary。

生产产物有一条时序门禁：`npm run e2e:startup` 用 `vite preview` 服务 `dist/`，断言
首次内容绘制与 React 挂载的预算（`e2e/startup-budget.spec.ts`）。之所以不去量开发
服务器，是因为那测到的是 Vite 的按需转译，而不是用户真正装到机器上的东西。它仍然跑在
mock IPC 的 Chromium 里，所以对进程启动与原生 webview 不做任何证明。

真壳驱动的冒烟测试考虑过，但不列入计划：`tauri-driver` 只支持 Windows 与 Linux，
上游文档明确写着 macOS 没有可用的 WKWebView 驱动工具。一个无法覆盖本模板三个交付平台中
之一的"桌面冒烟"，其声称的覆盖面本身就是虚构的。所以诚实的做法是留下那条二进制断言，
并在这个位置把缺口写清楚，而不是拿它遮掩过去。

## CI 集成

`check:all` 在 CI 中运行。推送前确保本地通过：

```bash
npm run check:all
```

## 添加新规则

**ESLint**：在 `eslint.config.js` 中添加规则

**ast-grep**：在 `.ast-grep/rules/` 中创建 YAML 文件；规则语法请参考 AST-grep 官方文档。

**Prettier**：修改 `prettier.config.js`
