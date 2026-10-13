/**
 * Tests for the coverage aggregation the floor gate trusts.
 *
 * Percentages alone cannot distinguish "fully covered" from "nothing measured",
 * so the totals are pinned here too: an empty v8 map must be visible as an empty
 * map rather than arriving as a comfortable 100%.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { findFloorBreaches, pct, summarize } from './coverage-summary.mjs'

const v8File = over => ({
  statementMap: {},
  s: {},
  fnMap: {},
  f: {},
  branchMap: {},
  b: {},
  ...over,
})

test('statements are counted against the statement map, not the hit map', () => {
  const { actual, totals } = summarize({
    'a.ts': v8File({
      statementMap: {
        0: { start: { line: 1 }, end: { line: 1 } },
        1: { start: { line: 2 }, end: { line: 2 } },
      },
      s: { 0: 5, 1: 0 },
    }),
  })
  assert.deepEqual(totals.statements, { hit: 1, total: 2 })
  assert.equal(actual.statements, 50)
})

test('lines are derived from statement ranges', () => {
  const { actual, totals } = summarize({
    'a.ts': v8File({
      statementMap: { 0: { start: { line: 3 }, end: { line: 5 } } },
      s: { 0: 2 },
    }),
  })
  assert.deepEqual(totals.lines, { hit: 3, total: 3 })
  assert.equal(actual.lines, 100)
})

test('each branch path counts separately', () => {
  const { totals } = summarize({
    'a.ts': v8File({
      statementMap: { 0: { start: { line: 1 }, end: { line: 1 } } },
      s: { 0: 1 },
      branchMap: { 0: { type: 'if', locations: [] } },
      b: { 0: [1, 0] },
    }),
  })
  assert.deepEqual(totals.branches, { hit: 1, total: 2 })
})

test('a branch count without a matching branch map entry is skipped', () => {
  const { totals } = summarize({
    'a.ts': v8File({ b: { 7: [1, 1, 1] } }),
  })
  assert.equal(
    totals.branches.total,
    0,
    'orphan counts must not inflate the denominator'
  )
})

test('an empty coverage map is visible as empty, not as perfect coverage', () => {
  const { actual, totals } = summarize({})
  // The percentages say 100 because pct() refuses to divide by zero; the guard
  // lives in totals, which is what the CLI must check before trusting the gate.
  assert.equal(actual.statements, 100)
  assert.equal(totals.statements.total, 0)
  assert.equal(totals.branches.total, 0)
  assert.equal(totals.functions.total, 0)
  assert.equal(totals.lines.total, 0)
})

test('functions counted only when the fn map knows them', () => {
  const { totals } = summarize({
    'a.ts': v8File({ fnMap: { 0: { name: 'f' } }, f: { 0: 3, 9: 1 } }),
  })
  assert.deepEqual(totals.functions, { hit: 2, total: 1 })
})

test('pct rounds to two decimals and treats an empty denominator as 100', () => {
  assert.equal(pct(1, 3), 33.33)
  assert.equal(pct(2, 3), 66.67)
  assert.equal(pct(0, 0), 100)
  assert.equal(pct(5, 5), 100)
})

test('a floor breach names the metric and keeps the exact floor as a pass', () => {
  const commitments = { statements: 97.07, branches: 92.84 }
  assert.deepEqual(
    findFloorBreaches({ statements: 97.06, branches: 92.84 }, commitments),
    [{ metric: 'statements', actual: 97.06, floor: 97.07 }],
    'at the floor is allowed, below it is not'
  )
  assert.deepEqual(
    findFloorBreaches({ statements: 98, branches: 95 }, commitments),
    []
  )
})
