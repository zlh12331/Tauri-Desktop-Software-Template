import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E configuration for Tauri app frontend testing.
 *
 * Tests run against the Vite dev server with mocked Tauri APIs,
 * allowing full UI interaction testing without a Rust backend.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  // One worker everywhere, including local runs.
  //
  // Measured on a Windows development machine: at Playwright's default
  // parallelism (half the logical cores) 2 of 97 tests died on the 10-second
  // `expect` timeout — that many simultaneous first page loads against one Vite
  // dev server, which compiles its module graph on demand. Both cases pass when
  // their file runs alone. CI already used one worker, so this makes local and CI
  // judge the same thing rather than each having its own meaning.
  //
  // What this does NOT buy is determinism. `advanced-pane.spec.ts:184`
  // ("API config form submit with valid data shows success toast") still failed
  // once in three isolated single-worker runs, and once in the full
  // single-worker suite: the failure lands on the test's first `fill` with a
  // navigation to the root URL already in flight, so the reload is not produced
  // by the form being submitted. It is green in CI only because `retries: 2`
  // absorbs it. Read that case as unstable, and this setting as removing a
  // systematic failure — not as a guarantee.
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },

  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
    env: {
      VITE_SENTRY_DSN: 'https://test@test.ingest.sentry.io/123',
    },
  },
})
