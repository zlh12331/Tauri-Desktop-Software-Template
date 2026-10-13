/**
 * Tests for the bundle budget rules.
 *
 * The case that matters is the one that looks like success: an unbuilt or empty
 * `dist` measures 0 bytes, which is under every ceiling, so a size gate that
 * only compares numbers passes loudest when there is nothing to measure. These
 * tests pin that the emptiness is visible and that a renamed budget cannot
 * quietly stop being checked.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BUDGETS,
  findBudgetBreaches,
  findMapResidue,
  isDistPopulated,
  measure,
} from './bundle-metrics.mjs'

const file = (name, gzip, bytes = gzip * 3) => ({ name, bytes, gzip })

const typical = [
  file('main-abc.js', 130_000),
  file('ErrorBoundary-def.js', 260_000),
  file('quick-pane-ghi.js', 1_200),
  file('zh-jkl.js', 2_900),
  file('main-mno.css', 14_000),
  file('quick-pane-pqr.css', 13_000),
]

test('measure groups by type and keeps the largest chunk addressable', () => {
  const m = measure(typical)
  assert.equal(m.jsCount, 4)
  assert.equal(m.cssCount, 2)
  assert.equal(m.jsGzip, 130_000 + 260_000 + 1_200 + 2_900)
  assert.equal(m.cssGzip, 27_000)
  assert.equal(m.quickPaneJsGzip, 1_200, 'only the JS entry, not its CSS')
  assert.equal(m.largestChunk.name, 'ErrorBoundary-def.js')
  assert.equal(m.largestChunkGzip, 260_000)
})

test('non-gateable files are excluded from the totals', () => {
  const m = measure([...typical, file('favicon.ico', 999_999)])
  assert.equal(m.distGzipTotal, measure(typical).distGzipTotal)
})

test('an empty build is under budget and must be caught separately', () => {
  const m = measure([])
  assert.equal(m.jsGzip, 0)
  assert.equal(m.largestChunkGzip, 0)
  assert.equal(m.largestChunk, null)
  assert.deepEqual(findBudgetBreaches(m, BUDGETS), [])
  assert.equal(
    isDistPopulated(m),
    false,
    'this is the only thing standing between an unbuilt dist and a green gate'
  )
})

test('a populated build is reported as populated', () => {
  assert.equal(isDistPopulated(measure(typical)), true)
  assert.equal(
    isDistPopulated(measure([file('main.js', 10)])),
    false,
    'JS without CSS means the CSS pipeline produced nothing'
  )
})

test('a breach names the metric and the exact overshoot', () => {
  const budgets = { jsGzip: 100_000 }
  const [breach] = findBudgetBreaches(measure(typical), budgets)
  assert.equal(breach.key, 'jsGzip')
  assert.equal(breach.actual, 394_100)
  assert.equal(breach.ceiling, 100_000)
})

test('landing exactly on the ceiling passes', () => {
  const m = measure(typical)
  assert.deepEqual(
    findBudgetBreaches({ jsGzip: m.jsGzip }, { jsGzip: m.jsGzip }),
    [],
    'the budget is inclusive'
  )
  assert.equal(
    findBudgetBreaches({ jsGzip: m.jsGzip + 1 }, { jsGzip: m.jsGzip }).length,
    1
  )
})

test('a budget with no matching metric fails instead of being skipped', () => {
  // Without this, renaming a metric would leave its budget unenforced forever,
  // which is the same silent-pass shape as the empty-dist case above.
  assert.throws(
    () => findBudgetBreaches({ jsGzip: 1 }, { cssGzip: 100 }),
    /metric 'cssGzip' is missing/
  )
  assert.throws(
    () => findBudgetBreaches({ jsGzip: Number.NaN }, { jsGzip: 100 }),
    /metric 'jsGzip' is missing/
  )
})

test('source map residue is detected wherever it hides', () => {
  assert.deepEqual(
    findMapResidue([
      file('main-abc.js', 10),
      file('main-abc.js.map', 400_000),
      file('nested/worker.js.map', 100),
      file('index.html', 5),
    ]),
    ['main-abc.js.map', 'nested/worker.js.map']
  )
  assert.deepEqual(findMapResidue([file('main-abc.js', 10)]), [])
})

test('the committed budgets sit above the measured baseline but not by much', () => {
  // Headroom that grows without limit turns a ratchet into a suggestion. A
  // KiB-scale allowance is also permitted because 6% of a 1.1 KiB chunk is 69
  // bytes, and no one picks a dependency that lightly.
  const baseline = {
    jsGzip: 397_430,
    cssGzip: 27_354,
    largestChunkGzip: 261_923,
    quickPaneJsGzip: 1_172,
    distGzipTotal: 424_784,
  }
  for (const [key, value] of Object.entries(baseline)) {
    const ceiling = BUDGETS[key]
    assert.ok(ceiling >= value, `${key} budget must not be below its baseline`)
    const headroom = ceiling - value
    assert.ok(
      headroom <= value * 0.06 || headroom <= 1024,
      `${key} allows ${headroom} B of headroom: over 6% and over 1 KiB needs a reason in the change that raises it`
    )
  }
})
