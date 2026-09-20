#!/usr/bin/env node
/**
 * Test-count guard.
 *
 * README.md, README.zh.md and docs/CONTRIBUTING.{en,zh}.md hard-code suite sizes.
 * This script keeps them honest against the numbers CI measured:
 *
 *   node scripts/check-readme.mjs --frontend <n> --rust <n> --e2e <n>
 *
 * Every captured number must equal the value passed in, so a stale count fails even
 * when the surrounding prose still matches the pattern. `--update` rewrites them.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 ? process.argv[i + 1] : undefined
}

const frontend = arg('frontend')
const rust = arg('rust')
const e2e = arg('e2e')
const update = process.argv.includes('--update')

if (!frontend || !rust || !e2e) {
  console.error(
    '✖ Usage: node scripts/check-readme.mjs --frontend <n> --rust <n> --e2e <n> [--update]'
  )
  process.exit(1)
}

if ([frontend, rust, e2e].some(v => !/^\d+$/.test(v))) {
  console.error('✖ --frontend, --rust and --e2e must all be plain integers')
  process.exit(1)
}

// READMEs use "1,234" comma-formatted totals; contributors write bare part counts.
const total = (Number(frontend) + Number(rust) + Number(e2e)).toLocaleString(
  'en-US'
)
const digits = value => value.replaceAll(',', '')

/**
 * Each rule is one number-bearing pattern plus the values it must contain.
 * `replacement` is only used by --update.
 */
const docs = [
  {
    file: 'README.md',
    rules: [
      {
        label: 'total test count',
        re: /\*\*([\d,]+) tests\*\*/,
        expected: [total],
        replacement: `**${total} tests**`,
      },
      {
        label: 'frontend/rust/e2e breakdown',
        re: /([\d,]+) frontend \+ (\d+) Rust \+ (\d+) E2E/,
        expected: [frontend, rust, e2e],
        replacement: `${frontend} frontend + ${rust} Rust + ${e2e} E2E`,
      },
      {
        label: 'frontend count',
        re: /Vitest unit tests \(([\d,]+) tests\)/,
        expected: [frontend],
        replacement: `Vitest unit tests (${frontend} tests)`,
      },
      {
        label: 'rust count',
        re: /Rust tests \(([\d,]+) tests\)/,
        expected: [rust],
        replacement: `Rust tests (${rust} tests)`,
      },
      {
        label: 'e2e count',
        re: /Playwright E2E tests \(([\d,]+) scenarios\)/,
        expected: [e2e],
        replacement: `Playwright E2E tests (${e2e} scenarios)`,
      },
    ],
  },
  {
    file: 'README.zh.md',
    rules: [
      {
        label: 'total test count',
        re: /\*\*([\d,]+) 个测试\*\*/,
        expected: [total],
        replacement: `**${total} 个测试**`,
      },
      {
        label: 'frontend/rust/e2e breakdown',
        re: /([\d,]+) 前端 \+ (\d+) Rust \+ (\d+) E2E/,
        expected: [frontend, rust, e2e],
        replacement: `${frontend} 前端 + ${rust} Rust + ${e2e} E2E`,
      },
      {
        label: 'frontend count',
        re: /Vitest 单元测试（([\d,]+) 个）/,
        expected: [frontend],
        replacement: `Vitest 单元测试（${frontend} 个）`,
      },
      {
        label: 'rust count',
        re: /Rust 测试（([\d,]+) 个）/,
        expected: [rust],
        replacement: `Rust 测试（${rust} 个）`,
      },
      {
        label: 'e2e count',
        re: /Playwright E2E 测试（([\d,]+) 个场景）/,
        expected: [e2e],
        replacement: `Playwright E2E 测试（${e2e} 个场景）`,
      },
    ],
  },
  {
    file: 'docs/CONTRIBUTING.en.md',
    rules: [
      {
        label: 'frontend count',
        re: /Vitest unit tests \(([\d,]+) tests\)/,
        expected: [frontend],
        replacement: `Vitest unit tests (${frontend} tests)`,
      },
      {
        label: 'rust count',
        re: /Rust `cargo test` \(([\d,]+) tests\)/,
        expected: [rust],
        replacement: `Rust \`cargo test\` (${rust} tests)`,
      },
      {
        label: 'e2e count',
        re: /Playwright E2E \(([\d,]+) scenarios\)/,
        expected: [e2e],
        replacement: `Playwright E2E (${e2e} scenarios)`,
      },
    ],
  },
  {
    file: 'docs/CONTRIBUTING.zh.md',
    rules: [
      {
        label: 'frontend count',
        re: /Vitest 单元测试（([\d,]+) 个测试）/,
        expected: [frontend],
        replacement: `Vitest 单元测试（${frontend} 个测试）`,
      },
      {
        label: 'rust count',
        re: /Rust `cargo test`（([\d,]+) 个测试）/,
        expected: [rust],
        replacement: `Rust \`cargo test\`（${rust} 个测试）`,
      },
      {
        label: 'e2e count',
        re: /Playwright E2E（([\d,]+) 个场景）/,
        expected: [e2e],
        replacement: `Playwright E2E（${e2e} 个场景）`,
      },
    ],
  },
]

const hint = `node scripts/check-readme.mjs --frontend ${frontend} --rust ${rust} --e2e ${e2e} --update`
let errors = 0

for (const doc of docs) {
  let content = readFileSync(join(root, doc.file), 'utf8')
  let changed = false

  for (const rule of doc.rules) {
    const match = rule.re.exec(content)

    if (!match) {
      console.error(
        `✖ [${doc.file}] no "${rule.label}" pattern found — the prose changed, so the guard went blind. Restore it or update this script.`
      )
      errors++
      continue
    }

    const found = match.slice(1)
    const stale =
      found.length !== rule.expected.length ||
      found.some((v, i) => digits(v) !== digits(rule.expected[i]))

    if (!stale) continue

    if (update) {
      content = content.replace(rule.re, rule.replacement)
      changed = true
    } else {
      console.error(
        `✖ [${doc.file}] ${rule.label} says ${found.join(' + ')}, expected ${rule.expected.join(' + ')}. Run: ${hint}`
      )
      errors++
    }
  }

  if (changed) {
    writeFileSync(join(root, doc.file), content, 'utf8')
    console.log(`✓ Updated test counts in ${doc.file}`)
  }
}

if (update) {
  console.log(
    'ℹ Re-run without --update to verify; the numbers in the files above were rewritten.'
  )
} else if (errors) {
  console.error(`\n✖ ${errors} test count(s) out of date`)
  process.exit(1)
} else {
  console.log(
    `✓ Test counts match across README and CONTRIBUTING (${total} total: ${frontend} frontend + ${rust} Rust + ${e2e} E2E)`
  )
}
