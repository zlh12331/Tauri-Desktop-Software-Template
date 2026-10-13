import { test, expect } from './fixtures'

/**
 * Startup budget for the production bundle, measured in Chromium against
 * `vite preview` serving `dist/`.
 *
 * What this covers: how long the shipped frontend takes to paint and to mount
 * React. What it cannot cover: process spawn, Rust init and the native webview —
 * those only exist inside a real shell, and `tauri-driver` has no macOS build, so
 * a three-platform gate on them would be a two-platform gate wearing a label. The
 * gap is stated in docs/developer/testing rather than left implicit.
 *
 * The numbers below are ratchets, not opinions: each is a measured value plus
 * ~40% headroom, so a real regression trips the budget while runner jitter does
 * not. Baseline measured 2026-10-14 on a Windows dev machine: FCP 204ms,
 * mounted 220ms, DOMContentLoaded 115ms. The limits are still the generous
 * first-pass values until a CI run reports its own — tighten them against the
 * number this test prints, not against this sentence.
 */
const BUDGET_FIRST_CONTENTFUL_PAINT_MS = 1200
const BUDGET_REACT_MOUNTED_MS = 2000

const PREVIEW_URL = 'http://localhost:4173/'

interface StartupTimings {
  firstContentfulPaint: number
  mounted: number
  domContentLoaded: number
}

test.describe('Startup budget (production bundle)', () => {
  test.use({ navigationTimeout: 30000 })

  test('paints and mounts within the shipped-budget', async ({ mockPage }) => {
    await mockPage.goto(PREVIEW_URL)
    // The title bar is rendered by React after the app store hydrates, so waiting
    // on it is what makes `mounted` mean "usable" rather than "some bytes painted".
    await expect(mockPage.getByText('Tauri App')).toBeVisible({
      timeout: 15000,
    })

    const timings = await mockPage.evaluate<StartupTimings>(() => {
      const paint = performance
        .getEntriesByType('paint')
        .find(entry => entry.name === 'first-contentful-paint')
      const nav = performance.getEntriesByType('navigation')[0] as
        PerformanceNavigationTiming | undefined
      const root = document.getElementById('root')
      return {
        firstContentfulPaint: paint ? paint.startTime : Number.NaN,
        // performance.now() here is still time since navigationStart, and the
        // mount check above already proved the tree is on screen.
        mounted:
          root && root.childElementCount > 0 ? performance.now() : Number.NaN,
        domContentLoaded: nav ? nav.domContentLoadedEventEnd : Number.NaN,
      }
    })

    console.log(
      `startup: FCP ${Math.round(timings.firstContentfulPaint)}ms · ` +
        `mounted ${Math.round(timings.mounted)}ms · ` +
        `DOMContentLoaded ${Math.round(timings.domContentLoaded)}ms`
    )

    expect(Number.isNaN(timings.firstContentfulPaint)).toBe(false)
    expect(timings.firstContentfulPaint).toBeLessThan(
      BUDGET_FIRST_CONTENTFUL_PAINT_MS
    )
    expect(timings.mounted).toBeLessThan(BUDGET_REACT_MOUNTED_MS)
  })
})
