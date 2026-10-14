/**
 * Tests for the fixture-scan harness itself, focused on the two functions that can
 * misreport: the rule parser and the store discovery.
 *
 * `declaredStoreMatcher` returning `null` reads, in the coverage suite, as an
 * accusation that a rule was narrowed to one literal store. When it returned `null`
 * because of an anchoring bug in its own regex, that accusation was wrong about the
 * code being tested and right only about this file — so the parser is pinned here,
 * apart from the rules it judges.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { declaredStoreMatcher, discoveredStores } from './ast-grep-scan.mjs'

const root = path.join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')

test('it reads the matcher each real store rule declares', () => {
  for (const ruleFile of [
    '.ast-grep/rules/zustand/no-destructure.yml',
    '.ast-grep/rules/architecture/no-store-in-lib.yml',
  ]) {
    const declared = declaredStoreMatcher(
      fs.readFileSync(path.join(root, ruleFile), 'utf8')
    )
    assert.ok(declared, `${ruleFile}: no store matcher parsed`)
    assert.equal(declared.variable, 'STORE')
    for (const store of discoveredStores(root)) {
      assert.ok(
        declared.regex.test(store.name),
        `${ruleFile} does not match ${store.name}`
      )
    }
  }
})

test('a rule with no constraints parses as absent, not as a match-all', () => {
  // Absent must be falsy: an empty or permissive regex would let the coverage suite
  // report every store as covered.
  const narrowed = declaredStoreMatcher(
    'rule:\n  pattern: const { $$$P } = useUIStore($$$A)\n'
  )
  assert.equal(narrowed, null)
})

test('indentation inside the rule file does not change the verdict', () => {
  const flat = declaredStoreMatcher(
    "constraints:\n  STORE:\n    regex: '^use.*Store$'\n"
  )
  assert.ok(flat)
  assert.equal(flat.regex.source, '^use.*Store$')

  // The same block with different leading whitespace, as YAML allows.
  const indented = declaredStoreMatcher(
    "  constraints:\n    STORE:\n      regex: '^use.*Store$'\n"
  )
  assert.ok(indented, 'a valid constraints block read as absent')
  assert.equal(indented.regex.source, '^use.*Store$')
})

test('constraints without a regex are not a matcher', () => {
  assert.equal(
    declaredStoreMatcher('constraints:\n  STORE:\n    kind: expression\n'),
    null
  )
})

test('store discovery reads hooks, not test files or unrelated exports', () => {
  const stores = discoveredStores(root)
  assert.ok(stores.length > 0, 'discovered nothing, so the sweep is vacuous')
  for (const store of stores) {
    assert.match(store.name, /^use/)
    assert.doesNotMatch(store.file, /\.test\./, store.file)
    assert.match(store.file, /^src[/\\]store[/\\]/)
  }
})
