/**
 * Type-safe environment variable validation using `@t3-oss/env-core`.
 *
 * This module validates all `VITE_*` environment variables at build time.
 * If a variable is missing or malformed, the build fails immediately with
 * a clear error message — instead of silently passing and causing runtime
 * bugs.
 *
 * Usage:
 *   import { env } from '@/lib/env'
 *   const dsn = env.VITE_SENTRY_DSN // string (may be empty string)
 */

import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  /**
   * Server-side environment variables (not used in a pure client-side Vite
   * app, but required by the API contract).
   */
  server: {},

  /**
   * Client-side environment variables — prefixed with `VITE_`.
   *
   * `VITE_SENTRY_DSN` is optional (empty string disables Sentry). When
   * provided, it must be a valid URL.
   */
  client: {
    VITE_SENTRY_DSN: z
      .string()
      .url('VITE_SENTRY_DSN must be a valid URL or empty')
      .or(z.literal(''))
      .default(''),
  },

  /**
   * Tell `@t3-oss/env-core` that `VITE_SENTRY_DSN` comes from
   * `import.meta.env`.
   */
  clientPrefix: 'VITE_',

  /**
   * Runtime environment access — Vite exposes env vars via `import.meta.env`.
   */
  runtimeEnv: import.meta.env,
})
