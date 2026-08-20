# 对话记录：精简项目文档

- **日期**: 2026-08-20
- **主题**: 精简文档，只保留必要的；先做"精简"、后再考虑接入自动化维护工具
- **触发问题**: 用户反馈"文档太多，维护太麻烦，也没有自动化维护文档的工具，精简下吧，只留下必要的"

## 一、前置调研：自动化文档维护工具（本轮先不落地）

深度调研后按三类归纳：

1. **自动生成**: TypeDoc / typedoc-plugin-markdown（TS→Markdown API 文档）、rustdoc（Rust 内置）、
   git-cliff（本仓库已在用，生成 CHANGELOG）。
2. **自动检查**: markdownlint / markdownlint-cli2（格式一致性）、lychee + lychee-action（坏链/
   外部 URL）、doc-freshness-checker（文档引用 vs 源码/manifest 漂移）、加一条自定义 en/zh 配对 CI。
3. **自动维护(改)**: Mintlify Workflows（读 diff 自动开文档更新 PR）、checkmark（AI review/compose）。

结论：自动化是"护城河"不是"减负药"——文档多的根因是主题拆得太细，应先精简再上检查类工具。

## 二、精简决策与执行

关键发现：developer 文档是**高度互联的网**（architecture-guide 大量引用子文档，
error-handling 引用 logging/observability），所以精简必须连链接一起处理，否则会制造坏链/孤儿。

### 保留（受 AGENTS.md 引用 + 项目旗舰，中英成对共 16 个文件）
README、architecture-guide、state-management、error-handling、tauri-commands、
static-analysis、i18n-patterns、releases。

### 删除（过度细分的其余 19 个主题、38 个文件，可从 git 历史恢复）
command-system、keyboard-shortcuts、menus、quick-panes、ui-patterns、notifications、
cross-platform、data-persistence、external-apis、logging、observability、testing、
bundle-optimization、writing-ast-grep-rules、writing-docs、code-signing、tauri-plugins、
rust-architecture、vscode-setup。

### 相应链接修复（保留文档内指向已删文档的链接全部清理）
- `architecture-guide`：命令系统链接改指 tauri-commands；重写"核心系统"表；
  quick-panes / external-apis / data-persistence / testing 引用改写为无死链的说明。
- `error-handling`：移除对 logging / observability 的"See also"引用。
- `static-analysis`：writing-ast-grep-rules 引用改写为指向仓库内 `.ast-grep/rules/`。

### 索引重写
- `docs/developer/README.en/.zh`：收敛为 7 个核心文档的单一表格。
- `docs/README.en/.zh`：修正为准确索引（原先列了空目录 tasks-done/tasks-todo，
  且未提 conversations/、tasks.md 等）。

## 三、验证结果
- 全仓 **0 处坏链**；
- developer 精简为 8 个主题、全部中英成对；
- 被删除主题均可从 git 历史恢复；
- prettier 对改动文档规范化，CI 格式门禁不受影响；
- AGENTS.md 引用的文档（architecture-guide / static-analysis / tauri-commands /
  i18n-patterns / developer README / tasks）全部仍在。

## 四、后续
- 可按需把 lychee + en/zh 配对校验 + markdownlint 接入 CI，作为自动化护城河。
- 根 README 命名不一致（英文即 README.md、无 README.en.md）为既有约定，本次未改动。