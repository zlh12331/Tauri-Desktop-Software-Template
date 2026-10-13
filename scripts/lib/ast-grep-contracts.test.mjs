/**
 * Pure tests for the ast-grep contract suite: the parsing, the diffing and the
 * completeness rule that protects the gate from shrinking as rules are added.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CONTRACTS,
  contractGaps,
  countFindings,
  diffCounts,
  expectedCounts,
} from './ast-grep-contracts.mjs'

const finding = ruleId => ({
  ruleId,
  file: 'src/lib/a.ts',
  text: 'planted',
  severity: 'error',
})

test('findings are counted by ruleId from the machine-readable report', () => {
  const output = JSON.stringify([
    finding('no-console'),
    finding('no-console'),
    finding('no-store-subscription-in-lib'),
  ])
  const counts = countFindings(output)
  assert.equal(counts.get('no-console'), 2)
  assert.equal(counts.get('no-store-subscription-in-lib'), 1)
  assert.equal(counts.size, 2)
})

test('an unparseable report is an error, not an empty count table', () => {
  // A report format the parser cannot read would otherwise look identical to a
  // scanner that found nothing, which is the failure this suite exists to catch.
  assert.throws(() => countFindings('not json at all'), /not parseable/)
  assert.throws(
    () => countFindings('{"ruleId":"no-console"}'),
    /not a findings array/
  )
  assert.throws(() => countFindings('[{"file":"a.ts"}]'), /carries no ruleId/)
})

test('a rule that sees nothing is reported as missing, not as success', () => {
  const d = diffCounts(countFindings('[]'), { 'no-console': 1 })
  assert.deepEqual(d.missing, ['no-console did not fire, expected 1'])
  assert.deepEqual(d.extra, [])
})

test('a rule firing on compliant code is reported as an over-match', () => {
  const d = diffCounts(countFindings(JSON.stringify([finding('no-console')])), {
    'no-console': 0,
  })
  assert.deepEqual(d.missing, [])
  assert.equal(d.extra.length, 1)
  assert.match(d.extra[0], /fired 1x on compliant code/)
})

test('a double match is wrongCount rather than a pass', () => {
  const d = diffCounts(
    countFindings(
      JSON.stringify([finding('no-console'), finding('no-console')])
    ),
    { 'no-console': 1 }
  )
  assert.deepEqual(d.wrongCount, ['no-console fired 2x, expected 1'])
})

test('a finding whose rule has no contract is surfaced instead of ignored', () => {
  const d = diffCounts(countFindings(JSON.stringify([finding('new-rule')])), {
    'no-console': 0,
  })
  assert.match(d.extra.join(), /new-rule fired 1x but has no contract/)
})

test('an added rule without a contract is a gap', () => {
  const { uncontracted, staleRules } = contractGaps([
    ...CONTRACTS.map(c => c.rule),
    'brand-new-rule',
  ])
  assert.deepEqual(uncontracted, ['brand-new-rule'])
  assert.deepEqual(staleRules, [])
})

test('a contract naming a rule that no longer exists is stale', () => {
  const existing = CONTRACTS.map(c => c.rule).slice(0, 2)
  const { staleRules } = contractGaps(existing)
  assert.equal(staleRules.length, CONTRACTS.length - 2)
})

test('every contract differs from its compliant twin in the dimension it declares', () => {
  const rules = CONTRACTS.map(c => c.rule)
  assert.equal(new Set(rules).size, rules.length, 'rule ids must be unique')
  for (const c of CONTRACTS) {
    assert.ok(
      c.dimension === 'path' || c.dimension === 'code',
      `${c.rule}: dimension must be declared as 'path' or 'code', got ${c.dimension}`
    )
    assert.notEqual(
      c.bad.path,
      c.good.path,
      `${c.rule}: same path for bad and good`
    )
    for (const side of [c.bad, c.good]) {
      assert.match(
        side.path,
        /^src\//,
        `${c.rule}: ${side.path} is outside src/`
      )
      assert.ok(
        side.code.trim().length > 0,
        `${c.rule}: empty fixture at ${side.path}`
      )
    }
    if (c.dimension === 'path') {
      // Scope rules: identical code, so the directory or the ignore list is the
      // only thing that can change the verdict. A typo in the path would make the
      // pair test nothing, hence both paths are pinned to their own concern.
      assert.equal(
        c.bad.code,
        c.good.code,
        `${c.rule}: path-scoped pair must share code`
      )
    } else {
      assert.notEqual(
        c.bad.code,
        c.good.code,
        `${c.rule}: code-scoped pair is identical, so one assertion is fake`
      )
    }
  }
})

test('the two expectation tables cover exactly the contracted rules', () => {
  assert.deepEqual(
    Object.keys(expectedCounts('bad')).sort(),
    CONTRACTS.map(c => c.rule).sort()
  )
  for (const v of Object.values(expectedCounts('bad'))) assert.equal(v, 1)
  for (const v of Object.values(expectedCounts('good'))) assert.equal(v, 0)
})
