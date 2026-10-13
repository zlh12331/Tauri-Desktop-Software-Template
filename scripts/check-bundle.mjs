#!/usr/bin/env node
/**
 * Bundle size and build-artifact gate.
 *
 * Nothing else in this repository measures what a user has to download and
 * parse. Dependency growth is invisible in review — a bumped package that adds
 * 90 kB of gzip touches one lockfile line — and Tauri's reason to exist over an
 * Electron baseline is a small, fast artifact, so the number that argues for the
 * stack is the number with no gate on it.
 *
 * This script also checks the thing the React Compiler pipeline can get wrong
 * silently: `@rolldown/plugin-babel` accepts the compiler preset whether or not
 * the plugin resolves, so a missing optional dependency produces a normal build
 * with no memoization and no message. The compiler's
 * `Symbol.for('react.memo_cache_sentinel')` survives minification, so its
 * presence in `dist` is direct evidence the pass ran.
 *
 * Budgets live in scripts/lib/bundle-metrics.mjs next to the measured baseline
 * and only rise in a change that explains itself.
 *
 * Prerequisite: `npm run build` (this reads dist/, it does not build).
 * Exit code 0 = within budget, 1 = breach, missing dist, or map residue.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { gzipSync } from 'node:zlib'
import {
  BUDGETS,
  COMPILER_MIN_HITS,
  COMPILER_SENTINEL,
  COMPILER_WARN_HITS,
  findBudgetBreaches,
  findMapResidue,
  isDistPopulated,
  measure,
} from './lib/bundle-metrics.mjs'

const root = process.cwd()
const distDir = join(root, 'dist')
const assetsDir = join(distDir, 'assets')

if (!existsSync(assetsDir)) {
  console.error(
    '✖ dist/assets is missing — run `npm run build` before this check.\n' +
      '  Refusing to read an absent build as a zero-byte one.'
  )
  process.exit(1)
}

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (statSync(full).isFile()) out.push(full)
  }
  return out
}

const files = walk(distDir)
const entries = files.map(full => {
  const bytes = readFileSync(full)
  return {
    name: relative(assetsDir, full).split(sep).join('/'),
    bytes: bytes.length,
    gzip: gzipSync(bytes, { level: 9 }).length,
    isAsset: !relative(assetsDir, full).startsWith('..'),
  }
})

const assets = entries.filter(e => e.isAsset)
const metrics = measure(assets)

// --- report ---------------------------------------------------------------
console.log(
  `Bundle: ${metrics.jsCount} JS + ${metrics.cssCount} CSS assets in dist/`
)
const ranked = [...assets]
  .filter(e => /\.(js|css)$/.test(e.name))
  .sort((a, b) => b.gzip - a.gzip)
const width = Math.max(...ranked.map(e => e.name.length))
for (const e of ranked) {
  const share = metrics.distGzipTotal
    ? ((e.gzip / metrics.distGzipTotal) * 100).toFixed(1)
    : '0.0'
  console.log(
    `  ${e.name.padEnd(width)}  ${(e.gzip / 1024).toFixed(1).padStart(8)} KiB gzip  ${share}%`
  )
}

const violations = []

// --- 1. maps must never ship -------------------------------------------
// Tauri embeds every file under frontendDist into the binary. A .map that
// survives the Sentry upload lands in every user's install; vite.config.ts keeps
// maps off unless the same build can hand them away, and this is the check that
// says whether that held.
const maps = findMapResidue(entries)
if (maps.length > 0) {
  violations.push(
    `source maps present in dist/ (${maps.join(', ')}). They are embedded into ` +
      'the shipped binary — build with VITE_SENTRY_DSN + SENTRY_AUTH_TOKEN so the ' +
      'plugin deletes them after upload, or delete them here.'
  )
}

// --- 2. empty build is not a passing build -------------------------------
if (!isDistPopulated(metrics)) {
  violations.push(
    `dist/assets has ${metrics.jsCount} JS and ${metrics.cssCount} CSS files — ` +
      'a build that produced nothing measures 0 bytes against every budget.'
  )
}

// --- 3. budgets ----------------------------------------------------------
for (const breach of findBudgetBreaches(metrics, BUDGETS)) {
  violations.push(
    `${breach.key} is ${(breach.actual / 1024).toFixed(1)} KiB gzip, over the ` +
      `${(breach.ceiling / 1024).toFixed(1)} KiB budget by ` +
      `${((breach.actual - breach.ceiling) / 1024).toFixed(1)} KiB.`
  )
}

// --- 4. React Compiler actually ran --------------------------------------
const jsText = assets
  .filter(e => e.name.endsWith('.js'))
  .map(e => readFileSync(join(assetsDir, e.name), 'utf8'))
  .join('')
const sentinelHits = jsText.split(COMPILER_SENTINEL).length - 1

if (sentinelHits < COMPILER_MIN_HITS) {
  violations.push(
    `no '${COMPILER_SENTINEL}' marker in the built JS: React Compiler produced no ` +
      'memo caches. Check that babel-plugin-react-compiler resolves — the babel ' +
      'preset option is accepted even when the plugin is absent, so the build ' +
      'succeeds and simply stops memoizing.'
  )
} else if (sentinelHits < COMPILER_WARN_HITS) {
  console.log(
    `⚠ React Compiler produced ${sentinelHits} memo sites (baseline 59). ` +
      'Not a failure, but worth confirming the pass covered the tree.'
  )
} else {
  console.log(
    `✓ React Compiler emitted ${sentinelHits} memo-cache sites into the built JS`
  )
}

// --- verdict -------------------------------------------------------------
console.log(
  `\nBudget: JS ${(metrics.jsGzip / 1024).toFixed(1)} / ${(BUDGETS.jsGzip / 1024).toFixed(1)} KiB · ` +
    `CSS ${(metrics.cssGzip / 1024).toFixed(1)} / ${(BUDGETS.cssGzip / 1024).toFixed(1)} · ` +
    `largest chunk ${(metrics.largestChunkGzip / 1024).toFixed(1)} / ${(BUDGETS.largestChunkGzip / 1024).toFixed(1)} · ` +
    `quick-pane JS ${(metrics.quickPaneJsGzip / 1024).toFixed(1)} / ${(BUDGETS.quickPaneJsGzip / 1024).toFixed(1)} · ` +
    `dist total ${(metrics.distGzipTotal / 1024).toFixed(1)} / ${(BUDGETS.distGzipTotal / 1024).toFixed(1)} KiB`
)

if (violations.length > 0) {
  console.error('')
  for (const v of violations) console.error(`✖ ${v}`)
  console.error(
    '\nRaise a ceiling in scripts/lib/bundle-metrics.mjs only with a reason in ' +
      'the change that does it — the baseline comment is the review surface.'
  )
  process.exit(1)
}

console.log('✓ Bundle within budget')
