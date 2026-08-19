#!/usr/bin/env node
/**
 * Add a new language to the app in one step.
 *
 * Usage: node scripts/add-language.mjs <lang>   e.g. node scripts/add-language.mjs fr
 *
 * Does three things (so adding a language is a single command, not 3 manual edits):
 *   1. Create locales/<lang>.json as a copy of en.json with empty values
 *      (translator fills them in; keys are already in place).
 *   2. Register the language in src/i18n/config.ts `supportedLanguages`.
 *   3. Register the language in i18next.config.ts `locales`.
 *
 * The check-i18n.mjs guard then keeps files and configs in sync.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const lang = process.argv[2]
if (!lang || !/^[a-z]{2}(-[A-Z]{2})?$/.test(lang)) {
  console.error(
    '✖ Usage: node scripts/add-language.mjs <lang>  (e.g. fr, de, zh-Hant)'
  )
  process.exit(1)
}

const localePath = join(root, 'locales', `${lang}.json`)
if (existsSync(localePath)) {
  console.error(`✖ locales/${lang}.json already exists`)
  process.exit(1)
}

// 1. Create the locale file from en.json (keys preserved, values emptied)
const enPath = join(root, 'locales', 'en.json')
const en = JSON.parse(readFileSync(enPath, 'utf8'))
const template = Object.fromEntries(
  Object.entries(en).map(([k, v]) => [k, typeof v === 'string' ? '' : v])
)
writeFileSync(localePath, JSON.stringify(template, null, 2) + '\n', 'utf8')
console.log(
  `✓ Created locales/${lang}.json (${Object.keys(template).length} keys, values empty)`
)

// 2. Register in src/i18n/config.ts — APPEND to the existing array, never
// overwrite the previously configured languages.
const configPath = join(root, 'src/i18n/config.ts')
let config = readFileSync(configPath, 'utf8')
if (config.includes(`'${lang}'`)) {
  console.error(`✖ '${lang}' already in src/i18n/config.ts supportedLanguages`)
  process.exit(1)
}
if (!/const supportedLanguages = \[[^\]]*\]/.test(config)) {
  console.error('✖ Could not locate supportedLanguages in src/i18n/config.ts')
  process.exit(1)
}
config = config.replace(
  /(const supportedLanguages = \[[^\]]*)\]/,
  `$1, '${lang}']`
)
writeFileSync(configPath, config, 'utf8')
console.log(`✓ Registered '${lang}' in src/i18n/config.ts supportedLanguages`)

// 3. Register in i18next.config.ts — append to the existing locales array.
const i18nConfigPath = join(root, 'i18next.config.ts')
let i18nConfig = readFileSync(i18nConfigPath, 'utf8')
if (!/locales: \[[^\]]*\]/.test(i18nConfig)) {
  console.error('✖ Could not locate locales in i18next.config.ts')
  process.exit(1)
}
i18nConfig = i18nConfig.replace(/(locales: \[[^\]]*)\]/, `$1, '${lang}']`)
writeFileSync(i18nConfigPath, i18nConfig, 'utf8')
console.log(`✓ Registered '${lang}' in i18next.config.ts locales`)

console.log('\n✅ Language added. Next steps:')
console.log(`   1. Translate the empty values in locales/${lang}.json`)
console.log('   2. Run `npm run i18n:check` to verify')
