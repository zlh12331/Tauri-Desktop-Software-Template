#!/usr/bin/env node
/**
 * 发布产物统一脚本：重命名安装包 / 汇总自动更新清单与发布说明。
 *
 * 为什么需要重命名：
 *   Tauri 默认产物名是 `{productName}_{version}_{arch}.{ext}`（如
 *   `Tauri-Desktop-Software-Template_0.1.0_x64_en-US.msi`），只能在格式后缀里
 *   区分平台，不够直观。本脚本把产物统一重命名为
 *   `{productName}-{platform}-{version}-{arch}.{ext}`，让用户一眼看清该装哪个。
 *
 * 为什么需要在最终发布时重建 latest.json：
 *   Tauri 自动更新清单 `latest.json` 引用的是产物文件名。一旦重命名产物，
 *   若不同步更新 `latest.json` 里的 url，自更新就会找不到安装包而失效。
 *   每个平台构建时会各自生成一份只含自己平台的 latest.json，最终发布时
 *   需要把它们合并成一份完整的 latest.json。
 *
 * 两个子命令：
 *   1. rename    —— 在构建后的 bundle 目录内重命名产物（matrix 作业内执行）
 *   2. finalize  —— 汇总三平台产物，重建 latest.json 并生成发布说明（finalize 作业内执行）
 *
 * 用法：
 *   node scripts/release-assets.mjs rename <platform> <productName> <version>
 *   node scripts/release-assets.mjs finalize \
 *       <artifactsDir> <tag> <owner> <repo> <productName> <version> <outDir> <changelogPath>
 */

import fs from 'node:fs'
import path from 'node:path'

// 平台维度配置：label 用于产物文件名；
// fileRe 匹配 Tauri 产物文件名（捕获 prod/ver/arch/ext）；
// archLabel 把架构缩写（amd64/x64）规整为面向用户的写法。
const PLATFORMS = {
  macos: {
    label: 'macOS',
    fileRe:
      /^(?<prod>.+?)_(?<ver>\d+\.\d+\.\d+)_(?<arch>aarch64|x86_64)(?<ext>\.dmg|\.app\.tar\.gz)$/,
    archLabel: arch => (arch === 'x86_64' ? 'x86_64' : 'aarch64'),
  },
  windows: {
    label: 'Windows',
    fileRe:
      /^(?<prod>.+?)_(?<ver>\d+\.\d+\.\d+)_(?<arch>arm64|arm|x64|x86)(_[a-zA-Z-]+)?(?<ext>\.msi|\.exe|\.msix|\.zip)$/,
    archLabel: arch =>
      arch === 'arm64' || arch === 'arm' ? 'aarch64' : 'x86_64',
  },
  linux: {
    label: 'Linux',
    fileRe:
      /^(?<prod>.+?)_(?<ver>\d+\.\d+\.\d+)_(?<arch>amd64|arm64|aarch64|x86_64|i386)(?<ext>\.AppImage|\.AppImage\.tar\.gz|\.deb|\.rpm|\.tar\.gz|\.gz)$/,
    archLabel: arch =>
      arch === 'amd64'
        ? 'x86_64'
        : arch === 'i386'
          ? 'x86_64'
          : arch === 'aarch64'
            ? 'aarch64'
            : arch,
  },
}

/**
 * 深度查找指定目录（含子目录）下所有满足条件的文件。
 * @param {string} root 根目录
 * @param {(name: string, absPath: string) => boolean} predicate 文件名 / 路径断言
 * @returns {string[]} 命中文件的绝对路径列表
 */
function findFiles(root, predicate) {
  const hits = []
  const walk = dir => {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        // 跳过 macOS 的 `.app` 应用包目录：里面是可执行文件/图标/框架等运行时
        // 文件，既不是需要签名的安装包，也不应该被上传到 Release。
        if (entry.name.endsWith('.app')) continue
        walk(abs)
      } else if (predicate(entry.name, abs)) hits.push(abs)
    }
  }
  walk(root)
  return hits
}

/**
 * 解析 /workspace 仓库 CommonJS 版本号匹配辅助。
 * @param {string} version 例如 v0.1.0
 * @returns {string} 去掉 v 前缀的干净版本号
 */
function cleanVersion(version) {
  return version.replace(/^v/, '')
}

/**
 * rename 子命令：把某个平台构建出的产物重命名为带平台标签的名字。
 * @param {string} platform 平台名（macos/windows/linux）
 * @param {string} productName 产品名（用于文件名）
 * @param {string} version 版本号（如 0.1.0 / v0.1.0）
 */
function runRename(platform, productName, version) {
  const cfg = PLATFORMS[platform]
  if (!cfg) throw new Error(`Unknown platform: ${platform}`)
  const ver = cleanVersion(version)
  const bundleRoot = path.resolve('src-tauri/target/release/bundle')
  if (!fs.existsSync(bundleRoot)) {
    throw new Error(`Bundle dir not found: ${bundleRoot}`)
  }

  // 递归扫描 bundle 目录下的产物文件，按该平台的命名正则匹配。
  // 统一按子目录递归而不是写死 dmg/appimage/msi 等目录，是因为 Tauri 各版本
  // 的 bundle 布局不完全一致（例如 macOS 的 .dmg 在 dmg/、.app.tar.gz 在 macos/）。
  const artifacts = findFiles(
    bundleRoot,
    name =>
      !name.endsWith('.sig') &&
      name !== 'latest.json' &&
      name !== 'rename-map.json'
  )

  // 收集重命名映射：{ 原始文件名 -> 新文件名 }
  const renameMap = {}
  for (const absPath of artifacts) {
    const file = path.basename(absPath)
    const m = file.match(cfg.fileRe)
    if (!m) continue
    const { arch, ext } = m.groups
    const archName = cfg.archLabel(arch)
    const newName = `${productName}-${cfg.label}-${ver}-${archName}${ext}`
    if (newName === file) continue
    renameMap[file] = newName
  }

  // 执行重命名：安装包与其 .sig 签名文件一起改。
  for (const [oldName, newName] of Object.entries(renameMap)) {
    const from = findFiles(bundleRoot, n => n === oldName)[0]
    if (!from) throw new Error(`Cannot locate ${oldName} in bundle dirs`)
    const to = path.join(path.dirname(from), newName)
    fs.renameSync(from, to)
    const oldSig = `${from}.sig`
    if (fs.existsSync(oldSig)) fs.renameSync(oldSig, `${to}.sig`)
  }

  // 写入 rename-map.json 供 finalize 作业重建 latest.json 时做旧名→新名映射。
  fs.writeFileSync(
    path.join(bundleRoot, 'rename-map.json'),
    JSON.stringify(renameMap, null, 2) + '\n'
  )

  console.log(
    `[rename] ${platform}: ${Object.keys(renameMap).length} artifact(s) renamed`
  )
  for (const [oldName, newName] of Object.entries(renameMap)) {
    console.log(`  ${oldName} -> ${newName}`)
  }
}

/**
 * 在某平台产物目录里读取 rename-map.json。
 * @param {string} dir 平台产物目录
 * @returns {Record<string, string>} 映射
 */
function readRenameMap(dir) {
  const file = findFiles(dir, n => n === 'rename-map.json')[0]
  if (!file) return {}
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

/**
 * 提取某个版本在 CHANGELOG.md 里的发布说明文本。
 * @param {string} changelogPath CHANGELOG.md 路径
 * @param {string} version 干净版本号
 * @returns {string} 该版本的说明（不含最后一行生成器标记）
 */
function extractChangelogSection(changelogPath, version) {
  if (!fs.existsSync(changelogPath)) return ''
  const text = fs.readFileSync(changelogPath, 'utf8')
  const marker = `## [${version}]`
  const idx = text.indexOf(marker)
  if (idx === -1) return ''
  const section = text.slice(idx)
  // 截断到下一个同级别版本标题（## [x.x.x] 或 Unreleased）。
  const next = section.search(/\n## \[[^\]]+\]/)
  const body = next === -1 ? section : section.slice(0, next)
  return body.trim().replace(/\n?<!-- Generated by git-cliff -->\s*$/, '')
}

/**
 * 构建可读的平台名（从产物文件名中的 -macOS-/-Windows-/-Linux- 段识别）。
 * @param {string} filename 产物文件名
 * @returns {string|null} 平台名，无法识别返回 null
 */
function platformOf(filename) {
  for (const key of Object.keys(PLATFORMS)) {
    if (filename.includes(`-${PLATFORMS[key].label}-`))
      return PLATFORMS[key].label
  }
  return null
}

/**
 * finalize 子命令：合并三平台产物，重建 latest.json 并生成发布说明。
 * @param {object} opts 参数对象
 */
function runFinalize(opts) {
  const {
    artifactsDir,
    tag,
    owner,
    repo,
    productName,
    version,
    outDir,
    changelogPath,
  } = opts
  const ver = cleanVersion(version || tag)
  const tagName = tag.startsWith('v') ? tag : `v${tag}`
  const baseUrl = `https://github.com/${owner}/${repo}/releases/download/${tagName}`
  const combined = { version: ver, platforms: {} }
  const platformDirs = ['macos', 'windows', 'linux']

  for (const platform of platformDirs) {
    const dir = path.join(artifactsDir, platform)
    if (!fs.existsSync(dir)) continue
    const renameMap = readRenameMap(dir)
    let added = false

    // 优先读取该平台构建时自动生成的 latest.json，保留 Tauri 对"哪个文件可更新"的判定。
    const latestFile = findFiles(dir, n => n === 'latest.json')[0]
    if (latestFile) {
      let latest
      try {
        latest = JSON.parse(fs.readFileSync(latestFile, 'utf8'))
      } catch {
        latest = null
      }
      if (latest?.platforms) {
        for (const [key, entry] of Object.entries(latest.platforms)) {
          if (!entry?.signature) continue
          const origFile = path.basename(entry.url || '')
          const newFile = renameMap[origFile] || origFile
          combined.platforms[key] = {
            signature: entry.signature,
            url: `${baseUrl}/${newFile}`,
          }
          added = true
        }
      }
    }

    // 兜底：若该平台没通过 latest.json 读到条目，直接用"可更新产物"的 .sig 文件内容生成签名。
    if (!added) {
      const updatable =
        platform === 'macos'
          ? '.app.tar.gz'
          : platform === 'windows'
            ? '.msi'
            : '.AppImage'
      const artifacts = findFiles(dir, n => n.endsWith(updatable))
      const sig = findFiles(dir, n => n.endsWith(`${updatable}.sig`))[0]
      if (artifacts[0] && sig) {
        const filename = path.basename(artifacts[0])
        const label = PLATFORMS[platform].label
        const m = filename.match(new RegExp(`-${label}-${ver}-([^.]+)\\.`))
        const arch = m ? m[1] : null
        const key = `${platform === 'macos' ? 'darwin' : platform}-${arch}`
        combined.platforms[key] = {
          signature: fs.readFileSync(sig, 'utf8').trim(),
          url: `${baseUrl}/${filename}`,
        }
      }
    }
  }

  const isWindows =
    Object.hasOwn(combined.platforms, 'windows-x86_64') ||
    Object.hasOwn(combined.platforms, 'windows-aarch64')
  const isMacOS =
    Object.hasOwn(combined.platforms, 'darwin-x86_64') ||
    Object.hasOwn(combined.platforms, 'darwin-aarch64')
  const isLinux =
    Object.hasOwn(combined.platforms, 'linux-x86_64') ||
    Object.hasOwn(combined.platforms, 'linux-aarch64')

  // 生成发布说明：按平台分组列出下载链接与安装指引，再附 changelog。
  // uploadFiles 记录需要上传到 Release 的所有文件（安装包 + .sig），排除内部清单与 .app 包。
  const lines = [`## ${productName} ${tagName}`]
  const uploadFiles = []
  lines.push('')
  if (Object.keys(combined.platforms).length > 0) {
    lines.push('### Installers')
    lines.push('')
    if (isWindows) lines.push('- **Windows**: download the `.msi` and run it:')
    if (isMacOS)
      lines.push(
        '- **macOS**: download the `.dmg` and drag it to Applications:'
      )
    if (isLinux)
      lines.push(
        '- **Linux**: download the `.AppImage`, make it executable and run it:'
      )
    lines.push('')
    // 按平台分组列出全部产物链接（递归查找，排除内部清单与 .app 包）。
    const byPlatform = {}
    for (const dir of platformDirs) {
      const absDir = path.join(artifactsDir, dir)
      if (!fs.existsSync(absDir)) continue
      for (const abs of findFiles(
        absDir,
        name => name !== 'latest.json' && name !== 'rename-map.json'
      )) {
        const file = path.basename(abs)
        // 需要上传到 Release 的：安装包 + 各自的 .sig 签名文件。
        uploadFiles.push(abs)
        if (file.endsWith('.sig')) continue
        const label = platformOf(file)
        if (!label) continue
        ;(byPlatform[label] ||= []).push(file)
      }
    }
    for (const label of ['Windows', 'macOS', 'Linux']) {
      if (!byPlatform[label]) continue
      lines.push(`#### ${label}`)
      for (const file of byPlatform[label]) {
        lines.push(`- [\`${file}\`](${baseUrl}/${file})`)
      }
      lines.push('')
    }
  } else {
    lines.push('_No installable artifacts were produced for this release._')
    lines.push('')
  }

  const changelog = extractChangelogSection(changelogPath, ver)
  if (changelog) {
    lines.push('### Changelog')
    lines.push('')
    lines.push(changelog)
    lines.push('')
  }
  lines.push(
    '**Full Changelog**: ' +
      `https://github.com/${owner}/${repo}/commits/${tagName}`
  )

  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(
    path.join(outDir, 'latest.json'),
    JSON.stringify(combined, null, 2) + '\n'
  )
  fs.writeFileSync(path.join(outDir, 'release-body.md'), lines.join('\n'))
  fs.writeFileSync(
    path.join(outDir, 'upload-files.txt'),
    uploadFiles.join('\n') + '\n'
  )

  console.log(`[finalize] wrote ${outDir}/latest.json`)
  for (const [key, entry] of Object.entries(combined.platforms)) {
    console.log(`  ${key} -> ${entry.url}`)
  }
  console.log(`[finalize] wrote ${outDir}/release-body.md`)
  console.log(
    `[finalize] wrote ${outDir}/upload-files.txt (${uploadFiles.length} file(s))`
  )
  for (const file of uploadFiles) console.log(`  ${file}`)
}

// ---- 入口：解析子命令参数并分发 ----
const [, , command, ...args] = process.argv

try {
  if (command === 'rename') {
    const [platform, productName, version] = args
    if (!platform || !productName || !version) {
      throw new Error(
        'Usage: node scripts/release-assets.cjs rename <platform> <productName> <version>'
      )
    }
    runRename(platform, productName, version)
  } else if (command === 'finalize') {
    const [
      artifactsDir,
      tag,
      owner,
      repo,
      productName,
      version,
      outDir,
      changelogPath,
    ] = args
    if (
      [
        artifactsDir,
        tag,
        owner,
        repo,
        productName,
        version,
        outDir,
        changelogPath,
      ].some(a => !a)
    ) {
      throw new Error(
        'Usage: node scripts/release-assets.cjs finalize <artifactsDir> <tag> <owner> <repo> <productName> <version> <outDir> <changelogPath>'
      )
    }
    runFinalize({
      artifactsDir,
      tag,
      owner,
      repo,
      productName,
      version,
      outDir,
      changelogPath,
    })
  } else {
    throw new Error('Unknown command. Expected "rename" or "finalize".')
  }
} catch (error) {
  console.error(`❌ ${error.message}`)
  process.exit(1)
}
