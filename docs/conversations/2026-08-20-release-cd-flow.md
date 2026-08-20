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
- GH_TOKEN 是 `ghu_` 集成 token，对 Actions Secrets 写操作恒返回 403，无法代用户写入 `TAURI_PRIVATE_KEY` / 密码。最终由用户手动在 GitHub 网页配置。

### 修复 5：密码 Secret 命名不一致

第三次触发后三平台 `publish` 仍失败，但错误从 `Missing comment` 变为 `Wrong password for that key`。

- **根因**: `release-v2.yml` 中私钥引用 `secrets.TAURI_PRIVATE_KEY`，密码却引用 `secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD`——命名不一致，密码 secret 读不到。用户配置的是 `TAURI_PRIVATE_KEY_PASSWORD`（与私钥对称）。
- 修复：密码引用改为 `secrets.TAURI_PRIVATE_KEY_PASSWORD`。

### 修复 6：macOS 无证书但 tauri-action 仍注入空 Apple env

第四次触发后 Windows/Linux `publish` 成功，产生 AppImage/MSI 及 `.sig`，**仅 macOS dmg 失败**，错误：

```
failed to bundle project: failed codesign application:
  failed security import: failed to import keychain certificate
```

- **根因**: tauri-action 在 macOS 上只要检测到 Apple 签名环境变量**存在但为空**（`APPLE_CERTIFICATE` 等 secret 未配置），就会走 keychain 证书导入路径，即使 `bundle.macOS.signingIdentity: "-"`（ad-hoc）。这是 tauri-action 已知问题（issue #234）。
- 修复：把 `Build and release` 拆成两个互斥步骤——
  - Apple-signed（`if: env.APPLE_CERTIFICATE_IMPORTED == 'true'`）注入全部 Apple env；
  - unsigned fallback（`if: env.APPLE_CERTIFICATE_IMPORTED != 'true'`）只传 `TAURI_SIGNING_PRIVATE_KEY` 相关 env，让 macOS 走 ad-hoc 签名。
  - 用 `secrets` 上下文在 step `if` 中会被 actionlint 拒绝，改用 macOS 证书导入步骤写入的 `APPLE_CERTIFICATE_IMPORTED` flag。
- 本仓库未配置 Apple 开发者证书，因此走 unsigned fallback 产出未签名(ad-hoc)dmg，可供内测；如需上架分发需另行配置 Apple 签名/公证 secrets。

## 五、最终结果（发布成功）

第五次触发（tag → `7e5c9f0`）全绿：

```
✓ Code Quality in 3m5s
✓ Publish (windows msi) in 7m39s
✓ Publish (ubuntu appimage) in 7m13s
✓ Publish (macos app,dmg) in 10m36s
```

GitHub draft release `v0.1.0` 已创建，资产齐全：
- macOS: `_0.1.0_aarch64.dmg` + `.app.tar.gz`（含 `.sig`）
- Windows: `_0.1.0_x64_en-US.msi`（含 `.sig`）
- Linux: `_0.1.0_amd64.AppImage`（含 `.sig`）
- `latest.json`（自动更新清单）

`.sig` 签名文件与 `latest.json` 均成功生成，说明用户配置的 `TAURI_PRIVATE_KEY` / `TAURI_PRIVATE_KEY_PASSWORD` 两个 Secrets 生效，签名阶段通过。

**最终发布**：用户配置好 Secrets 后确认「配置好了」，本次运行（commit `7e5c9f0`，2026-08-20T09:30Z）三平台构建全部成功。由 agent 执行 `gh release edit v0.1.0 --draft=false` 将 draft 正式发布，`published: 2026-08-20T09:51:36Z`。

🎉 **v0.1.0 发布完成**：https://github.com/zlh12331/Tauri-Desktop-Software-Template/releases/tag/v0.1.0

## 六、配置 Secrets 的说明（用户手动完成）

`GH_TOKEN`（`ghu_` 集成 token）对 GitHub Actions **Secrets** 写操作一律返回
`Resource not accessible by integration`（HTTP 403）。因此 **配置 Secrets 需由用户在 GitHub 网页手动完成**：

| Secret 名称                  | 值                                                 |
| ---------------------------- | -------------------------------------------------- |
| `TAURI_PRIVATE_KEY`          | 私钥文件完整内容（base64 minisign 私钥，348 字符） |
| `TAURI_PRIVATE_KEY_PASSWORD` | 生成时设置的密码                                   |

用户已在仓库 Settings → Secrets 中配置好这两个值，本次三平台构建的 `.sig` 签名与 `latest.json` 生成成功即为配置生效的证明。

## 七、过程中的关键教训

1. **git-cliff 是完整历史依赖工具**：浅克隆 / `fetch-depth:1` 生成的 CHANGELOG 会缺失祖先提交，导致与提交内容不一致。release workflow 里凡跑 git-cliff 的作业必须 `fetch-depth: 0`。
2. **本地浅克隆不可作为"生成一致性"验证依据**：必须在完整历史上验证 `git-cliff -o` 输出 == 提交的 CHANGELOG.md。
3. **`chore(release):` 前缀 commit 会被 git-cliff 的 `commit_parsers` skip**：用它提交 CHANGELOG 不会产生新的 changelog 条目，保证可复现。
4. **Tauri updater 发布依赖私钥**：`createUpdaterArtifacts: true` 时必须在 Secrets 里配 `TAURI_PRIVATE_KEY` + 密码，且公钥必须与私钥配套。
5. **`ghu_` 集成 token 不能写仓库 Secrets**：这类 token 对 Actions secrets 接口恒定 403，配置 Secrets 只能由有完整 oauth/admin 权的用户操作。
