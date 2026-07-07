import { defineConfig } from 'vitest/config'
import path from 'path'

// Separate Vitest config — keeps test runner independent of Vite build plugins
// (Sentry Vite plugin, Rolldown Babel, Tailwind CSS) that only apply to builds.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Workaround: Vite's package exports resolver fails on non-ASCII paths.
      // Map the subpath export directly to the physical file.
      '@testing-library/jest-dom/vitest': path.resolve(
        __dirname,
        'node_modules/@testing-library/jest-dom/dist/vitest.mjs'
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'e2e', 'playwright-report', 'test-results'],
    maxWorkers: 4,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/quick-pane-main.tsx',
        'src/vite-env.d.ts',
        'src/lib/bindings.ts',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
})
