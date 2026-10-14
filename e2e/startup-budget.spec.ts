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
 * The numbers below are ratchets, not opinions. CI measured FCP 208ms / mounted
 * 222ms / DOMContentLoaded 122ms, and a Windows dev machine measured
 * FCP 192–288ms / mounted ~220ms, so the limits sit at roughly 4x the CI value:
 * a real render-blocking regression trips them while runner jitter does not.
 */
const BUDGET_FIRST_CONTENTFUL_PAINT_MS = 800
const BUDGET_REACT_MOUNTED_MS = 1200

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
    // FCP is recorded when the browser commits a painted frame, which can land
    // *after* the mount assertion is satisfied: two runs on the same runner class
    // measured mounted 220/222ms and read FCP as 208ms once and NaN once. Waiting
    // for the entry makes the gate measure the budget rather than that race, while
    // a page that never paints still fails — loudly, with the wait's own timeout.
    await mockPage.waitForFunction(
      () =>
        performance
          .getEntriesByType('paint')
          .some(entry => entry.name === 'first-contentful-paint'),
      undefined,
      { timeout: 10000 }
    )

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
