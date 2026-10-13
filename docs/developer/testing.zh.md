# 测试

**[English](testing.en.md)** | [中文](testing.zh.md)

每一层测试各自证明什么、它们分别在哪里运行，以及 CI 盯着的覆盖率登记表。

## 五层测试

| 层级     | 命令                   | 数量 | 证明的内容                                               |
| -------- | ---------------------- | ---- | -------------------------------------------------------- |
| 前端单测 | `npm run test:run`     | 1022 | 纯逻辑、hooks、mock Tauri 运行时下的组件行为             |
| Rust     | `npm run rust:test`    | 423  | 命令、错误映射、文件 IO——单测加 `tests/*_integration.rs` |
| E2E      | `npm run e2e`          | 97   | 真实 Chromium 对 dev server + mock IPC，含无障碍审计     |
| 门禁自测 | `npm run test:scripts` | 70   | 质量门自身：不会失败的门禁就是 bug                       |
| 启动预算 | `npm run e2e:startup`  | 1    | 生产产物的绘制与挂载在预算内                             |

业务逻辑刻意分三层测——纯函数、mock 运行时、集成。因为行为真正分叉的地方就是 Tauri
边界：同一个 `invoke` 在 jsdom 里、在 mock 掉 `__TAURI_INTERNALS__` 的 Chromium
里、以及真壳里，表现并不一样。

## 跑子集

```bash
npm run test:run src/lib/logger.test.ts      # 单个文件
npm run test:run -- -t "redact"             # 按测试名
npm run rust:test                            # 全部 Rust 测试（在 src-tauri 下）
npm run e2e -- e2e/app-launch.spec.ts       # 单个 spec
```

## 每道门实际在哪里跑

`npm run check:all` 覆盖 typecheck、lint、cspell、ast-grep、格式、i18n、版本一致性、
Rust fmt/clippy/machete、build、包体积预算、门禁自测、前端单测、Rust 测试。下面三项
**不在其中**：

| 检查                    | 在哪跑      | 不知道的代价                |
| ----------------------- | ----------- | --------------------------- |
| `npm run test:coverage` | 仅 CI       | 覆盖率回退本地全绿，CI 才红 |
| `npm run e2e`           | 仅 CI       | UI 回归能通过 `check:all`   |
| `npm run readme:check`  | CI 文档作业 | 文档里的测试计数悄悄过期    |

发布前请手动跑一次 `npm run test:coverage`。

## 覆盖率豁免登记表

下面是 `scripts/check-coverage.mjs` 断言的下限——跌破就让 CI 失败，要改必须在这个文件
里给出证据，而不是改常量：

- 语句：97.07%
- 分支：92.84%

全量覆盖率：语句 97.79% / 分支 94.34% / 函数 97.28% / 行 99.51%

上一行由 `node scripts/check-coverage.mjs`（不带 `--check-only`）自动重写，不要手改。

逐条豁免位置，同一个脚本会校验它们确实还存在：

| 位置                 | 理由                            |
| -------------------- | ------------------------------- |
| `GeneralPane.tsx:42` | UI 无法产生的状态，属防御性分支 |

完全不计入统计（`vitest.config.ts` → `coverage.exclude`）：自动生成的
`src/lib/bindings.ts`、入口文件、`src/components/ui/**` 下的 shadcn/ui 包装组件，以及
`src/lib/app-reload.ts`——它只有一行浏览器导航，调用方通过模块 mock 覆盖；任何测试
realm 都不允许替换它包装的那个 unforgeable 的 `window.location`。

## 测试环境说明

Vitest 使用 `pool: 'vmThreads'`。不开启时 58 个测试文件会创建 58 个 jsdom 环境，实测
占掉整套用例时间的 65%——那时一条断言都还没跑。代价是真实的、且只咬了一次：在 VM
上下文里 `window` 与 `window.location` 都不可配置，所以测试不能再 `defineProperty`
覆盖它们。要拦截浏览器副作用，就把它做成模块然后用 `vi.mock`——错误边界测试对
recovery、Sentry、logger 早就是这么做的。

`isolate: false` 在这里不可用：一旦跨文件共享模块状态，179 个测试失败，因为 i18n 单例
和 Zustand store 会互相泄漏。

E2E 固定单 worker。Playwright 默认的并行度在一台按需编译模块图的 dev server 上，会让
97 个用例里的 2 个撞上 10 秒超时。

## 增加测试

- 有分量的业务逻辑要有单测；跨 IPC 的东西在 mock 运行时层再测一遍。
- 新的质量门禁脚本必须配一个同目录的 `*.test.mjs`——门禁靠这个证明自己会失败。
  `scripts/run-gate-tests.mjs` 负责发现它们，找不到任何用例就退出 1，所以改个名字
  没法悄悄把套件清空。
- 架构规则由 ast-grep 契约套件覆盖（`scripts/lib/ast-grep-contracts.mjs`）：新增一条
  规则却没有反例与正例 fixture，`npm run test:scripts` 就会红。详见
  [静态分析](static-analysis.zh.md)。
