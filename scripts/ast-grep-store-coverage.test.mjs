/**
 * Coverage: does each store rule see EVERY store?
 *
 * The contract suite proves a rule fires on its own fixture; it cannot prove the
 * fixture is representative. `no-destructure-zustand` is the counter-example — it
 * hardcoded `useUIStore(...)`, so its contract pair stayed green while three of the
 * four stores were unguarded and `AGENTS.md` still promised "no Zustand
 * destructuring" without qualification. A behaviour test passes on that rule; only a
 * coverage test can fail it.
 *
 * So this file plants the same anti-pattern once per store discovered from
 * `src/store/`, reads each rule's own matcher instead of duplicating it, and asserts
 * the compliant forms stay clean for every store too. Without that last assertion
 * the cheap way to pass would be to widen the rules until they also report
 * selectors.
 *
 * Also guards the naming contract: a store exported as `useSettings` — no `Store`
 * suffix — is invisible to both rules no matter how they are written, and nothing
 * else in the repo would say so.
 */
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { countFindings } from './lib/ast-grep-contracts.mjs'
import {
  createScanner,
  declaredStoreMatcher,
  discoveredStores,
} from './lib/ast-grep-scan.mjs'

const root = path.join(fileURLToPath(new URL('.', import.meta.url)), '..')
const scanner = createScanner({
  root,
  cacheDir: path.join(
    root,
    'node_modules',
    '.cache',
    'ast-grep-store-coverage'
  ),
})

/**
 * The two rules whose subject is "any store". `fixture` is where each shape is
 * planted, and must sit inside the rule's own `files:` scope — a fixture outside
 * scope would read as a dead rule.
 */
const SWEEPS = [
  {
    rule: 'no-destructure-zustand',
    ruleFile: '.ast-grep/rules/zustand/no-destructure.yml',
    label: 'destructuring a store hook',
    fixture: 'src/components/coverage-store.tsx',
    bad: store =>
      `export function Plant() {\n  const { value } = ${store}()\n  return <div>{String(value)}</div>\n}\n`,
    good: store =>
      `export function Plant() {\n  const value = ${store}(state => state.value)\n  const { value: direct } = ${store}.getState()\n  return <div>{String(value)}{String(direct)}</div>\n}\n`,
  },
  {
    rule: 'no-store-subscription-in-lib',
    ruleFile: '.ast-grep/rules/architecture/no-store-in-lib.yml',
    label: 'subscribing to a store inside lib/',
    fixture: 'src/lib/coverage-store.ts',
    bad: store =>
      `export function plantRead() {\n  return ${store}(state => state.open)\n}\n`,
    good: store =>
      `export function plantRead() {\n  return ${store}.getState().open\n}\n`,
  },
]

const stores = discoveredStores(root)

after(() => scanner.clean())

/** Scan one rule/shape pair against one store, and return that rule's hit count. */
function hitsFor(sweep, kind, storeName) {
  const dir = scanner.buildTree(`${sweep.rule}-${kind}-${storeName}`, [
    { path: sweep.fixture, code: sweep[kind](storeName) },
  ])
  return countFindings(scanner.scan(dir)).get(sweep.rule) ?? 0
}

function matcherOf(sweep) {
  const source = fs.readFileSync(path.join(root, sweep.ruleFile), 'utf8')
  const declared = declaredStoreMatcher(source)
  assert.ok(
    declared,
    `${sweep.ruleFile} matches no store-shaped variable — a store rule narrowed to one literal store name leaves the others unguarded while the docs promise all of them`
  )
  return declared
}

test('there are stores to cover — an empty sweep would prove nothing', () => {
  assert.ok(
    stores.length > 0,
    'no `export const useXStore = create<…>` found under src/store/, so this gate is vacuous'
  )
})

test('each store rule matches by shape, and names the set it covers', () => {
  for (const sweep of SWEEPS) {
    const declared = matcherOf(sweep)
    // Reading the regex back out keeps this file from carrying its own copy that
    // could silently disagree with the rule.
    assert.ok(
      declared.regex.source.includes('Store'),
      `${sweep.ruleFile} declares ${declared.regex}, which is not a store-shaped matcher`
    )
  }
})

test('every store hook is named the way the store rules match', () => {
  for (const sweep of SWEEPS) {
    const declared = matcherOf(sweep)
    const offScope = stores.filter(s => !declared.regex.test(s.name))
    assert.deepEqual(
      offScope,
      [],
      `${sweep.rule} cannot see ${offScope.map(s => `${s.name} in ${s.file}`).join(', ')} — rename the hook to end in Store, or widen the rule's regex`
    )
  }
})

test('each store rule fires on every store, not just the one in its fixture', () => {
  for (const sweep of SWEEPS) {
    const silent = []
    for (const store of stores) {
      const got = hitsFor(sweep, 'bad', store.name)
      if (got !== 1)
        silent.push(`${store.name}: ${sweep.label} fired ${got}x, expected 1`)
    }
    assert.deepEqual(
      silent,
      [],
      `${sweep.rule} is silent or double-counting on ${silent.length} of ${stores.length} stores:\n${silent.join('\n')}`
    )
  }
})

test('the compliant forms stay clean for every store', () => {
  for (const sweep of SWEEPS) {
    const reported = []
    for (const store of stores) {
      const got = hitsFor(sweep, 'good', store.name)
      if (got > 0)
        reported.push(`${store.name}: fired ${got}x on compliant code`)
    }
    assert.deepEqual(
      reported,
      [],
      `${sweep.rule} now reports code it exists to allow, so the rule is over-broad:\n${reported.join('\n')}`
    )
  }
})
