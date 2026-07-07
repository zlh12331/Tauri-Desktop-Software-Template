import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import path, { resolve } from 'path'
import { readFileSync } from 'fs'

// Read package.json via fs to avoid JSON import syntax that oxc-parser
// (used by knip) cannot handle. See: https://knip.dev/reference/known-issues
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, 'package.json'), 'utf-8')
) as { version: string }

const host = process.env.TAURI_DEV_HOST

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  const sentryDsn = process.env.VITE_SENTRY_DSN;

  return {
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    plugins: [
      react(),
      babel({
        presets: [reactCompilerPreset()],
      }),
      tailwindcss(),
      // Sentry Vite plugin: uploads source maps and sets release automatically.
      // Only activates when SENTRY_DSN is configured (build & dev).
      sentryDsn &&
        sentryVitePlugin({
          org: 'sentry',
          project: 'tauri-desktop-software-template',
          authToken: process.env.SENTRY_AUTH_TOKEN, // needed for source map upload
          // Source maps: generate hidden maps in production, upload to Sentry.
          sourcemaps: {
            assets: './dist/**',
            ignore: ['node_modules'],
          },
          // Disable in dev mode — Sentry Vite plugin interferes with HMR.
          disabled: mode === 'development',
        }),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      chunkSizeWarningLimit: 600, // Prevent warnings for template's bundled components
      sourcemap: mode === 'production' ? 'hidden' : false,
      rolldownOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          'quick-pane': resolve(__dirname, 'quick-pane.html'),
        },
      },
    },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
  }
})
