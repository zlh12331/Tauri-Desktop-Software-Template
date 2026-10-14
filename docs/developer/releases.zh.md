# 发布

[English](releases.en.md) | **[中文](releases.zh.md)**

发布流程、版本管理和自动更新系统。

## 概述

发布系统提供：

- 自动化 GitHub Actions 工作流用于构建发布
- 版本管理脚本用于更新所有版本文件
- 基于同意的自动更新：应用提出更新，装不装由用户决定
- 跨平台构建（macOS、Windows、Linux）

## 初始设置

### 1. 生成签名密钥

```bash
npm run tauri -- signer generate -w ~/.tauri/myapp.key
# 输出私钥（已保存）和公钥（已显示）
```

### 2. 配置 GitHub 仓库

添加这些 secrets（Settings → Secrets and variables → Actions）：

- `TAURI_PRIVATE_KEY`：`~/.tauri/myapp.key` 的内容
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：你设置的密码（如有）

### 3. 更新配置

**`src-tauri/tauri.conf.json`**：

```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/<your-username>/<your-repo>/releases/latest/download/latest.json"
      ],
      "pubkey": "<your-public-key-from-step-1>"
    }
  }
}
```

**`tauri.conf.json` 中的包信息**：

- 更新 `publisher`、`shortDescription`、`longDescription`
- 更新 `productName` 和 `identifier`

### 4. 操作系统代码签名：可选、故意缺省、但不许静默

`release-v2.yml` 里还有一组 secret，本模板发布时并不带它们：

| Secret 组合                            | 是什么                                        |
| -------------------------------------- | --------------------------------------------- |
| `APPLE_CERTIFICATE` + `..._PASSWORD`   | macOS 的 Developer ID 证书（base64 `.p12`）   |
| `WINDOWS_CERTIFICATE` + `..._PASSWORD` | Windows 的 Authenticode 证书（base64 `.pfx`） |

两者都要花模板无法预支的钱——一个 Apple 开发者账号、一张代码签名证书——所以两个
"Import … certificate" 步骤由 `if: env.<SECRET> != ''` 控制
（`release-v2.yml:279`、`release-v2.yml:296`），不加也能正常构建、发布并自动更新。
缺省合理，就不许沉默：`finalize` 会把一节 **Code signing** 追加进草稿发布说明与作业
摘要，写明每个包签没签。装包的人读到的那句话，和 fork 的人写下的必须是同一句。

**导入了证书不等于用上了证书。** 决定签名的是 `src-tauri/tauri.conf.json`，而不是
作业的环境变量：

- `bundle.macOS.signingIdentity` 出厂是 `"-"`，即 ad-hoc 签名。要改成你自己的身份名
  （`Developer ID Application: Example Ltd (ABCDE12345)`），否则导入的证书永远不会被用上。
- `bundle.windows.certificateThumbprint` 出厂是 `null`。只有它填了指纹，`signtool`
  才会执行。工作流把 `WINDOWS_CERTIFICATE_THUMBPRINT` 导出到环境里，而没有东西读它。

于是"两个 secret 都加了、这两个字段忘了改"的 fork，产出依旧是一个 ad-hoc 的 macOS 包
和一个未签名的 `.msi`，而所有检查全绿。这和 `.github/CODEOWNERS` 指向一个不是协作者的
账号是同一种病：看起来配置好了，实际什么都不生效。要验就验产物，别验流水线：

```bash
codesign -dv --verbose=2 Tauri-Desktop-Software-Template.app 2>&1 | grep -i signature
spctl -a -vv Tauri-Desktop-Software-Template.app   # ad-hoc 签名会被拒绝
# Windows：右键 .msi → 属性 → 数字签名；没签过就没有这个页签。
```

Notarization（公证）是 Developer ID 签名之外的又一步，本工作流不做。缺它时，放在
`~/Downloads` 里的 macOS 安装包仍需先清除隔离属性才打得开。

**更新签名是另一套系统。** `latest.json` 与 `.sig` 由 `TAURI_PRIVATE_KEY` 生成，所以
未签名的包照样能校验自动更新。上面两组证书都不影响它，加上它们也不等于轮换密钥。

## 发布流程

### 发布是两条命令，不是一条

```bash
npm run release:prepare -- v1.0.0     # 改版本号，开出发版 PR
# …评审并合并那个 PR…
npm run release:tag -- v1.0.0         # 给合并点打 tag；这才启动构建
```

`release:prepare` 会：

1. 检查 git 状态是否干净
2. 跑版本预检（`check-version.mjs --pre-release`）：目标版本不得已作为 tag 存在，
   且必须高于所有已发布版本
3. 运行所有质量检查（`npm run check:all`）
4. 更新四处版本字段并重新生成 `CHANGELOG.md`
5. 在 `release/v1.0.0` 上提交、推送，并用 `gh` 开出发版 PR

随后 `release:tag` 从已合并的 `origin/main` 读取版本号，除非四处都与请求的版本一致
且该 tag 尚不存在，否则拒绝执行；通过后才创建并推送 tag。触发构建的是这次 tag 推送：

1. 为所有平台构建应用
2. 创建草稿发布
3. 生成 `latest.json` 用于自动更新
4. 上传所有安装程序和签名

最后，在 GitHub 上手动发布该草稿。

之所以拆开：`main` 被规则集保护，要求 PR 与状态检查，所以旧的那条命令最后一步
`git push origin main --tags` 会被拒绝——而如果拒绝发生在 `git tag` 之后，tag 就指向了
一个 `main` 从未收到过的提交。`v0.1.2` 就是这样凭空消失的：版本号已经发出去了，但
从未打上 tag，于是更新器的 `/releases/latest/download/latest.json` 仍返回 `v0.1.1`，
`0.1.1` 的用户永远不知道该更新。改成"给合并点打 tag"后这种状态不可能出现：tag 只能
指向 `main`。

### CHANGELOG 生成

本项目使用 [git-cliff](https://git-cliff.org/) 从 Conventional Commits 自动生成 `CHANGELOG.md`。

```bash
npm run changelog
```

配置在项目根目录的 `cliff.toml` 中。changelog 按类型（功能、Bug 修复、文档等）分组提交，并为每个 `v*` 标签生成新的版本部分。

`release:prepare` 会在改版本号的同一步里重新生成 `CHANGELOG.md`，所以变更日志与版本号
落在同一个提交、同一个 PR 里。生成时它显式报出即将创建的那个 tag（`git-cliff --tag
v1.0.0`），顶部小节因此写的是 `## [1.0.0]` 而不是 `## [Unreleased]`。两处都依赖这一
点：Release 工作流会在 tag 上重新生成一遍变更日志并比对文本，只差那一个标题时三平台
构建根本不启动；发布说明要抽取 `## [<version>]` 这一节，留着 `[Unreleased]` 就什么都
抽不到。

```bash
npm run release:prepare -- v1.0.0
```

想先校一遍措辞，就用同样的方式生成，然后在 `release/v1.0.0` 分支上 amend 那个发版
提交：

```bash
npm run changelog -- --tag v1.0.0
```

只改变更日志的提交不要直接推 `main`——分支保护会拒绝，而且拒绝发生时 tag 往往已经在
本地建好了。

### 手动方法

把脚本的两步手工做一遍：

```bash
# 1. 改齐四处版本、按目标 tag 生成变更日志、验证、开 PR
npm run version:check
npm run check:all
npm run changelog -- --tag v1.0.0
git checkout -b release/v1.0.0
git add .
git commit -m "chore: release v1.0.0"
git push -u origin release/v1.0.0
gh pr create --base main --head release/v1.0.0 --title "chore: release v1.0.0"

# 2. 该 PR 合并之后：给合并点打 tag，构建由此启动
git fetch origin main
node scripts/check-version.mjs --pre-release v1.0.0
git tag -a v1.0.0 origin/main -m "Release v1.0.0"
git push origin v1.0.0
```

这里刻意不提供"把版本提交直接推上 `main`"的手动写法。规则集会拒绝它，而让发版搁浅的
正是那一步组合：`git tag` 本地成功、推送被拒，接下来要么留下一个悬空 tag，要么把它推成
一个指向 `main` 从未有过的提交。

## 版本策略

语义化版本（`v1.0.0`）：

- **主版本**（1.x.x）：破坏性变更
- **次版本**（x.1.x）：新功能，向后兼容
- **修订版本**（x.x.1）：Bug 修复

### 版本写在四个地方

发布版本会被写进四个文件，`scripts/prepare-release.js` 用正则替换完成写入：

- `package.json` → `"version": "1.0.0"`
- `src-tauri/Cargo.toml` → `[package]` 内的 `version = "1.0.0"`
- `src-tauri/Cargo.lock` → lockfile 里属于本 crate 的那条 `[[package]]` 记录
- `src-tauri/tauri.conf.json` → `"version": "1.0.0"`

lockfile 那条是最容易被漏的一处——也正因为它，旧文档写的是"三个文件"。改一半会让
交付出去的包出现应用清单、安装器元数据与更新元数据三者不一致，而这种不一致是在用户
机器上以"这个应用更新不了"的形式浮现的。`npm run version:check` 断言四处一致，它既进
`check:all`，也是 CI 的一个步骤。

```bash
npm run version:check                                 # 只查一致性——CI 门禁用的就是这个
node scripts/check-version.mjs --pre-release v0.2.0   # 切版本之前跑
```

预检模式回答的是另一个问题，这也是它必须把版本号作为参数传入的原因：准备发版的当下，
磁盘上的文件仍是*上一个*版本，读文件等于检查错了对象。它会向 origin 索取 tag 列表（本地
clone 若从未 fetch 过 tag，否则会报"还没有任何发布"并放行一个重复版本），并拒绝两种情况：

- 该版本已作为 tag 存在——更新器解析的是
  `/releases/latest/download/latest.json`，它跟随最新的 tag，所以两个都叫 `v0.1.2`
  的发布不可能同时可达；
- 该版本不高于已发布的最大 tag，那等于发一个没人能收到的版本。

`prepare-release.js` 会先跑这道预检再跑 `check:all`，于是一个错误的版本号在一秒内就失败，
而不是等完整套件跑完。

## 自动更新系统

### 行为

- 检查在启动 5 秒后进行，不与窗口创建争抢启动路径。
- 有更新时只**征求同意，绝不自行安装**：一条常驻提示写出新版本号，并展示清单里的
  `Update.body`（发布说明），按钮是「安装更新」与「稍后」。
- 只有用户点「安装更新」才开始下载与安装；完成后第二条提示给出「立即重启」。应用不会
  自己重启——用户正在编辑时重启就是丢数据。
- 「稍后」只关掉提示。下次启动会再检查；同一会话里重复检查只会替换已有提示，不会叠出
  第二条。
- 启动侧的检查把网络失败视为正常（debug 日志，不弹提示）；用户主动发起的检查会明确报告
  失败。

### 更新流程

```
启动 →（5 秒）→ 检查端点 ─→ 无更新 ─→（静默；主动检查则回「已是最新」）
                     │
                     └→ 有更新 ─→ 提示(版本、发布说明、安装更新 | 稍后)
                                     │
                                     安装更新 → 下载并校验签名
                                               → 提示(已安装、立即重启)
                                               → relaunch
```

`downloadAndInstall()` 内部有平台差异：Windows 上安装器会在安装过程中直接结束进程，
所以「立即重启」这颗按钮实际只对 macOS / Linux 有意义。

### 一套实现，三个入口

整个流程都在 `src/lib/updater.ts`（`checkForUpdates`、`installPendingUpdate`）。调用
它的是：启动后的 hook（`src/hooks/use-auto-updater.ts`）、应用菜单（应用 → 检查更新）、
命令面板（`check-for-updates`）。要再加入口就调
`checkForUpdates({ interactive: true })`，不要绕过它直接 import
`@tauri-apps/plugin-updater`。

### 配置

```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/<your-username>/<your-repo>/releases/latest/download/latest.json"
      ],
      "pubkey": "<your-public-key-from-step-1>"
    }
  }
}
```

真正被读取的只有这些键。`tauri-plugin-updater` 2.11.0 反序列化的 `Config` 只有
`endpoints`、`pubkey`、`windows` 以及三个 `dangerous*` 开关——所以 v1 时代示例里常见的
`active` 与 `dialog` 会被接受然后忽略。本模板不再写它们，因为 `"dialog": false` 从来没
有关掉过任何原生对话框，只是看起来关掉了。静默不是设计目标；界面在
`src/lib/updater.ts`。

`bundle.createUpdaterArtifacts` 必须保持 `true`，否则构建不会产出 `.sig`，也就没有可供
指向的 `latest.json`。

### 轮换签名密钥

清单与产物是用「已安装客户端里编译进去的公钥」校验的，因此换密钥是一次兼容性断裂：用旧
密钥构建的客户端会拒绝新签名，并且无法自我更新。

1. 先用**旧密钥**发布一个正常版本，内容里说明即将轮换——这是旧安装还能自动到达的最后一个
   版本。
2. 生成新密钥对（`npm run tauri -- signer generate`），替换 `tauri.conf.json` 里的
   `pubkey`，并替换 `TAURI_PRIVATE_KEY` secret。
3. 版本号要高于第 1 步发布的任何版本，然后发版；同时告知仍在旧构建上的用户：这一版需要
   手动下载安装包。

### 本地验证一次更新

端点可以指向普通 HTTP 服务，但插件默认拒绝非 HTTPS，需要显式放行，而这个放行只是临时改动：

1. 准备一个发布（或本地伪造一个），产物平台与当前一致，版本号**高于** `tauri.conf.json`
   ——版本相同意味着「无更新」，忘了 bump 就什么都不会出现。
2. 用本地目录提供更新产物，把 `plugins.updater.endpoints` 指向该 `http://` 地址，并加上
   `"dangerousInsecureTransportProtocol": true`。
3. 运行 `npm run tauri:dev`，确认提示里有版本与发布说明、「稍后」能关掉、点「安装更新」
   能看到进度。
4. 提交前把这两处配置改回去。永远不要带着 `dangerousInsecureTransportProtocol` 发布。

### 手动检查更新

用户可以通过以下方式主动检查：

- **菜单**：应用 → 检查更新
- **命令面板**：Cmd+K → 检查更新

## 发布产物

每次发布创建：

- **macOS**：`.dmg` 安装程序
- **Windows**：`.msi` 安装程序（配置后）
- **Linux**：`.deb` 和 `.AppImage`（配置后）
- **自动更新器**：`latest.json` 清单和 `.sig` 签名文件

## 安全性

所有更新都经过加密签名：

1. 私钥在构建期间签名发布
2. 配置中的公钥验证下载
3. 无效签名自动被拒绝

## 故障排除

| 问题             | 解决方案                                                |
| ---------------- | ------------------------------------------------------- |
| 工作流未触发     | 确保标签以 `v` 开头并已推送                             |
| 构建失败         | 检查 GitHub secrets，本地运行 `npm run check:all`       |
| 未检测到更新     | 验证端点 URL 与公钥是否匹配，并确认版本号**确实**改高过 |
| 已提示更新但没装 | 这是预期行为——必须点「安装更新」，见上文「行为」        |
| 下载失败         | 检查签名、文件权限、磁盘空间                            |

## Rust API 文档

为所有 Tauri 命令、类型和模块生成 HTML 文档：

```bash
npm run rust:doc
```

输出写入 `src-tauri/target/doc/`。在浏览器中打开 `target/doc/index.html` 浏览。文档由 Rust 公共 API（命令、结构体、枚举）上的 `///` 文档注释生成。
