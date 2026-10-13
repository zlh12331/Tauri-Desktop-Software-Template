/**
 * Aggregation logic for the coverage floor gate, free of file I/O so it can be
 * tested against synthetic v8 maps. `check-coverage.mjs` is the CLI wrapper.
 *
 * The point of exposing `totals` alongside `actual` is that a percentage alone
 * cannot tell "everything is covered" from "nothing was measured". v8 coverage
 * output shape has changed across provider versions before; if a field rename
 * ever empties the counts, every percentage would read 100% and the floor gate
 * would pass without measuring a single statement. The caller must check the
 * totals, and the tests below pin that detectability.
 */

/** Hit ratio as a two-decimal percentage; an empty denominator is not 0%. */
export const pct = (hit, total) =>
  total === 0 ? 100 : Number(((hit / total) * 100).toFixed(2))

/**
 * @param coverage parsed `coverage/coverage-final.json`
 * @returns actual percentages and the hit/total denominators behind them
 */
export function summarize(coverage) {
  let stmtHit = 0
  let stmtTotal = 0
  let branchHit = 0
  let branchTotal = 0
  let fnHit = 0
  let fnTotal = 0
  let lineHit = 0
  let lineTotal = 0

  for (const file of Object.values(coverage)) {
    // statements
    for (const [id, hits] of Object.entries(file.s ?? {})) {
      if (file.statementMap?.[id]) stmtTotal++
      if (hits > 0) stmtHit++
    }
    // functions
    for (const [id, hits] of Object.entries(file.f ?? {})) {
      if (file.fnMap?.[id]) fnTotal++
      if (hits > 0) fnHit++
    }
    // lines — v8 line coverage is derivable from statementMap's loc ranges
    const lineMap = new Map()
    for (const loc of Object.values(file.statementMap ?? {})) {
      for (let l = loc.start.line; l <= loc.end.line; l++) lineMap.set(l, false)
    }
    for (const [id, hits] of Object.entries(file.s ?? {})) {
      const loc = file.statementMap?.[id]
      if (!loc) continue
      if (hits > 0)
        for (let l = loc.start.line; l <= loc.end.line; l++)
          lineMap.set(l, true)
    }
    lineTotal += lineMap.size
    lineHit += [...lineMap.values()].filter(v => v).length
    // branches
    for (const [id, counts] of Object.entries(file.b ?? {})) {
      if (!file.branchMap?.[id]) continue
      for (const count of counts) {
        branchTotal++
        if (count > 0) branchHit++
      }
    }
  }

  return {
    actual: {
      statements: pct(stmtHit, stmtTotal),
      branches: pct(branchHit, branchTotal),
      functions: pct(fnHit, fnTotal),
      lines: pct(lineHit, lineTotal),
    },
    totals: {
      statements: { hit: stmtHit, total: stmtTotal },
      branches: { hit: branchHit, total: branchTotal },
      functions: { hit: fnHit, total: fnTotal },
      lines: { hit: lineHit, total: lineTotal },
    },
  }
}

/** Metrics whose actual percentage fell below the documented floor. */
export function findFloorBreaches(actual, commitments) {
  const breaches = []
  for (const [metric, floor] of Object.entries(commitments)) {
    if (actual[metric] < floor)
      breaches.push({ metric, actual: actual[metric], floor })
  }
  return breaches
}
