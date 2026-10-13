import { defineConfig, devices } from '@playwright/test'

/**
 * Startup-budget configuration, separate from `playwright.config.ts` on purpose.
 *
 * The main suite runs against the Vite **dev** server: unbundled ESM, no
 * minification, modules compiled on demand. Timing anything on that server would
 * measure Vite's transform pipeline, not the artifact the desktop app actually
 * loads. This config serves `dist/` through `vite preview` instead, so the budget
 * applies to the production bundle.
 *
 * `npm run build` must have produced `dist/` first; `e2e:startup` chains it.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'startup-budget.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  // A timing budget must not be retried into passing: a slow first load is the
  // regression this file exists to catch.
  retries: 0,
  workers: 1,
  timeout: 60000,
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env['CI'],
    timeout: 30000,
  },
})
