# 对话记录：接入文档自动化维护工具

- **日期**: 2026-08-20
- **主题**: 在精简后的文档基础上，接入轻量级文档自动化护栏
- **触发问题**: 用户问"你觉得需要加什么文档自动化工具"

## 一、推荐结论

基于上一轮调研（自动生成 / 自动检查 / 自动维护三类），文档已精简到 8 个主题、16 个文件，
靠人工即可维护，因此不上重型工具，只加"防回潮护栏"级的轻量检查。最终用户选择：**三项全加 + 独立 docs 检查 Job**。

## 二、落地的三个工具

1. **markdownlint（格式一致性）**：`.markdownlint-cli2.jsonc` 配置，`npm run docs:lint`。
   针对本项目关闭了与文档风格冲突的规则：行宽(MD013)、重复标题(MD024)、内联 HTML(MD033)、
   ASCII 图代码块语言(MD040)、首行为标题(MD041)、指定标题结构(MD043)、链接锚片段(MD051)。
   CHANGELOG.md 为 git-cliff 生成，不参与 lint。
2. **en/zh 双语配对 + 互链校验（自定义脚本）**：`scripts/check-doc-pairs.mjs`，`npm run docs:pairs`。
   遍历 `docs/` 下 `*.en.md` / `*.zh.md`，校验：a) 每个英文文档必须有同名中文文档（反之亦然）；
   b) 每个文档顶部的语言切换链接必须双向指向对方。会话记录（`conversations/`）为单语文档，跳过。
3. **lychee（外部链接可达性）**：`.lychee.toml` 配置，CI 用 `lycheeverse/lychee-action@v2`。
   扫描 `docs/**/*.md`、`README.md`、`README.zh.md`，排除 `conversations/**` 与 CHANGELOG，
   允许 localhost、mailto:、file:// 等非"网站"引用。

## 三、CI 接入

在 `.github/workflows/ci.yml` 中新增独立 `docs` Job（`runs-on: ubuntu-latest`），包含三个步骤：
`markdownlint` → `en/zh pair & cross-link check` → `URL link check (lychee)`。该 Job 无 `needs`
依赖，与其它质量门禁并行，失败会阻断合并，防止文档在精简后被悄然带偏。

## 四、本地校验结果

- `npm run docs:lint`：30 个文件，0 问题
- `npm run docs:pairs`：14 对英文/中文文档配对完整、互链双向正常
- `actionlint` 校验 ci.yml 无告警
- 新增文件均已通过 prettier 格式化；`lychee.toml` 加入 `.prettierignore`
- package.json 新增 `markdownlint-cli2` devDependency 及 `docs:*` 脚本