#!/usr/bin/env node
/**
 * README test-count guard.
 *
 * The README hard-codes test counts (frontend / Rust / E2E). This script
 * prevents them from silently drifting when the suite grows:
 *
 *   - CI passes the actual counts: `node scripts/check-readme.mjs
 *     --frontend <n> --rust <n> [--e2e <n>]` — fails if README doesn't match.
 *   - Locally, `--update` rewrites the README numbers first.
 *
 * README.md and README.zh.md are both checked.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 ? process.argv[i + 1] : undefined
}

const frontend = arg('frontend')
const rust = arg('rust')
const e2e = arg('e2e') ?? '16'
const update = process.argv.includes('--update')

if (!frontend || !rust) {
  console.error(
    '✖ Usage: node scripts/check-readme.mjs --frontend <n> --rust <n> [--e2e <n>] [--update]'
  )
  process.exit(1)
}

// README uses "1,234" comma-formatted totals and bare counts for parts.
const total = (Number(frontend) + Number(rust) + Number(e2e)).toLocaleString(
  'en-US'
)

const docs = [
  {
    file: join(root, 'README.md'),
    isZh: false,
    totalRe: /\*\*1,\d+ tests\*\*/,
    totalNew: `**${total} tests**`,
    partsRe: /(\d+(?:,\d+)?) frontend \+ (\d+) Rust \+ (\d+) E2E/,
    frontendRe: /Vitest unit tests \((\d+) tests\)/,
    rustRe: /Rust tests \((\d+) tests\)/,
    e2eRe: /Playwright E2E tests \((\d+) scenarios\)/,
  },
  {
    file: join(root, 'README.zh.md'),
    isZh: true,
    totalRe: /\*\*1,\d+ 个测试\*\*/,
    totalNew: `**${total} 个测试**`,
    partsRe: /(\d+(?:,\d+)?) 前端 \+ (\d+) Rust \+ (\d+) E2E/,
    frontendRe: /Vitest 单元测试（(\d+) 个）/,
    rustRe: /Rust 测试（(\d+) 个）/,
    e2eRe: /Playwright E2E 测试（(\d+) 个场景）/,
  },
]

let errors = 0
for (const doc of docs) {
  let content = readFileSync(doc.file, 'utf8')
  let changed = false
  const fileLabel = doc.file.replace(root + '/', '')

  if (update) {
    const replacements = doc.isZh
      ? [
          [doc.totalRe, doc.totalNew],
          [doc.partsRe, () => `${frontend} 前端 + ${rust} Rust + ${e2e} E2E`],
          [doc.frontendRe, () => `Vitest 单元测试（${frontend} 个）`],
          [doc.rustRe, () => `Rust 测试（${rust} 个）`],
          [doc.e2eRe, () => `Playwright E2E 测试（${e2e} 个场景）`],
        ]
      : [
          [doc.totalRe, doc.totalNew],
          [
            doc.partsRe,
            () => `${frontend} frontend + ${rust} Rust + ${e2e} E2E`,
          ],
          [doc.frontendRe, () => `Vitest unit tests (${frontend} tests)`],
          [doc.rustRe, () => `Rust tests (${rust} tests)`],
          [doc.e2eRe, () => `Playwright E2E tests (${e2e} scenarios)`],
        ]
    for (const [re, replacement] of replacements) {
      if (re.test(content)) {
        content = content.replace(re, replacement)
        changed = true
      }
    }
    if (changed) {
      writeFileSync(doc.file, content, 'utf8')
      console.log(`✓ Updated test counts in ${fileLabel}`)
    }
  } else {
    const checks = [
      [doc.totalRe, `total test count`],
      [doc.partsRe, `frontend/rust/e2e breakdown`],
      [doc.frontendRe, `frontend count`],
      [doc.rustRe, `rust count`],
      [doc.e2eRe, `e2e count`],
    ]
    for (const [re, label] of checks) {
      if (!re.test(content)) {
        console.error(
          `✖ [${fileLabel}] README ${label} is out of date. Run: node scripts/check-readme.mjs --frontend ${frontend} --rust ${rust} --e2e ${e2e} --update`
        )
        errors++
      }
    }
  }
}

if (!update) {
  if (errors === 0) {
    console.log(
      `✓ README test counts match (${total} total: ${frontend} frontend + ${rust} Rust + ${e2e} E2E)`
    )
  } else {
    console.error(`\n✖ ${errors} README count(s) out of date`)
    process.exit(1)
  }
}
