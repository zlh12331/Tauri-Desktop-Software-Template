#!/usr/bin/env node
/**
 * npm audit gate with documented exemptions.
 *
 * `npm audit --audit-level=high` cannot be satisfied by upgrades alone: some
 * advisories have no patched release yet, and npm reports every package that
 * depends on one as equally vulnerable, so a single unfixable leaf reddens the
 * whole chain. This script keeps the gate honest instead of turning it off:
 *
 *   1. Read `npm audit --json`.
 *   2. Drop advisories listed in IGNORED below (each carries a written reason,
 *      the same contract deny.toml uses for RustSec exemptions).
 *   3. Recompute each package's effective severity from what is LEFT, so a
 *      package that was only "high" because of braces falls back to the
 *      severity of its remaining causes rather than disappearing silently.
 *   4. FAIL if any package still reaches the threshold severity.
 *
 * Pass-through args go to `npm audit`, so a machine whose npm registry proxy
 * has no audit endpoint can still run this against the public one:
 *   node scripts/check-audit.mjs --registry=https://registry.npmjs.org
 *
 * Exit code 0 = only documented exemptions outstanding, 1 = threshold breach
 * (or the audit endpoint failed).
 */
import { execFileSync } from 'node:child_process'

/**
 * Advisory exemptions. Removing an entry here re-enables the gate for that
 * chain, so this list is the review surface: delete it as soon as upstream
 * ships a patched version.
 */
const IGNORED = [
  {
    ghsa: 'GHSA-vfj7-8cjw-p6xm',
    pkg: 'braces',
    reason:
      'No patched release exists: the advisory covers <= 3.0.3 and 3.0.3 is the newest published version, while micromatch 4.0.8 pins braces ^3.0.3. Reachable only through markdownlint-cli2 (globby -> fast-glob -> micromatch), i.e. the docs lint, not the shipped app. Re-check when a 3.0.4 or a micromatch that drops braces appears.',
    reviewBy: '2027-01',
  },
]

const THRESHOLD = 'high'
// `none` must be a real rank: comparing against undefined made every
// `severity > worst` test false, so nothing ever registered as vulnerable.
const RANK = { none: 0, info: 0, low: 1, moderate: 2, high: 3, critical: 4 }
const ignoredAdvisories = new Map(IGNORED.map(e => [e.ghsa, e]))

function audit() {
  // Passthrough args (e.g. --registry=...) reach a shell on Windows, so keep
  // them to a boring --key=value charset rather than trusting arbitrary input.
  const extra = process.argv.slice(2)
  for (const arg of extra) {
    if (!/^--[\w.-]+=[\w.:/@-]+$/.test(arg)) {
      console.error(`refusing unexpected argument: ${arg}`)
      process.exit(1)
    }
  }
  try {
    return JSON.parse(
      execFileSync('npm', ['audit', '--json', ...extra], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        // npm is a .cmd shim on Windows and Node refuses to spawn one without a shell.
        shell: process.platform === 'win32',
      })
    )
  } catch (err) {
    const body = err.stdout ? String(err.stdout) : ''
    if (body.trim().startsWith('{')) return JSON.parse(body)
    console.error('npm audit failed to run:', err.message)
    process.exit(1)
  }
}

const vulns = audit().vulnerabilities ?? {}
const ghsaOf = url => (url ?? '').split('/').pop()

/** Effective severity of a package once exempted advisories are removed. */
function effective(pkg, seen = new Set()) {
  if (seen.has(pkg) || !(pkg in vulns)) return 'none'
  seen.add(pkg)
  let worst = 'none'
  for (const via of vulns[pkg].via ?? []) {
    const severity =
      typeof via === 'string'
        ? effective(via, seen)
        : ignoredAdvisories.has(ghsaOf(via.url))
          ? 'none'
          : via.severity
    if (RANK[severity] > RANK[worst]) worst = severity
  }
  seen.delete(pkg)
  return worst
}

const outstanding = []
const exempted = new Set()
for (const pkg of Object.keys(vulns)) {
  if (RANK[effective(pkg)] >= RANK[THRESHOLD]) outstanding.push(pkg)
  for (const via of vulns[pkg].via ?? []) {
    const entry = ignoredAdvisories.get(
      ghsaOf(typeof via === 'string' ? '' : via.url)
    )
    if (entry) exempted.add(`${entry.pkg}@${vulns[entry.pkg]?.range ?? '?'}`)
  }
}

console.log(`npm audit gate: threshold >= ${THRESHOLD}`)
for (const entry of IGNORED) {
  const hit = entry.pkg in vulns
  console.log(
    `\n${hit ? 'EXEMPT' : 'STALE'}  ${entry.ghsa}  ${entry.pkg}\n` +
      `  reason: ${entry.reason}\n` +
      `  review by: ${entry.reviewBy}` +
      (hit
        ? ''
        : '\n  note: advisory no longer reported — delete this exemption.')
  )
}

if (outstanding.length > 0) {
  console.error(
    `\n${outstanding.length} package(s) still at or above ${THRESHOLD}:`
  )
  for (const pkg of outstanding) {
    console.error(`  ${effective(pkg)}  ${pkg}  (${vulns[pkg].range})`)
  }
  console.error(
    '\nUpgrade them, or add a reviewed exemption above with a reason.'
  )
  process.exit(1)
}

console.log('\nNo unexempted package reaches the threshold.')
