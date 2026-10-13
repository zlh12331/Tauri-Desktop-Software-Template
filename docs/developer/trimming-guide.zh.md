# 裁剪本模板

[English](trimming-guide.en.md) | **[中文](trimming-guide.zh.md)**

本模板发货的是一个能用的产品，不是一个空窗口。`src-tauri/src` 有 5,808 行 Rust，
`src/` 有 10,090 行 TypeScript，其中大部分属于你可能不想要的功能：快速录入面板、
带同意闸门的崩溃上报、托盘图标、紧急恢复文件、自动更新。

衡量模板的标准是 fork 者多快能让它变成自己的应用。本文的目标是
**从 clone 到"空、绿、小"的应用 30 分钟**——"绿"指 `npm run check:all` 通过，
"小"指 [静态分析](./static-analysis.zh.md) 里的体积预算。

下面每份文件清单都由当前代码树的 grep 生成，且每节结尾都给出"如何确认你拆干净了"
的命令。**请以命令为准，不要以清单为准**：清单会随模板演进过期，grep 不会。

## 流程：每个功能都是同七处

本模板里任何功能都固定占据这七层。拆除意味着七处都要动，且按这个顺序：

| # | 层 | 位置 | 如何找到其余 |
| - | - - | - - | - - |
| 1 | Rust 命令模块 | `src-tauri/src/commands/<name>.rs` | — |
| 2 | 模块声明 | `src-tauri/src/commands/mod.rs` | `grep -n "<name>" src-tauri/src/commands/mod.rs` |
| 3 | IPC 注册 | `src-tauri/src/bindings.rs`：第 4 行的 `use` 与 `collect_commands!` 列表 | `grep -n "<name>::" src-tauri/src/bindings.rs` |
| 4 | 启动装配 | `src-tauri/src/lib.rs`：插件注册、`setup`、事件循环 | `grep -n "<name>\|init_" src-tauri/src/lib.rs` |
| 5 | 类型与偏好 | `src-tauri/src/types.rs`（含 `AppPreferences` 字段） | `grep -n "<Field>" src-tauri/src/types.rs` |
| 6 | 前端 | 组件、hooks、store，以及 `App.tsx` / `MainWindow.tsx` 里的渲染点 | `grep -rn "<PascalCase>" src/` |
| 7 | 契约与文案 | `src/lib/bindings.ts`（重新生成，绝不手改）、`locales/*.json`、测试 | `npm run rust:bindings` |

然后按此顺序验证，因为每一步报出的错，都是上一步没拆完：

```bash
npm run rust:bindings            # 先重新生成类型契约
cd src-tauri && cargo test       # Rust：悬空引用与失效测试
npm run check:all                # 完整 JS + Rust 门禁
npm run knip                     # 残留的导出、文件与依赖
node scripts/check-bundle.mjs    # 按你的应用重设体积预算
```

`cargo test` 是承力的那一步。`bindings.rs` 逐条点名每个命令，所以"模块删了但注册
没删"会是编译错误，而不是运行时的谜。

本仓库特有的两个坑：

- **`npm run rust:bindings` 必须早于 `check:all`。** CI 里的绑定漂移守卫会重新生成
  `src/lib/bindings.ts` 并对任何差异报错，于是一份过期文件让 `Code Quality` 变红；
  而 `e2e` 与所有平台构建都 `needs: quality`，这一个文件就能跳过整个矩阵。
- **`knip` 在你把它变成决定之前只是建议。** 它报告未被使用的导出与依赖；拆一半
  的功能几乎总会同时留下两者。拆完务必跑，并去读输出，而不是相信自己写的清单。

## 功能对照表

每个可拆功能的实测触点。"命令"指 `bindings.rs` 中归属于它的条目。

| 功能 | Rust | 前端 | 其他触点 |
| - - - | - - - | - - - | - - - |
| 快速面板 | `commands/quick_pane.rs`（545 行，5 条命令） | `quick-pane.html`、`src/quick-pane-main.tsx`、`src/quick-pane.css`、`components/quick-pane/` | `capabilities/quick-pane.json`、`vite.config.ts:73-78` 第二入口、`hooks/useMainWindowEventListeners.ts`、`preferences/panes/GeneralPane.tsx:36-73`、`locales` 的 `quickPane.*`、`e2e/quick-pane-event.spec.ts`、`types.rs:11` 默认快捷键、`lib.rs` 的 window-state denylist |
| 崩溃上报 + Sentry | `commands/crash_report.rs`（1,152 行，3 条命令）、`lib.rs` setup 里的 `setup_panic_hook` 调用——**不含** `utils/redact.rs`，它同时被日志格式化使用 | `components/crash-report/`、`hooks/use-crash-reporting.ts`、`store/crash-report-store.ts`、`lib/sentry.ts`、`lib/redact.ts`、`main.tsx:13` 与 `quick-pane-main.tsx:11` 的 `initSentry()`、`App.tsx:79` 调用与 `App.tsx:21` 调试面板、`MainWindow.tsx:15,142` | `preferences/panes/AdvancedPane.tsx` 同意开关、`locales` 的 `crashReport.*`、`e2e/crash-report*.spec.ts`、`src-tauri/tests/crash_report_integration.rs`、npm 与 cargo 两侧 Sentry 依赖 |
| 托盘 | `commands/tray.rs`（377 行，2 条命令）、`lib.rs` setup 里的 `init_tray` 调用 | 无 | `lib.rs` 里"关窗即隐藏"的 `CloseRequested` 处理、`locales` 的 `menu.*`、`src-tauri/tests/tray_integration.rs` |
| 恢复文件 | `commands/recovery.rs`（962 行，3 条命令） | `lib/recovery.ts`，被 `components/ErrorBoundary.tsx` 调用 | `locales` 的 `errorBoundary.*`、`types.rs` 的 `RecoveryError` |
| 自动更新 | `lib.rs` 的插件注册、`desktop.json` capability | `lib/updater.ts`、`hooks/use-auto-updater.ts`、`App.tsx:80`、`lib/menu.ts:169`、`lib/commands/app-commands.ts` | `tauri.conf.json` 的 `plugins.updater` 与 `bundle.createUpdaterArtifacts`、`.github/workflows/release-v2.yml`、`docs/developer/releases.*.md` |
| 深链 | `lib.rs` 的插件与 `:297-316` 的 `register_all` | `hooks/use-deep-link.ts`、`App.tsx:78` | `tauri.conf.json` 的 `plugins.deep-link`、`lib/commands/*` 的路由目标 |
| 通知 | `commands/notifications.rs`（1 条命令） | `lib/notifications.ts`、`lib/commands/notification-commands.ts` | 部分 `locales` 的 `toast.*` |
| HTTP 客户端 | `lib.rs` 里的 `tauri_plugin_http::init()` 调用 | 无——`src/` 里没有任何 `fetch()` | 已从 `capabilities/default.json` 撤权，详见[架构指南](./architecture-guide.zh.md) |

**骨架不要拆。** `lib/bindings.ts`、`lib/tauri-bindings.ts`、
`lib/commands/registry.ts`、与 Rust `error.rs` 镜像的类型、`lib/logger.ts`、
`store/ui-store.ts`、`capabilities/` 的分权，以及全部 `.ast-grep` 规则——这些正是
"其余部分可以放心移动"的前提。拆掉它们，模板就退化成一堆示例文件。

## 配方：拆掉快速面板

对最小应用而言单步收益最大的一项——它同时消掉一整个 WebView 入口和一个常驻隐藏窗。

1. 删 `src-tauri/src/commands/quick_pane.rs`；从 `commands/mod.rs` 以及
   `bindings.rs` 的 `use` 与 `collect_commands!`（5 条）中移除。
2. `lib.rs` 中删 `init_quick_pane`（setup 内）、解析快速面板加速键的那段全局快捷键
   注册，以及 window-state 插件 `denylist` 里的 `"quick-pane"` 项。若再没有需要
   "不恢复状态"的窗口，denylist 就变空——插件留着，列表删掉。
3. `types.rs`：`DEFAULT_QUICK_PANE_SHORTCUT` 与 `AppPreferences.quick_pane_shortcut`
   字段。删偏好字段是契约变更：`save_preferences` 的校验与 `GeneralPane.tsx` 都引用它。
4. 前端：`quick-pane.html`、`src/quick-pane-main.tsx`、`src/quick-pane.css`、
   `src/components/quick-pane/`、`useMainWindowEventListeners.ts` 里的
   `quick-pane-submit` 监听、`GeneralPane.tsx` 的加速键选择器、`e2e/quick-pane-event.spec.ts`。
5. `vite.config.ts`：构建有两个 input，删掉 `'quick-pane'` 那一项。
   `check-bundle.mjs` 的 `quickPaneJsGzip` 预算随即失去对象，因此把这条预算键也删掉——
   `findBudgetBreaches` 对"有预算却无对应度量"是故意抛错的。
6. `src-tauri/capabilities/quick-pane.json`：删文件。没有任何东西引用它，
   Tauri 靠目录扫描发现 capability。
7. 文案：两份 `locales/*.json` 里的 `quickPane.*`，然后 `npm run i18n:check`——
   `i18next-cli status` 会报悬空的 `t()` 引用，这正是你找出漏掉的 UI 路径的手段。
8. `npm run rust:bindings && cd src-tauri && cargo test && npm run check:all`。

**然后决定 `tauri.conf.json:36` 的 `app.macOSPrivateApi`。** 需要它的透明窗口就是
快速面板。如果你的应用没有其他透明窗或 NSPanel，关掉它能去掉一项阻碍 Mac App Store
上架的开关，`tauri-nspanel`（`Cargo.toml` 里按 Git 来源引入、在 `deny.toml` 中按名
放行的 crate）也可一并移除。这是 fork 能做的最大一处合规简化。

## 配方：拆掉崩溃上报与 Sentry

两半相互独立，但要么都拆、要么都留，否则你会发一个"有同意弹窗却没有同意状态"的应用。

- **Rust**：`commands/crash_report.rs`（3 条命令）及其在 `mod.rs` / `bindings.rs`
  的行；`lib.rs` 的 `setup_panic_hook` 与 `init_consent_from_preferences`；
  Sentry 初始化块内基于 `CONSENT_STATE` 的门控；`types.rs` 的
  `crash_reporting_consent` 字段。
- **前端**：`lib/sentry.ts`、`lib/redact.ts`、`hooks/use-crash-reporting.ts`、
  `store/crash-report-store.ts`（第四个也是最后一个 store）、
  `components/crash-report/`、`MainWindow.tsx:142` 的渲染、`App.tsx:79` 的调用与
  `App.tsx:21,127` 的调试面板、两个入口里的 `initSentry()`、`AdvancedPane.tsx`
  的同意开关、`e2e/crash-report.spec.ts` 与 `e2e/crash-report-details.spec.ts`。
- **依赖**：`@sentry/*` npm 包与 cargo 侧对应依赖，以及 `vite.config.ts:43-63` 的
  `sentryVitePlugin` 块。注意该块同时负责上传后删除 source map——若你用别的方式保证
  手图不进产物，请把 `check-bundle.mjs` 的 map 残留检查留下。
- **`utils/redact.rs` 留下。** 它现在有第二个调用方：`lib.rs` 里的日志格式化器会通过
  `render_log_line()` 在写往任何目标（stdout、`LogDir`、Console.app）之前脱敏每一行。
  把它当作本配方的附属品删掉是编译错误，不是清理——一个曾经看着像崩溃上报死代码的
  模块，如今承着 Rust 侧的隐私责任。
- **`ErrorBoundary.tsx` 留下。** 它是 React 错误边界，不是崩溃上报器：它捕获渲染失败，
  调用 `logger` 与 `saveCrashState()`。如果你连恢复文件一起拆，它需要一个降级形态
  （只保留重载按钮）。

拆 Sentry 是字节收益最大的一刀：崩溃上报相邻代码是产物里最大的单个 chunk——撰写时
实测 261,923 / 397,430 gzip 字节，即你交付的全部 JS 的 66%。拆了就要重设预算。

## 配方：拆掉托盘

`commands/tray.rs` 与 `lib.rs` 的 `init_tray`，外加 `lib.rs` 里的 `CloseRequested`
处理——正是那段让"关窗口"变成隐藏而不是退出。删掉它之后，关闭最后一个窗口就会终止
进程，这其实是多数人想要的，而模板默认并非如此。`src-tauri/tests/tray_integration.rs`
一并删除。

注意：两条托盘命令（`set_tray_icon_state`、`move_window_to_tray`）今天在 `src/` 里
**没有任何调用方**。

## 没人调用的命令

`removeUnusedCommands: true`（`tauri.conf.json:7`）会剥离前端未引用的命令，所以它们
消耗的是二进制字节而非前端包字节；但类型契约面与阅读注意力照旧被占用。

| 命令 | 模块 | 说明 |
| - - | - - - | - - - |
| `greet` | `preferences.rs` | Tauri 教程示例，最该先删的一个 |
| `show_quick_pane`、`toggle_quick_pane` | `quick_pane.rs` | Rust 的快捷键回调直接驱动窗口 |
| `set_tray_icon_state`、`move_window_to_tray` | `tray.rs` | 前端无调用方 |

重新检出它们，用下面这段——它是 Node 而非 shell，所以 Windows、macOS、Linux
行为一致：

```bash
node -e "
const fs = require('fs')
const src = fs.readFileSync('src/lib/bindings.ts', 'utf8')
const names = [...src.matchAll(/^\s+([A-Za-z][A-Za-z0-9]*):\s*\(/gm)].map(m => m[1])
const files = []
const walk = d =>
  fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const p = d + '/' + e.name
    if (e.isDirectory()) walk(p)
    else if (/\.(ts|tsx)$/.test(e.name) && !/bindings\.ts$/.test(p) && !/\.test\./.test(p)) files.push(p)
  })
walk('src')
const all = files.map(f => fs.readFileSync(f, 'utf8')).join('')
console.log(names.filter(n => !all.includes('commands.' + n)))
"
```

撰写时它从 17 条命令里报出 `greet`、`showQuickPane`、`toggleQuickPane`、
`setTrayIconState`、`moveWindowToTray`。

## 拆完之后，门禁会故意报错

三个写进仓库的数字描述的是*本模板*的应用，因此必须改成你的——它们都选择大声失败
而不是静默放行，这正是设计意图：

- `scripts/lib/bundle-metrics.mjs` 的预算，基线写在注释里。
- `scripts/check-coverage.mjs` 的地板（97.07 / 92.84）与 `vitest.config.ts` 的阈值：
  删掉已测试的功能会让覆盖率依然很高，但它衡量的东西变了。
- `package.json` 里 `readme:check --frontend/--rust/--e2e` 的数字，以及写进
  `README.md` / `README.zh.md` / `CONTRIBUTING*` 的每个测试数——该门禁拿真实文件计数
  与它们比对，所以删了测试它就会告诉你。

另外记得改 `.github/CODEOWNERS` 与远端的必需检查：这两处被"错了也不报错"的失效形状
详细描述在[使用本模板](../USING_THIS_TEMPLATE.zh.md)里。
