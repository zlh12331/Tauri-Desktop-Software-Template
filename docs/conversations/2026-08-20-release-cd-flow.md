# 对话记录：将 release-v2.yml 流程跑通并发布 v0.1.0

- **日期**: 2026-08-20
- **主题**: 跑通 Tauri 桌面应用的 GitHub Actions 发布流程（release-v2.yml），发布 v0.1.0
- **目标**: 无
- **最终代码提交**: 见下文"变更记录"

## 一、用户请求

```
为什么没有cd流程只有ci流程
把release-v2.yml流程跑通，发一版（v0.1.0）
```

用户先询问为何仓库只有 CI 没有 CD，随后明确要求把 `release-v2.yml`（实际上就是 CD/发布流程）跑通并发布 v0.1.0。

## 二、初始排查

### 2.1 现状

- 仓库有三个 workflow：[ci.yml](file:///workspace/.github/workflows/ci.yml)、[codeql.yml](file:///workspace/.github/workflows/codeql.yml)、[release-v2.yml](file:///workspace/.github/workflows/release-v2.yml)。
- **CD 流程就是 `release-v2.yml`**（触发器：`push: tags v*` 或 `workflow_dispatch`），它负责：质量门禁 → 三平台构建安装包（macOS dmg / Windows msi / Linux appimage）→ 创建 GitHub draft release + updater json。
- 本地仓库是**浅克隆**（`is-shallow: true`），仅 4 个提交，root 为 `51de8c1`。
- 版本 `0.1.0` 在 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 三处一致。
- 鉴权：`gh auth status` 显示已登录 `zlh12331`（`GH_TOKEN`，`ghu_` 前缀的 GitHub 集成 token）。

### 2.2 发布机制

`release-v2.yml` 由推送 `v*` tag 触发。因此让流程跑通 = 打一个 `v0.1.0` tag 并 push，等待 GitHub Actions 构建发布。

## 三、跑通过程（共 4 次触发）

第一次触发（tag 指向 main HEAD `51de8c1`）：

- `quality` 作业在 **`CHANGELOG up to date (git-cliff)`** 步骤失败：
  `sh: 1: git-cliff: not found`（exit 127）。
- **根因**: `npm run changelog` 调用的 `git-cliff` 二进制未安装在 runner 上。`ci.yml` 从不跑 changelog 检查，所以此前从未暴露。

### 修复 1：在 release-v2.yml quality 作业安装固定版本 git-cliff

在 CHANGELOG 检查前插入安装步骤，固定 git-cliff 2.13.1（Linux x86_64）以与本地产出一致。

第二次触发（打 tag 到 `501094b`）——同一个步骤仍失败，但原因变成：

- git-cliff 后补：本地浅克隆只有 3 个提交，重新生成只含 CI 两条；CI runner `actions/checkout@v7` 默认浅克隆（`fetch-depth: 1`），git-cliff 看不到祖先提交，重新生成的 CHANGELOG **缺失早期条目**（如 README 提交），导致 diff 失败。
- **根因**: git-cliff 需要完整 git 历史来按 tag 归类提交。

### 修复 2：quality 作业 checkout 改为 `fetch-depth: 0`

改为完整克隆，确保 git-cliff 能读取全部历史，生成结果与本地一致。

第三次触发 —— `quality` 作业全绿通过：

- 本地补全历史（`git fetch --unshallow`，98 个提交）后，完整历史下 git-cliff 生成 127 行的完整 changelog（含整个模板历史：Features / Bug Fixes / Testing / Miscellaneous 等）。用完整历史重新生成并提交 CHANGELOG，验证 `MATCH OK`。
- 进入 `publish-tauri` 阶段，macOS / Linux 两个作业在 **`Build and release`** 失败：

```
failed to decode secret key: incorrect updater private key password: \
  Missing comment in secret key
```

- **根因**: `createUpdaterArtifacts: true`，但仓库 Secrets 里没有配置 `TAURI_PRIVATE_KEY` / `TAURI_PRIVATE_KEY_PASSWORD`，签名阶段报错。模板自带的 pubkey 没有匹配的私钥，无法发布自动更新安装包。
- 另发现独立 bug：`includeUpdaterJson` 是 tauri-action 的无效输入，正确写法是 `uploadUpdaterJson`。

### 修复 3：`includeUpdaterJson` → `uploadUpdaterJson`

tauri-action 会告警但忽略无效输入，导致 updater json 不上传。修正为 `uploadUpdaterJson`。

### 修复 4：生成新密钥对 + 更新公钥

- 在独立临时目录安装 tauri-cli 2.11.4，运行 `tauri signer generate --ci --password ... -w` 生成新的 ed25519/minisign 密钥对。
- 验证私钥：`TAURI_SIGNING_PRIVATE_KEY`（私钥文件原始内容）或 `TAURI_SIGNING_PRIVATE_KEY_PATH` 均能成功签名。
- 用新公钥覆盖 `src-tauri/tauri.conf.json` 的 `updater.pubkey`（因为旧模板公钥无对应私钥）。
- 提交 `chore(release): rotate updater public key for v0.1.0`。

## 四、最终代码状态（main）

最终 main HEAD = `1b17f53`，包含：

- `chore(release): v0.1.0`（重打 CHANGELOG 后提交）
- `chore(release): rotate updater public key for v0.1.0`（新公钥）
- `ci(release): use valid uploadUpdaterJson input for tauri-action`
- `chore(release): v0.1.0`（完整历史 CHANGELOG）
- `ci(release): fetch full git history for git-cliff in quality job`
- `ci(release): vend pinned git-cliff install in quality job`

已验证：在最新 HEAD 上完整历史重新运行 `git-cliff -o` 与提交的 CHANGELOG.md 完全一致（`MATCH OK`），确保 quality 的 diff 门禁能通过。

本地 tag `v0.1.0` 已指向 `1b17f53`；main 已 push 到远端。

## 五、遗留的硬阻塞（需用户手动操作）

`GH_TOKEN`（`ghu_` 集成 token）对 GitHub Actions **Secrets** 写操作一律返回
`Resource not accessible by integration`（HTTP 403），即使账户 API 显示 `admin: true`。
`tauri-action` 的输入工具（GitHub MCP、gh CLI）也都无法写入 Secrets。

因此 **只有配置 Secrets 这一步必须由用户在 GitHub 网页（或自己签发的 oauth token）完成**：

| Secret 名称                  | 值                                                 |
| ---------------------------- | -------------------------------------------------- |
| `TAURI_PRIVATE_KEY`          | 私钥文件完整内容（base64 minisign 私钥，348 字符） |
| `TAURI_PRIVATE_KEY_PASSWORD` | 生成时设置的密码                                   |

私钥已生成在沙箱 `/tmp/vault/updater.key`，密码 `t3mpl8ate-v0.1.0-upd@ter`。
公钥已提交进 `tauri.conf.json`。

配置完成后，只需把本地 tag `v0.1.0` push 到远端（`git push origin v0.1.0`），或在 Actions 页
`workflow_dispatch` 手动触发，即可让 `publish-tauri` 三平台构建成功并创建 draft release。

## 六、唤起过程中的关键教训

1. **git-cliff 是完整历史依赖工具**：浅克隆 / `fetch-depth:1` 生成的 CHANGELOG 会缺失祖先提交，导致与提交内容不一致。release workflow 里凡跑 git-cliff 的作业必须 `fetch-depth: 0`。
2. **本地浅克隆不可作为"生成一致性"验证依据**：必须在完整历史上验证 `git-cliff -o` 输出 == 提交的 CHANGELOG.md。
3. **`chore(release):` 前缀 commit 会被 git-cliff 的 `commit_parsers` skip**：用它提交 CHANGELOG 不会产生新的 changelog 条目，保证可复现。
4. **Tauri updater 发布依赖私钥**：`createUpdaterArtifacts: true` 时必须在 Secrets 里配 `TAURI_PRIVATE_KEY` + 密码，且公钥必须与私钥配套。
5. **`ghu_` 集成 token 不能写仓库 Secrets**：这类 token 对 Actions secrets 接口恒定 403，配置 Secrets 只能由有完整 oauth/admin 权的用户操作。
