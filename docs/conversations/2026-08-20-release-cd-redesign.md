# 对话记录：重设计 CD 发布流程（安装包命名 + 更新日志）

- **日期**: 2026-08-20
- **主题**: 针对用户反馈重新设计 CD 流程——安装包命名要区分 Windows/macOS/Linux，更新日志要重设计得干净
- **触发问题**: "这个CD流程我觉得有点问题，最后安装包的名字不对，你要有Windows/mac/linux的区分啊，还有更新日志也不对，更新日志太乱了，你得重新设计。"

## 一、现状分析

### 1. 安装包命名

发布流程原先用 `tauri-apps/tauri-action` 直接构建并发布，产物名是 Tauri 默认的
`{productName}_{version}_{arch}.{ext}`，例如：

- Windows: `Tauri-Desktop-Software-Template_0.1.0_x64_en-US.msi`
- macOS: `Tauri-Desktop-Software-Template_0.1.0_aarch64.dmg`
- Linux: `Tauri-Desktop-Software-Template_0.1.0_amd64.AppImage`

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
- `release-assets.mjs rename` 在合成 bundle 目录上验证：三平台产物 + `.sig` 均被正确重命名。
- `release-assets.mjs finalize` 在合成产物上验证：`latest.json` 合并出三条 platform，
  url 均指向重命名后的新文件；`release-body.md` 按 Windows/macOS/Linux 分组并附 changelog。
- `actionlint`（v1.7.12）校验 `release-v2.yml` 通过（exit 0，无告警）。

## 五、真实验证（打 v0.1.1 tag）过程中发现并修复的集成问题

> 注意：`ghu_` 集成 token 无法触发 `workflow_dispatch`（HTTP 403），所以采用
> 直接打新 tag（`v0.1.1`）走 tag-push 的 `quality → build → finalize` 路径来验证。
> 该路径不跑 `bump-version`，需手动先 bump 三个版本号文件，创建 tag 后再
> `git-cliff -o` 生成 `[v0.1.1]` 段并提交，最后把 tag 移到含最终 CHANGELOG 的提交。

逐轮修复的问题（每轮经 CI 失败反馈定位）：

1. **ESLint 报 `require`/`console`/`process` undef**：仓库 eslint 按 ESM 处理脚本，
   `.cjs` 的 CommonJS 写法被判失败。→ 把脚本改成 ESM：`.cjs` → `.mjs`，
   `require()` → `import`。
2. **`npm run tauri build --bundles appimage` 参数被吞**：npm 会把 `--bundles appimage`
   当成 npm 自己的参数（`appimage` 变成裸位置参数），tauri 报
   `error: unexpected argument 'appimage'`。→ 必须用 `npm run tauri -- build ...`。
3. **Windows runner 默认 PowerShell，`\` 不是续行符**：rename 多行 + `\` 在 Windows 挂掉。
   → rename 命令改为单行（YAML `>-` 折叠块）。
4. **finalize `find -type f` 误把 macOS `.app` 应用包内部文件（png 图标/可执行文件）上传**：
   `gh release upload` 报 `HTTP 422 ... name already exists`（上传到 `xxx.png`）。
   → finalize 改为白名单 `isReleaseArtifact()`：只保留安装包（msi/dmg/AppImage/app.tar.gz…）
   及其 `.sig`，并让 `findFiles()` 跳过 `.app` 目录；上传改读 finalize 生成的
   `release-out/upload-files.txt`（不再用 find）。
5. **重跑幂等**：同一 tag 重复创建会冲突 → `gh release create` 前先
   `gh release delete <tag> --yes || true`。
6. 顺带修复：已存在 `docs/conversations/2026-08-20-release-cd-flow.md` 的 prettier 格式问题。
7. macOS 自更新包 `Tauri-Desktop-Software-Template.app.tar.gz` 文件名不含
   `_version_arch`，之前漏改平台前缀 → 让 `fileRe` 的版本/架构可选，
   从同目录的 `_aarch64.dmg` 探测架构后，一并改名为 `-macOS-<版本>-<架构>.app.tar.gz`。

修复上述 4（白名单）后重跑，目标做到：三平台 `Build & rename` 全部成功，
`finalize` 的 `Assemble / Create draft / Upload assets / Upload latest.json` 全部通过，
生成带平台前缀命名安装包、按平台分组的发布说明与合并后的 `latest.json`。

## 六、最终验证（最新一次完整 Release v0.1.1 成功）

对提交 `cde9a97` 触发的完整发布管道（`quality → build&rename(三平台) → finalize`）
做端到端验证，全部通过：

- **CI**：Release run success；Code Quality 作业 20+ 步全绿。
- **三个 `Build & rename` 作业**（windows / macOS / linux）：Build + Rename + Upload 均 success。
- **finalize**：汇总产物、重建 latest.json、生成发布说明、上传成功。

### 生成并确认的 Release 产物（`gh release view v0.1.1`）

平台前缀清晰，且提供了各自完整的 `.sig` 签名与自更新包：

| 平台 | 安装包 | 签名 |
| --- | --- | --- |
| Windows | `Tauri-Desktop-Software-Template-Windows-0.1.1-x86_64.msi` | `.msi.sig` |
| macOS | `...-macOS-0.1.1-aarch64.dmg` + `...-macOS-0.1.1-aarch64.app.tar.gz` | 各自 `.sig` |
| Linux | `...-Linux-0.1.1-x86_64.AppImage` | `.AppImage.sig` |

> 重点修复项验证成功：之前漏改平台前缀的 macOS 自更新包
> `Tauri-Desktop-Software-Template.app.tar.gz` 已正确改名为
> `Tauri-Desktop-Software-Template-macOS-0.1.1-aarch64.app.tar.gz`。

### 合并后的 latest.json（自更新清单）

从发布中下载 `latest.json` 校验：

- 包含 **3 个平台**：`darwin-aarch64` / `windows-x86_64` / `linux-x86_64`；
- 每项的 `url` 都已指向**重命名后的新文件名**，与上传的产物一一对应；
- 每项的 `signature`（`.sig`）对文件内容签名、与文件名无关，重命名后依然有效
  —— 自动更新功能不会因改名失效。

### 发布说明（release-body）

按 Windows / macOS / Linux 分组列出各自的安装包与直链，末尾附本次干净版 changelog
（只剩 `Documentation` 分组，无测试/CI/依赖噪音）。

验证结论：安装包平台命名、自动更新清单同步、简洁更新日志三项目标全部达成。

## 七、已知限制 / 后续

- 本仓库未配置 Apple 开发者证书，macOS 安装包为 ad-hoc（`signingIdentity:"-"`）签名，
  仅供内测；若要上架分发需另行配置 Apple 签名/公证。
- 本次为验证而打 tag，产物发布为 **draft 草稿**，如需对外发布需手动 `gh release edit` 转为正式。
- 下个版本发布时（打新 `v*` tag）将自动走新的命名与发布说明流程。

## 对话（2026-08-20 · 续：最终验证）

用户消息："继续"——延续上一轮任务，验证并收尾 v0.1.1 发布。本轮没有修改代码，
只做了端到端发布验证与记录：CI 全绿、产物平台命名正确、latest.json 同步、发布说明干净。
