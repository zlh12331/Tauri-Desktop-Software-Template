/**
 * Bundle-size and build-artifact metrics, free of file system access so the
 * budget rules can be tested without a 23-second Vite build behind them.
 * `check-bundle.mjs` measures; this module decides.
 *
 * Budgets are a ratchet, the same contract `check-coverage.mjs` uses for its
 * coverage floor: a number here may rise, but only in a change that says why.
 * A gate whose ceiling was raised to fit the current output is not a gate — the
 * `chunkSizeWarningLimit: 600` in vite.config.ts is exactly that shape, and the
 * 835 kB chunk still walks past it.
 */

export const KIB = 1024
export const MIB = 1024 * KIB

/**
 * Budget ceilings in bytes, measured at gzip level 9 by check-bundle.mjs.
 * Baselines in the comments are the values this template produced when the
 * numbers were set; the headroom is what a routine dependency patch may absorb
 * before a human has to look.
 */
export const BUDGETS = {
  /** Baseline 397,430 B. Every JS the shipped app parses. */
  jsGzip: 410_000,
  /** Baseline 27,354 B. Tailwind output plus component CSS. */
  cssGzip: 28_900,
  /** Baseline 261,923 B (the ErrorBoundary chunk holds Sentry). */
  largestChunkGzip: 275_000,
  /**
   * Baseline 1,172 B. quick-pane is a window that exists from launch and stays
   * hidden until a shortcut opens it, so its cost is paid by users who never
   * touch the feature. Keep it near zero.
   */
  quickPaneJsGzip: 1_600,
  /** Baseline 424,784 B. What Tauri embeds into the binary as web assets. */
  distGzipTotal: 440_000,
}

/**
 * Hard floor for "React Compiler actually ran": its memo-cache sentinel is
 * `Symbol.for("react.memo_cache_sentinel")`, and `Symbol.for` strings survive
 * minification, so the marker is countable in the built output. Zero means the
 * compiler did nothing — the failure mode is silent, because the babel preset
 * option is accepted whether or not the plugin resolved.
 */
export const COMPILER_SENTINEL = 'react.memo_cache_sentinel'
export const COMPILER_MIN_HITS = 1

/**
 * Below this many memo sites the compiler probably ran on only part of the tree
 * (the baseline is 59 across the whole app). This warns rather than fails: a
 * legitimate refactor can reduce the count, and only its disappearance is
 * evidence of a broken pipeline.
 */
export const COMPILER_WARN_HITS = 20

const GATEABLE_SUFFIX = /\.(js|mjs|cjs|css)$/

/**
 * @param entries `{ name, bytes, gzip }` for every file under dist/assets
 * @returns grouped metrics; NaN-free even when a group is empty so the caller
 *          can tell "no files" from "zero bytes"
 */
export function measure(entries) {
  const sized = entries.filter(e => GATEABLE_SUFFIX.test(e.name))
  const js = sized.filter(e => e.name.endsWith('.js'))
  const css = sized.filter(e => e.name.endsWith('.css'))
  const largest = sized.reduce(
    (best, e) => (e.gzip > (best?.gzip ?? -1) ? e : best),
    null
  )
  const quickPaneJs = js.filter(e => e.name.startsWith('quick-pane'))

  return {
    jsCount: js.length,
    cssCount: css.length,
    jsGzip: sum(js),
    cssGzip: sum(css),
    distGzipTotal: sum(sized),
    largestChunk: largest ? { name: largest.name, gzip: largest.gzip } : null,
    largestChunkGzip: largest ? largest.gzip : 0,
    quickPaneJsGzip: sum(quickPaneJs),
  }
}

const sum = list => list.reduce((total, e) => total + e.gzip, 0)

/** Source maps must never reach the shipped assets. */
export function findMapResidue(entries) {
  return entries.filter(e => /\.map$/i.test(e.name)).map(e => e.name)
}

/** @returns budget breaches as `{ key, actual, ceiling }`, empty when compliant */
export function findBudgetBreaches(metrics, budgets = BUDGETS) {
  const breaches = []
  for (const [key, ceiling] of Object.entries(budgets)) {
    const actual = metrics[key]
    if (typeof actual !== 'number' || Number.isNaN(actual)) {
      throw new Error(`metric '${key}' is missing from the measurement`)
    }
    if (actual > ceiling) breaches.push({ key, actual, ceiling })
  }
  return breaches
}

/**
 * An empty assets directory is not a zero-byte bundle. Without this the metrics
 * above would read 0 against every ceiling and the gate would pass on a dist
 * that was never built — the same "empty denominator reads as perfect" trap the
 * coverage guard refuses.
 */
export function isDistPopulated(metrics) {
  return metrics.jsCount > 0 && metrics.cssCount > 0
}
