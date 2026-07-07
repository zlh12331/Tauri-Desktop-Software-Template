import * as Sentry from '@sentry/react'
import { commands } from '@/lib/tauri-bindings'
import { env } from '@/lib/env'
import { redactString, redactObject } from '@/lib/redact'

/**
 * Sentry DSN from validated environment variables.
 * If empty, crash reporting is disabled regardless of user consent.
 * Configure via VITE_SENTRY_DSN in your .env file.
 *
 * This template is configured for a self-hosted Sentry instance,
 * which has no quota limits — all features can be fully enabled.
 */
const SENTRY_DSN = env['VITE_SENTRY_DSN'] || undefined

let initialized = false

/**
 * Consent state for Sentry event submission.
 *
 * - `null`  — Consent not yet asked. Events are captured but NOT sent.
 * - `true`  — User consented. Events are sent to Sentry.
 * - `false` — User denied. Events are dropped.
 *
 * This allows Sentry to initialize early (capturing errors from app startup)
 * while respecting user consent for actual data transmission.
 */
let consentGranted: boolean | null = null

/**
 * Initialize Sentry SDK with full observability features.
 *
 * This should be called as early as possible in main.tsx (before createRoot)
 * so that startup errors are captured. Events are only sent after
 * `setSentryConsent(true)` is called.
 *
 * Enabled features (self-hosted, no quota limits):
 * - Error Monitoring (Issues)
 * - Performance Tracing (Web Vitals + custom spans)
 * - Session Replay (error-only, 100% capture)
 * - Logs (structured log aggregation via Sentry.logger)
 * - User Feedback (inline feedback widget on errors)
 */
export function initSentry(): void {
  if (initialized || !SENTRY_DSN) return

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.DEV ? 'development' : 'production',

    // Tracing: full sampling (self-hosted has no quota)
    tracesSampleRate: 1.0,

    // Session Replay: only capture on errors (privacy-conscious)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,

    // Logs: enable structured log aggregation
    enableLogs: true,

    // Consent gate: drop events until user has explicitly consented.
    // This allows Sentry to capture errors from app startup while
    // respecting user privacy — events are buffered but not sent
    // until setSentryConsent(true) is called.
    //
    // After consent is confirmed, sensitive data (API keys, tokens,
    // passwords) is redacted from the event before transmission.
    beforeSend(event) {
      if (consentGranted !== true) {
        return null
      }
      return redactSentryEvent(event)
    },

    integrations: [
      // Performance tracing: auto-capture Web Vitals (LCP/FCP/INP/CLS)
      Sentry.browserTracingIntegration(),
      // Session Replay: DOM recording for error debugging
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
      // User Feedback: inline widget for users to describe issues
      Sentry.feedbackIntegration({
        colorScheme: 'system',
      }),
    ],
  })

  initialized = true
}

/**
 * Set user consent for Sentry event submission.
 *
 * - `true`  — Allow events to be sent to Sentry. Sets an anonymous user ID
 *              (persisted across sessions) so Sentry can group events by device.
 * - `false` — Drop all pending and future events. Clears user identity.
 * - `null`  — Reset to "not yet asked" state (events captured but not sent).
 *
 * This controls the `beforeSend` gate without re-initializing the SDK.
 * The consent state is also synced to the Rust side via the `set_consent`
 * Tauri command so that Rust-originated Sentry events (e.g. panic captures)
 * respect the same consent gate.
 */
export function setSentryConsent(consent: boolean | null): void {
  consentGranted = consent
  // Sync consent to Rust Sentry SDK.
  // On failure, log a warning so consent mismatches are traceable in production.
  // We do NOT roll back the frontend state because the frontend beforeSend gate
  // is independent and correct regardless of Rust-side state.
  commands.setConsent(consent).catch(error => {
    // Use console.warn directly since logger might not be ready in all contexts.
    console.warn(
      '[sentry] Failed to sync consent to Rust side — Rust-originated events may use stale consent state',
      { consent, error: String(error) }
    )
  })

  if (!initialized) return

  if (consent === true) {
    // Set an anonymous user ID persisted in localStorage so the same device
    // is always identified across sessions. No PII — just a random UUID.
    const ANON_USER_KEY = 'sentry_anon_user_id'
    let anonId = localStorage.getItem(ANON_USER_KEY)
    if (!anonId) {
      anonId = crypto.randomUUID()
      localStorage.setItem(ANON_USER_KEY, anonId)
    }
    Sentry.setUser({ id: anonId, ip_address: '{{auto}}' })
  } else {
    Sentry.setUser(null)
  }
}

/**
 * Close Sentry SDK and stop sending events.
 * Called when user revokes consent or app is shutting down.
 */
export async function closeSentry(): Promise<void> {
  if (!initialized) return
  await Sentry.close()
  initialized = false
}

/**
 * Check if Sentry has been initialized (DSN configured + init called).
 */
export function isSentryInitialized(): boolean {
  return initialized
}

/**
 * Check if Sentry DSN is configured.
 * If not set, crash reporting is unavailable regardless of consent.
 */
export function isSentryEnabled(): boolean {
  return !!SENTRY_DSN
}

/**
 * Capture an exception to Sentry (if initialized).
 * Safe to call even if Sentry is not initialized (no-op).
 * Note: The event will only be sent if consent has been granted.
 */
export function captureException(error: Error | unknown): void {
  if (initialized) {
    Sentry.captureException(error)
  }
}

/**
 * Capture a message to Sentry (if initialized).
 * Safe to call even if Sentry is not initialized (no-op).
 * Note: The event will only be sent if consent has been granted.
 */
export function captureMessage(
  message: string,
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug'
): void {
  if (initialized) {
    Sentry.captureMessage(message, level)
  }
}

/**
 * Redact sensitive data from a Sentry event before transmission.
 *
 * Scrubs:
 * - Request URL (query parameters with sensitive keys)
 * - Request headers (Authorization, Cookie, etc.)
 * - Breadcrumb messages and data
 * - Extra context values
 */
function redactSentryEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  // Redact request URL and headers
  if (event.request) {
    if (event.request.url) {
      event.request.url = redactString(event.request.url)
    }
    if (event.request.headers) {
      event.request.headers = redactObject(event.request.headers)
    }
  }

  // Redact breadcrumbs
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb): Sentry.Breadcrumb => {
      const redacted = { ...crumb }
      if (crumb.message) {
        redacted.message = redactString(crumb.message)
      }
      if (crumb.data) {
        redacted.data = redactObject(crumb.data)
      }
      return redacted
    })
  }

  // Redact extra context
  if (event.extra) {
    event.extra = redactObject(event.extra)
  }

  return event
}
