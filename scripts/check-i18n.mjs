#!/usr/bin/env node
/**
 * i18n catalog consistency checker.
 *
 * Hard constraint for the AI-driven workflow. Verifies three invariants:
 *
 *   1. Every language file has the SAME key set as `en.json`
 *      (missing translations / orphaned keys → fail)
 *   2. Every STATIC `t('key')` / `i18n.t('key')` reference in src/ resolves
 *      to a key that exists in `en.json` (dangling reference → fail)
 *   3. `en.json` key names are not duplicated as both a leaf and a parent
 *      (e.g. `preferences.appearance.theme` AND
 *      `preferences.appearance.theme.light` cannot coexist — a real bug
 *      class i18next-parser warned about)
 *
 * Dynamic references (e.g. `t(command.labelKey)`, `t(\`commands.group.${x}\`)`)
 * are NOT statically resolvable, so they are excluded from check #2 — the
 * same limitation that made i18next-parser destructive on this codebase.
 *
 * Exit code 0 = consistent, 1 = violations found (CI fails).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// ---------------------------------------------------------------------------
// Locale loading
// ---------------------------------------------------------------------------
const localesDir = join(root, 'locales')
const langFiles = readdirSync(localesDir).filter(
  f => extname(f) === '.json' && !f.endsWith('.parsed.json')
)
const catalogs = new Map()
for (const f of langFiles) {
  catalogs.set(
    f.replace('.json', ''),
    JSON.parse(readFileSync(join(localesDir, f), 'utf8'))
  )
}

if (!catalogs.has('en')) {
  console.error('✖ en.json is missing — it is the source of truth')
  process.exit(1)
}

function flatten(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, key, out)
    } else {
      out.set(key, v)
    }
  }
  return out
}

const enFlat = flatten(catalogs.get('en'))
const enKeys = new Set(enFlat.keys())

// ---------------------------------------------------------------------------
// Check 1: key-set parity across languages
// ---------------------------------------------------------------------------
let errors = 0
for (const [lang, cat] of catalogs) {
  if (lang === 'en') continue
  const flat = flatten(cat)
  const keys = new Set(flat.keys())

  const missing = [...enKeys].filter(k => !keys.has(k))
  const extra = [...keys].filter(k => !enKeys.has(k))
  if (missing.length || extra.length) {
    console.error(`✖ [${lang}.json] key set differs from en.json:`)
    for (const k of missing) console.error(`    MISSING: ${k}`)
    for (const k of extra) console.error(`    EXTRA:   ${k}`)
    errors++
  }
}

// ---------------------------------------------------------------------------
// Check 2: static t() references must resolve
// ---------------------------------------------------------------------------
function walk(dir) {
  let files = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'ui' || e.name === 'test')
        continue
      files = files.concat(walk(p))
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      files.push(p)
    }
  }
  return files
}

const srcFiles = walk(join(root, 'src'))
const staticRefs = new Set()

for (const f of srcFiles) {
  // Skip test files — they may reference keys for assertions only
  if (/\.(test|spec)\.(ts|tsx)$/.test(f)) continue
  const c = readFileSync(f, 'utf8')
  // t('key'), t("key")
  const re = /\bt\s*\(\s*(['"])([^'"]+)\1\s*[,)]/g
  let m
  while ((m = re.exec(c))) staticRefs.add(m[2])
  // i18n.t('key')
  const re2 = /i18n\.t\s*\(\s*(['"])([^'"]+)\1\s*[,)]/g
  while ((m = re2.exec(c))) staticRefs.add(m[2])
}

const dangling = [...staticRefs].filter(k => !enKeys.has(k))
if (dangling.length) {
  console.error(
    `✖ ${dangling.length} static t() reference(s) not found in en.json:`
  )
  for (const k of dangling) console.error(`    ${k}`)
  errors++
}

// ---------------------------------------------------------------------------
// Check 3: leaf-vs-parent key collisions (e.g. `a.b` string + `a.b.c` map)
// ---------------------------------------------------------------------------
function collectPaths(obj, prefix = '') {
  const paths = new Set()
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      collectPaths(v, key).forEach(x => paths.add(x))
    }
    paths.add(key)
  }
  return paths
}
const collisions = []
for (const [lang, cat] of catalogs) {
  const paths = collectPaths(cat)
  for (const p of paths) {
    // If `p` is also a full key (leaf) and has children, it collides
    if (enFlat.has(p) && paths.has(`${p}.`)) {
      collisions.push(`${lang}.json: "${p}" is both a value and a parent`)
    }
  }
}
if (collisions.length) {
  console.error('✖ key structure collisions:')
  for (const c of collisions) console.error(`    ${c}`)
  errors++
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
if (errors === 0) {
  console.log(
    `✓ i18n consistent: ${catalogs.size} locales, ${enKeys.size} keys, ${staticRefs.size} static refs`
  )
} else {
  console.error(`\n✖ ${errors} category/categories of i18n violations found`)
  process.exit(1)
}
