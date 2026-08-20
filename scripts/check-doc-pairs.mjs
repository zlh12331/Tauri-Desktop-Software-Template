#!/usr/bin/env node
/**
 * 文档双语配对与互链校验。
 *
 * 本项目文档以 `*.en.md` / `*.zh.md` 成对维护（同一路径下同名文件，仅语言后缀
 * 不同）。本脚本负责两条校验，防止精简后文档被某一语言侧单独增删或互链丢失：
 *
 *   1. 配对完整性：遍历 `docs/` 下所有 `*.en.md` / `*.zh.md`，确保每个英文文档
 *      都有对应的中文版本，反之亦然，不允许多出单边文件。
 *   2. 互链双向性：每个文档顶部都有一个指向另一语言版本的语言切换链接
 *      （形如 `[中文](xxx.zh.md)`）。校验英文文档必须链到中文档、中文档必须链到
 *      英文档，且链接目标存在、后缀正确。
 *
 * 退出码：0 = 校验通过；1 = 存在违规（CI 失败）。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, basename, extname } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const docsDir = join(root, 'docs')

/** 递归收集目录下所有 `.md` 文件的相对路径列表。 */
function collectMarkdownFiles(dir, files = [], prefix = '') {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const relPath = prefix ? `${prefix}/${entry}` : entry
    if (statSync(fullPath).isDirectory()) {
      collectMarkdownFiles(fullPath, files, relPath)
    } else if (extname(entry) === '.md') {
      // 会话记录（conversations/）为单语文档，不属于双语配对范围，跳过。
      if (
        entry.toLowerCase() === 'readme.md' ||
        relPath.includes('conversations/')
      ) {
        continue
      }
      files.push(relPath)
    }
  }
  return files
}

/** 语言切换链接正则：`](相对路径.en.md)` 或 `](相对路径.zh.md)`。 */
function languageLinkRe(targetPath) {
  // 匹配任意 markdown 链接，其 URL 部分以目标文件名的 base 结尾。
  return new RegExp(
    String.raw`\]\([^)]*${targetPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\)`
  )
}

// 收集并归类文档
const allFiles = collectMarkdownFiles(docsDir)
const enFiles = new Set(allFiles.filter(f => f.endsWith('.en.md')))
const zhFiles = new Set(allFiles.filter(f => f.endsWith('.zh.md')))

let violations = 0

// ---- 校验 1：配对完整性 ----------------------------------------------------
// 通过把 `.en.md`/`.zh.md` 替换为 `.md` 得到"词条 key"，两边都必须存在。
const enKeys = new Set([...enFiles].map(f => f.replace(/\.en\.md$/, '.md')))
const zhKeys = new Set([...zhFiles].map(f => f.replace(/\.zh\.md$/, '.md')))

const missingZh = [...enKeys]
  .filter(key => !zhKeys.has(key))
  .map(key => `${key}.en.md`)
const missingEn = [...zhKeys]
  .filter(key => !enKeys.has(key))
  .map(key => `${key}.zh.md`)

if (missingZh.length) {
  console.error('✖ 缺少中文版本（需要同样路径下的 .zh.md）：')
  for (const f of missingZh) console.error(`    ${f}`)
  violations++
}
if (missingEn.length) {
  console.error('✖ 缺少英文版本（需要同样路径下的 .en.md）：')
  for (const f of missingEn) console.error(`    ${f}`)
  violations++
}

// ---- 校验 2：互链双向性 ----------------------------------------------------
for (const enPath of enFiles) {
  const zhPath = enPath.replace(/\.en\.md$/, '.zh.md')
  if (!zhFiles.has(zhPath)) continue // 缺配问题已在校验 1 报告

  const zhBase = basename(zhPath)
  const enContent = readFileSync(join(docsDir, enPath), 'utf8')
  const zhContent = readFileSync(join(docsDir, zhPath), 'utf8')

  // 英文档应链到 `xxx.zh.md`
  if (!languageLinkRe(zhBase).test(enContent)) {
    console.error(`✖ [${enPath}] 未包含指向中文版 (${zhBase}) 的语言切换链接`)
    violations++
  }
  // 中文档应链到 `xxx.en.md`
  if (!languageLinkRe(basename(enPath)).test(zhContent)) {
    console.error(
      `✖ [${zhPath}] 未包含指向英文版 (${basename(enPath)}) 的语言切换链接`
    )
    violations++
  }
}

// ---- 汇总 ---------------------------------------------------------------
if (violations === 0) {
  console.log(
    `✓ 文档双语配对完整，互链双向正常（共 ${enFiles.size} 对英文/中文文档）`
  )
} else {
  console.error(`\n✖ 发现 ${violations} 处文档配对/互链违规`)
  process.exit(1)
}
