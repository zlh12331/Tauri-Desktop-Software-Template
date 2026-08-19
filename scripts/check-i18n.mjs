#!/usr/bin/env node
/**
 * i18n FALLBACK checker — covers ONLY what i18next-cli cannot.
 *
 * i18next-cli analyzes keys that are STATICALLY referenced in code:
 *   - `extract` / `extract --ci` — syncs static keys, guards drift
 *   - `status` — missing translations + dangling `t()` references
 *
 * It deliberately ignores dynamic keys (e.g. `t(command.labelKey)`) and
 * never inspects the translated VALUES. This script owns those two blind
 * spots (empirically verified i18next-cli misses them):
 *
 *   1. FULL key-set parity between every locale and `en.json` — including
 *      dynamic/unreferenced keys. Deleting `commands.*` from zh.json passes
 *      `extract --ci` AND `status` (both only know static refs), but breaks
 *      the UI at runtime. Only this script catches it.
 *   2. `{{var}}` placeholder alignment across locale VALUES — e.g. en uses
 *      `{{message}}` but zh accidentally drops a brace. i18next-cli only
 *      checks the code call-site, never the translated strings.
 *
 * Exit code 0 = consistent, 1 = violations found (CI fails).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

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

// ---------------------------------------------------------------------------
// Language-set parity: locales/*.json must match src/i18n/config.ts
// `supportedLanguages`. Adding a language requires BOTH a new locale file AND
// a config.ts entry — this check catches either one being forgotten.
// ---------------------------------------------------------------------------
const configPath = join(root, 'src/i18n/config.ts')
const configSrc = readFileSync(configPath, 'utf8')
const configMatch = configSrc.match(
  /const supportedLanguages = \['([^']+)'((?:, '[^']+')*)\]/
)
if (!configMatch) {
  console.error('✖ Could not parse supportedLanguages from src/i18n/config.ts')
  process.exit(1)
}
const configuredLangs = [
  configMatch[1],
  ...(configMatch[2]?.match(/'([^']+)'/g) ?? []),
].map(s => s.replace(/'/g, ''))
const fileLangs = [...catalogs.keys()]

const missingInConfig = fileLangs.filter(l => !configuredLangs.includes(l))
const missingInFiles = configuredLangs.filter(l => !fileLangs.includes(l))
if (missingInConfig.length || missingInFiles.length) {
  console.error('✖ locales/*.json and supportedLanguages are out of sync:')
  if (missingInConfig.length)
    console.error(
      `    in files but not config.ts: ${missingInConfig.join(', ')}`
    )
  if (missingInFiles.length)
    console.error(
      `    in config.ts but not files: ${missingInFiles.join(', ')}`
    )
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

let errors = 0

// ---------------------------------------------------------------------------
// Check 1: FULL key-set parity across all locales (incl. dynamic keys)
// ---------------------------------------------------------------------------
for (const [lang, cat] of catalogs) {
  if (lang === 'en') continue
  const keys = new Set(flatten(cat).keys())
  const missing = [...enKeys].filter(k => !keys.has(k))
  const extra = [...keys].filter(k => !enKeys.has(k))
  if (missing.length || extra.length) {
    console.error(`✖ [${lang}.json] full key set differs from en.json:`)
    for (const k of missing) console.error(`    MISSING: ${k}`)
    for (const k of extra) console.error(`    EXTRA:   ${k}`)
    errors++
  }
}

// ---------------------------------------------------------------------------
// Check 2: {{var}} interpolation placeholders align across locales
// ---------------------------------------------------------------------------
const PLACEHOLDER_RE = /\{\{\s*([\w]+)\s*\}\}/g
function extractPlaceholders(value) {
  const set = new Set()
  let m
  while ((m = PLACEHOLDER_RE.exec(value))) set.add(m[1])
  return set
}

for (const [lang, cat] of catalogs) {
  if (lang === 'en') continue
  const flat = flatten(cat)
  for (const [key, enVal] of enFlat) {
    const zhVal = flat.get(key)
    if (typeof enVal !== 'string' || typeof zhVal !== 'string') continue
    // Empty target value = pending translation (e.g. a newly added language
    // via scripts/add-language.mjs). Placeholder alignment only applies once
    // the value is actually translated, so skip empties.
    if (zhVal === '') continue
    const enSet = extractPlaceholders(enVal)
    const zhSet = extractPlaceholders(zhVal)
    if (enSet.size === 0 && zhSet.size === 0) continue
    const missingInZh = [...enSet].filter(p => !zhSet.has(p))
    const extraInZh = [...zhSet].filter(p => !enSet.has(p))
    if (missingInZh.length || extraInZh.length) {
      console.error(`✖ [${lang}.json] "${key}" placeholder mismatch vs en:`)
      if (missingInZh.length)
        console.error(
          `    MISSING placeholders in ${lang}: ${missingInZh.join(', ')}`
        )
      if (extraInZh.length)
        console.error(
          `    EXTRA placeholders in ${lang}:   ${extraInZh.join(', ')}`
        )
      errors++
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
if (errors === 0) {
  console.log(
    `✓ i18n fallback ok: ${catalogs.size} locales, ${enKeys.size} keys, placeholders aligned`
  )
} else {
  console.error(
    `\n✖ ${errors} category/categories of i18n fallback violations found`
  )
  process.exit(1)
}
