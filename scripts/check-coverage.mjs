#!/usr/bin/env node
/**
 * Coverage exemption register guard.
 *
 * The Coverage Exemption Register lives in docs/developer/testing.en.md/.zh.md.
 * Those two files are currently absent from the repository, so step 4 warns
 * instead of writing; steps 1-3 (the part CI relies on) do not depend on them.
 * This script closes the drift loop:
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
import { findFloorBreaches, summarize } from './lib/coverage-summary.mjs'

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

const { actual, totals } = summarize(coverage)

// An empty denominator is not full coverage. pct() returns 100 when a total is
// zero, so a renamed field in v8's output would make every metric read 100% and
// the floor check below would pass having measured nothing. Refuse that reading.
for (const metric of ['statements', 'branches', 'functions', 'lines']) {
  if (totals[metric].total === 0) {
    console.error(
      `✖ coverage-final.json contains no '${metric}' entries — ` +
        `an empty denominator is not 100%. Check that the coverage provider ` +
        `output format is what this script expects.`
    )
    process.exit(1)
  }
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
for (const breach of findFloorBreaches(actual, commitments)) {
  console.error(
    `✖ Coverage ${breach.metric} dropped below the documented register floor: ` +
      `${breach.actual}% < ${breach.floor}%. Update the register with evidence if intentional.`
  )
  errors++
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
  let missingRegister = 0
  for (const { file, pattern, replacement } of docs) {
    let content
    try {
      content = readFileSync(file, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') {
        // The floor assertion above still runs; only the doc sync is skipped.
        // Say so instead of quietly doing nothing, which reads as "up to date".
        console.warn(
          `⚠ Register doc missing: ${file} — numbers not written back`
        )
        missingRegister++
        continue
      }
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
  if (missingRegister) {
    console.warn(
      `⚠ ${missingRegister} register doc(s) absent, so the "the doc never drifts" half of this guard is inert. Restore them or drop their paths from this script.`
    )
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
