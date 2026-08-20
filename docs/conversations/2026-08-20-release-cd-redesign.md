# 对话记录：重设计 CD 发布流程（安装包命名 + 更新日志）

- **日期**: 2026-08-20
- **主题**: 针对用户反馈重新设计 CD 流程——安装包命名要区分 Windows/macOS/Linux，更新日志要重设计得干净
- **触发问题**: "这个CD流程我觉得有点问题，最后安装包的名字不对，你要有Windows/mac/linux的区分啊，还有更新日志也不对，更新日志太乱了，你得重新设计。"

## 一、现状分析

### 1. 安装包命名
发布流程原先用 `tauri-apps/tauri-action` 直接构建并发布，产物名是 Tauri 默认的
`{productName}_{version}_{arch}.{ext}`，例如：
- Windows: `Tauri-Desktop-Software-Template_0.1.0_x64_en-US.msi`
- macOS:   `Tauri-Desktop-Software-Template_0.1.0_aarch64.dmg`
- Linux:   `Tauri-Desktop-Software-Template_0.1.0_amd64.AppImage`

只能在格式后缀上区分平台，不够直观；且 GitHub Release 发布说明是三平台共用的泛化三行文字，
未按平台列出各自的安装包和具体下载链接。

### 2. 更新日志
仓库里已有一个 **`cliff.toml`**（git-cliff 优先读取的非隐藏配置），它把
`feat/fix/test/ci/build/chore` 全部分组、`filter_commits=false`，
导致 git-cliff 把**每条 commit 倾进 CHANGELOG**——CI 修来修去、测试批量提交、依赖升级全混在一起，非常乱。
（注意：当时误新建了 `.cliff.toml` 但被 git-cliff 忽略，因为 git-cliff 优先用 `cliff.toml`。）

## 二、设计决策（经用户确认）

咨询用户后确定两个方案（均为推荐项）：
1. **安装包/发布页**：重命名安装包为带平台前缀 + 同步更新 `latest.json`（自更新清单）。
2. **更新日志**：精简 Keep a Changelog 风格——新增配置只保留用户可感知的
   Feature / Fix / Refactoring & performance / Documentation，屏蔽 CI/测试/依赖等内部噪音。

## 三、改动清单

### 1. `cliff.toml`（重写）
- 采用 Keep a Changelog 精简模板（版本 → 语义分组 → 提交行）。
- `commit_parsers` 只保留：
  - `feat` → New features
  - `fix` → Bug fixes
  - `refactor|perf` → Refactoring & performance
  - `doc` → Documentation
  - 其余 `test/ci/build/chore/deps/revert/style/security` 以及未归类的 `.*` 全部 `skip = true`
- `filter_commits = true` 让命中 skip 的提交从输出中剔除。
- `filter_unconventional = true` 丢弃无 Conventional 前缀的提交。
- 破坏性变更用行内 `(breaking)` 标记，不单开章节。

### 2. `CHANGELOG.md`（用新配置重新生成）
从原来的 127 行（含 Testing/CI/Build/Miscellaneous/deps 噪音）精简为一屏内可读完的
干净日志，只含 New features / Bug fixes / Refactoring & performance / Documentation。

### 3. `scripts/release-assets.mjs`（新增）
一个脚本、两个子命令：
- **`rename <platform> <productName> <version>`**：递归扫描 `bundle/` 下该平台产物，
  重命名为 `{productName}-{platform}-{version}-{arch}.{ext}`（平台为
  Windows/macOS/Linux），安装包与其 `.sig` 一并改名，并写出 `rename-map.json`
  （旧名→新名映射，供 finalize 重建 latest.json）。
- **`finalize <artifactsDir> <tag> <owner> <repo> <productName> <version> <outDir> <changelogPath>`**：
  - 读取三平台各自自动生成的 `latest.json`，合并成**一份** `latest.json`，
    并把 url 中原来的文件名替换为重命名后的新名（否则自动更新会因找不到文件而失效）；
  - 若某平台读不到 latest.json，则回退用其"可更新产物"的 `.sig` 文件内容生成签名条目；
  - 生成按平台分组的发布说明 `release-body.md`，末尾附从 `CHANGELOG.md` 提取的本次版本日志。

> 关键点：Tauri 自更新的 `.sig` 是**对文件内容**签名、与文件名无关，所以重命名后签名仍有效；
> 但 `latest.json` 里 `url` 是文件名，必须同步改，这正是 `finalize` 要做的事。

### 4. `.github/workflows/release-v2.yml`（重构 build/发布分离）
不再用 tauri-action 直接发布，改为：
- **`publish-tauri`（三平台矩阵）**：`npm run tauri build --bundles ...` 直接构建 →
  `release-assets.cjs rename` 重命名 → `actions/upload-artifact` 上传为独立 Artifact。
- **`finalize`（新增汇合作业）**：等待三平台完成 → 下载产物 →
  `release-assets.cjs finalize` 重建 `latest.json` 与 `release-body.md` →
  `gh release create` 建草稿 → `gh release upload` 上传全部安装包/签名/`latest.json`。

这样发布说明由 finalize 一次性生成，避免 tauri-action 各平台互相覆盖 body。

## 四、验证

- `git-cliff` 重新生成 CHANGELOG，仅剩精简分组。
- `release-assets.cjs rename` 在合成 bundle 目录上验证：三平台产物 + `.sig` 均被正确重命名。
- `release-assets.cjs finalize` 在合成产物上验证：`latest.json` 合并出三条 platform，
  url 均指向重命名后的新文件；`release-body.md` 按 Windows/macOS/Linux 分组并附 changelog。
- `actionlint`（v1.7.12）校验 `release-v2.yml` 通过（exit 0，无告警）。

## 五、已知限制 / 后续

- 本仓库未配置 Apple 开发者证书，macOS 安装包为 ad-hoc（`signingIdentity:"-"`）签名，
  仅供内测；若要上架分发需另行配置 Apple 签名/公证。
- 下个版本发布时（打新 `v*` tag）将走新的命名与发布说明流程。