#!/usr/bin/env node
/**
 * README and CONTRIBUTING number guard.
 *
 * README.md, README.zh.md, CONTRIBUTING.md and docs/CONTRIBUTING.{en,zh}.md
 * hard-code counts. This script keeps them honest against reality:
 *
 *   node scripts/check-readme.mjs --frontend <n> --rust <n> --e2e <n>
 *
 * Two kinds of number, deliberately handled differently:
 *
 * - Structural counts (developer guides, docs files, ast-grep rules, registry
 *   commands, quality gates, integration test files, capability files) are
 *   measured from the tree by `scripts/lib/readme-counts.mjs`. Nobody copies them,
 *   so they cannot go stale while looking plausible.
 * - Suite *case* counts come from CI, from the run that just executed them. They
 *   stay arguments because only a run knows them — a listing does not agree with
 *   the run here (measured: `vitest list` prints 1037 ids for a 1039-test run).
 *
 * Every captured number must equal its expected value, so a stale count fails even
 * when the prose still matches the pattern; a pattern that no longer matches at all
 * fails too, because prose that moved means the guard went blind. `--update`
 * rewrites them.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { measureCounts } from './lib/readme-counts.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else files.push(full)
  }
  return files
}

// Mirrors vitest.config.ts `include`, whose src/ matches are all *.test.* today.
const unitTestFiles = String(
  walk(join(root, 'src')).filter(file => /\.(test|spec)\.[jt]sx?$/.test(file))
    .length
)
// Mirrors playwright config: specs live directly under e2e/.
const e2eSpecFiles = String(
  readdirSync(join(root, 'e2e')).filter(file => file.endsWith('.spec.ts'))
    .length
)

// Structural claims — doc counts, rule counts, registry size — are measured from
// the tree here, so a README number cannot drift from the thing it counts. The
// suite *case* counts below stay arguments: only a test run knows those.
const measured = Object.fromEntries(
  Object.entries(measureCounts(root)).map(([key, value]) => [
    key,
    String(value),
  ])
)

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
      {
        label: 'developer guide count',
        re: /(\d+) bilingual developer guides/,
        expected: [measured.developerDocs],
        replacement: `${measured.developerDocs} bilingual developer guides`,
      },
      {
        label: 'quality gates (engineering row)',
        re: /(\d+)\+ quality gates, three-layer/,
        expected: [measured.qualityGates],
        replacement: `${measured.qualityGates}+ quality gates, three-layer`,
      },
      {
        label: 'quality gates (feature list)',
        re: /\*\*(\d+)\+ quality gates\*\* in `npm run check:all`/,
        expected: [measured.qualityGates],
        replacement: `**${measured.qualityGates}+ quality gates** in \`npm run check:all\``,
      },
      {
        label: 'quality gates (command table)',
        re: /Run all ([\d,]+)\+ quality gates/,
        expected: [measured.qualityGates],
        replacement: `Run all ${measured.qualityGates}+ quality gates`,
      },
      {
        label: 'registry commands (feature list)',
        re: /command registry \((\d+) commands across/,
        expected: [measured.registryCommands],
        replacement: `command registry (${measured.registryCommands} commands across`,
      },
      {
        label: 'registry commands (structure tree)',
        re: /Command registry system \((\d+) commands\)/,
        expected: [measured.registryCommands],
        replacement: `Command registry system (${measured.registryCommands} commands)`,
      },
      {
        label: 'e2e scenarios and specs (feature list)',
        re: /(\d+) Playwright scenarios across (\d+) spec files/,
        expected: [e2e, String(e2eSpecFiles)],
        replacement: `${e2e} Playwright scenarios across ${e2eSpecFiles} spec files`,
      },
      {
        label: 'e2e spec files (structure tree)',
        re: /(\d+) Playwright E2E test files/,
        expected: [String(e2eSpecFiles)],
        replacement: `${e2eSpecFiles} Playwright E2E test files`,
      },
      {
        label: 'rust integration test files',
        re: /(\d+) integration test files/,
        expected: [measured.rustIntegrationTests],
        replacement: `${measured.rustIntegrationTests} integration test files`,
      },
      {
        label: 'capability files',
        re: /(\d+) capability files/,
        expected: [measured.capabilityFiles],
        replacement: `${measured.capabilityFiles} capability files`,
      },
      {
        label: 'docs file count',
        re: /Bilingual documentation \(en \+ zh, (\d+) files\)/,
        expected: [measured.docsMarkdownFiles],
        replacement: `Bilingual documentation (en + zh, ${measured.docsMarkdownFiles} files)`,
      },
      {
        label: 'ast rule count',
        re: /(\d+) AST rules are enforced in CI/,
        expected: [measured.astRules],
        replacement: `${measured.astRules} AST rules are enforced in CI`,
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
      {
        label: 'registry commands (feature list)',
        re: /由统一命令注册表驱动（(\d+) 个命令/,
        expected: [measured.registryCommands],
        replacement: `由统一命令注册表驱动（${measured.registryCommands} 个命令`,
      },
      {
        label: 'registry commands (structure tree)',
        re: /命令注册表系统（(\d+) 个命令）/,
        expected: [measured.registryCommands],
        replacement: `命令注册表系统（${measured.registryCommands} 个命令）`,
      },
      {
        label: 'e2e scenarios and specs (feature list)',
        re: /(\d+) 个 Playwright 场景、(\d+) 个测试文件/,
        expected: [e2e, String(e2eSpecFiles)],
        replacement: `${e2e} 个 Playwright 场景、${e2eSpecFiles} 个测试文件`,
      },
      {
        label: 'e2e spec files (structure tree)',
        re: /(\d+) 个 Playwright E2E 测试文件/,
        expected: [String(e2eSpecFiles)],
        replacement: `${e2eSpecFiles} 个 Playwright E2E 测试文件`,
      },
      {
        label: 'rust integration test files',
        re: /(\d+) 个集成测试文件/,
        expected: [measured.rustIntegrationTests],
        replacement: `${measured.rustIntegrationTests} 个集成测试文件`,
      },
      {
        label: 'capability files',
        re: /(\d+) 个能力配置文件/,
        expected: [measured.capabilityFiles],
        replacement: `${measured.capabilityFiles} 个能力配置文件`,
      },
      {
        label: 'docs file count',
        re: /双语文档（en \+ zh，(\d+) 个文件）/,
        expected: [measured.docsMarkdownFiles],
        replacement: `双语文档（en + zh，${measured.docsMarkdownFiles} 个文件）`,
      },
      {
        label: 'ast rule count',
        re: /(\d+) 条 AST 规则在 CI 中强制执行/,
        expected: [measured.astRules],
        replacement: `${measured.astRules} 条 AST 规则在 CI 中强制执行`,
      },
      {
        label: 'quality gates (engineering row)',
        re: /(\d+)\+ 质量门禁、三层/,
        expected: [measured.qualityGates],
        replacement: `${measured.qualityGates}+ 质量门禁、三层`,
      },
      {
        label: 'quality gates (feature list)',
        re: /\*\*(\d+)\+ 质量门禁\*\* 集成在/,
        expected: [measured.qualityGates],
        replacement: `**${measured.qualityGates}+ 质量门禁** 集成在`,
      },
      {
        label: 'quality gates (command table)',
        re: /运行全部 ([\d,]+)\+ 质量门禁/,
        expected: [measured.qualityGates],
        replacement: `运行全部 ${measured.qualityGates}+ 质量门禁`,
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
  {
    // The root file is the one GitHub renders for contributors, so its claims get
    // the same treatment as README's.
    file: 'CONTRIBUTING.md',
    rules: [
      {
        label: 'frontend count',
        re: /Vitest unit tests \(([\d,]+) tests\)/,
        expected: [frontend],
        replacement: `Vitest unit tests (${frontend} tests)`,
      },
      {
        label: 'e2e count',
        re: /Playwright E2E tests \(([\d,]+) scenarios\)/,
        expected: [e2e],
        replacement: `Playwright E2E tests (${e2e} scenarios)`,
      },
      {
        label: 'rust count',
        re: /Rust tests \(([\d,]+) tests\)/,
        expected: [rust],
        replacement: `Rust tests (${rust} tests)`,
      },
      {
        label: 'unit suite size',
        re: /([\d,]+) tests across (\d+) test files/,
        expected: [frontend, unitTestFiles],
        replacement: `${frontend} tests across ${unitTestFiles} test files`,
      },
      {
        label: 'e2e spec count',
        re: /(\d+) test files covering all major features/,
        expected: [e2eSpecFiles],
        replacement: `${e2eSpecFiles} test files covering all major features`,
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
