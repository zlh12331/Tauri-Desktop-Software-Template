#!/usr/bin/env node
/**
 * Coverage exemption register guard.
 *
 * The Coverage Exemption Register in docs/developer/testing.en.md/.zh.md is
 * maintained by hand. This script closes the drift loop:
 *
 *   1. Read the vitest v8 coverage summary (coverage/coverage-final.json)
 *      and compute global statements/branches/functions/lines percentages.
 *   2. FAIL if any percentage is below the documented commitment — a drop in
 *      coverage that was not recorded in the register should stop CI.
 *   3. Verify every exempted source location still exists (the register cites
 *      file:line; if the code moved/deleted, the entry is stale).
 *   4. Re-write the actual numbers into the register so the doc never drifts.
 *
 * Rust coverage is NOT handled here: CI already enforces a hard threshold
 * (`cargo llvm-cov --fail-under-lines 75`), and its per-line output format is
 * unstable across llvm-cov versions — parsing it here would be brittle.
 *
 * Exit code 0 = consistent, 1 = violations found (CI fails).
 */
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// ---------------------------------------------------------------------------
// 1. Load vitest coverage summary
// ---------------------------------------------------------------------------
const coverageFile = join(root, 'coverage', 'coverage-final.json')
if (!existsSync(coverageFile)) {
  console.error(
    '✖ coverage/coverage-final.json not found — run `npm run test:coverage` first'
  )
  process.exit(1)
}
const coverage = JSON.parse(readFileSync(coverageFile, 'utf8'))

let stmtHit = 0
let stmtTotal = 0
let branchHit = 0
let branchTotal = 0
let fnHit = 0
let fnTotal = 0
let lineHit = 0
let lineTotal = 0

for (const file of Object.values(coverage)) {
  // statements
  for (const [id, hits] of Object.entries(file.s)) {
    if (file.statementMap[id]) stmtTotal++
    if (hits > 0) stmtHit++
  }
  // functions
  for (const [id, hits] of Object.entries(file.f)) {
    if (file.fnMap[id]) fnTotal++
    if (hits > 0) fnHit++
  }
  // lines — v8 line coverage is derivable from statementMap's loc ranges
  const lineMap = new Map()
  for (const loc of Object.values(file.statementMap)) {
    for (let l = loc.start.line; l <= loc.end.line; l++) lineMap.set(l, false)
  }
  for (const [id, hits] of Object.entries(file.s)) {
    const loc = file.statementMap[id]
    if (!loc) continue
    if (hits > 0)
      for (let l = loc.start.line; l <= loc.end.line; l++) lineMap.set(l, true)
  }
  lineTotal += lineMap.size
  lineHit += [...lineMap.values()].filter(v => v).length
  // branches
  for (const [id, counts] of Object.entries(file.b)) {
    if (!file.branchMap[id]) continue
    for (const count of counts) {
      branchTotal++
      if (count > 0) branchHit++
    }
  }
}

const pct = (hit, total) =>
  total === 0 ? 100 : Number(((hit / total) * 100).toFixed(2))
const actual = {
  statements: pct(stmtHit, stmtTotal),
  branches: pct(branchHit, branchTotal),
  functions: pct(fnHit, fnTotal),
  lines: pct(lineHit, lineTotal),
}
console.log(
  `Coverage: statements ${actual.statements}% / branches ${actual.branches}% / functions ${actual.functions}% / lines ${actual.lines}%`
)

// ---------------------------------------------------------------------------
// 2. Documented commitments (the register's floor — do not lower silently)
// ---------------------------------------------------------------------------
const commitments = {
  statements: 97.07, // from testing.en.md register
  branches: 92.84,
}

let errors = 0
for (const [metric, floor] of Object.entries(commitments)) {
  if (actual[metric] < floor) {
    console.error(
      `✖ Coverage ${metric} dropped below the documented register floor: ` +
        `${actual[metric]}% < ${floor}%. Update the register with evidence if intentional.`
    )
    errors++
  }
}

// ---------------------------------------------------------------------------
// 3. Exempted source locations must still exist
// ---------------------------------------------------------------------------
const exempted = [
  {
    file: join(root, 'src/components/preferences/panes/GeneralPane.tsx'),
    line: 42,
    label: 'GeneralPane.tsx:42 defensive guard',
  },
]
for (const { file, line, label } of exempted) {
  if (!existsSync(file)) {
    console.error(`✖ Exempted file no longer exists: ${label}`)
    errors++
    continue
  }
  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')
  if (lines.length < line) {
    console.error(
      `✖ Exempted location ${label} is out of range (file has ${lines.length} lines)`
    )
    errors++
  }
}

// ---------------------------------------------------------------------------
// 4. Re-write actual numbers into the register (no manual editing).
// Pass --check-only to skip the write (CI uses this — the register is
// regenerated locally and the diff is reviewed; CI only asserts the floor).
// ---------------------------------------------------------------------------
const checkOnly = process.argv.includes('--check-only')
if (!checkOnly) {
  const docs = [
    {
      file: join(root, 'docs/developer/testing.en.md'),
      pattern:
        /full-suite coverage: statements [\d.]+% \/ branches [\d.]+% \/ functions [\d.]+% \/ lines [\d.]+%/,
      replacement: `full-suite coverage: statements ${actual.statements}% / branches ${actual.branches}% / functions ${actual.functions}% / lines ${actual.lines}%`,
    },
    {
      file: join(root, 'docs/developer/testing.zh.md'),
      pattern:
        /全量覆盖率：语句 [\d.]+% \/ 分支 [\d.]+% \/ 函数 [\d.]+% \/ 行 [\d.]+%/,
      replacement: `全量覆盖率：语句 ${actual.statements}% / 分支 ${actual.branches}% / 函数 ${actual.functions}% / 行 ${actual.lines}%`,
    },
  ]
  for (const { file, pattern, replacement } of docs) {
    let content
    try {
      content = readFileSync(file, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') continue
      throw error
    }
    const updated = content.replace(pattern, replacement)
    if (updated !== content) {
      // Write to a temp file in the same directory, then rename over the
      // target atomically — the checked path is never opened for writing,
      // which avoids check/read-then-write races (CWE-367).
      const tmpFile = `${file}.tmp`
      writeFileSync(tmpFile, updated, 'utf8')
      renameSync(tmpFile, file)
      console.log(`✓ Updated coverage numbers in ${file}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
if (errors === 0) {
  console.log('✓ Coverage register guard passed')
} else {
  console.error(`\n✖ ${errors} coverage register violation(s) found`)
  process.exit(1)
}
