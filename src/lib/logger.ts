/**
 * Logging utility for the frontend.
 *
 * Routing strategy (resolves the "triple logging" problem by giving each
 * mechanism a single, non-overlapping responsibility):
 * - **Development**: logs to the browser console with a `[timestamp] [LEVEL]`
 *   prefix for ergonomic local debugging.
 * - **Production**: forwards logs to Sentry Logs via `Sentry.logger` (structured
 *   log aggregation on the self-hosted Sentry instance). Console output is
 *   suppressed to keep production noise low.
 *
 * This module imports `@sentry/react` directly rather than `@/lib/sentry` to
 * avoid a circular dependency: `sentry.ts` imports `@/lib/tauri-bindings`,
 * while `logger.ts` must stay free of any Tauri coupling. `Sentry.logger`
 * methods are no-ops when the SDK is uninitialized or `enableLogs` is off, so
 * it is safe to call them unconditionally.
 *
 * The third logging mechanism — `tauri-plugin-log` on the Rust side — is
 * independent: Rust logs are forwarded to the webview console in dev and to
 * the app log directory in production. See `docs/developer/logging.en.md`.
 */
import * as Sentry from '@sentry/react'

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: Date
  context?: Record<string, unknown> | undefined
}

class Logger {
  private isDevelopment = import.meta.env.DEV

  /**
   * Log a trace message (most verbose)
   */
  trace(message: string, context?: Record<string, unknown>): void {
    this.log('trace', message, context)
  }

  /**
   * Log a debug message (development only)
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context)
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context)
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context)
  }

  /**
   * Log an error message
   */
  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context)
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
    }

    // Development: ergonomic console output for local debugging.
    // Production: forward to Sentry Logs (structured remote aggregation).
    if (this.isDevelopment) {
      this.logToConsole(entry)
    } else {
      this.logToSentry(entry)
    }
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString()
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}]`

    const args = entry.context
      ? [prefix, entry.message, entry.context]
      : [prefix, entry.message]

    switch (entry.level) {
      case 'trace':
      case 'debug':
        console.debug(...args)
        break
      case 'info':
        console.info(...args)
        break
      case 'warn':
        console.warn(...args)
        break
      case 'error':
        console.error(...args)
        break
    }
  }

  /**
   * In production, forward logs to Sentry Logs (`Sentry.logger`).
   *
   * `Sentry.logger.{trace,debug,info,warn,error}` are no-ops when the SDK is
   * not initialized or `enableLogs` is disabled, so this is safe to call
   * unconditionally. Events are only transmitted after the user grants
   * consent (see `sentry.ts` → `beforeSend` gate).
   *
   * An empty attributes object is passed when no context is provided, to
   * satisfy `exactOptionalPropertyTypes` without conditionally branching on
   * every log level.
   */
  private logToSentry(entry: LogEntry): void {
    const attributes: Record<string, unknown> =
      entry.context !== undefined ? entry.context : {}
    switch (entry.level) {
      case 'trace':
        Sentry.logger.trace(entry.message, attributes)
        break
      case 'debug':
        Sentry.logger.debug(entry.message, attributes)
        break
      case 'info':
        Sentry.logger.info(entry.message, attributes)
        break
      case 'warn':
        Sentry.logger.warn(entry.message, attributes)
        break
      case 'error':
        Sentry.logger.error(entry.message, attributes)
        break
    }
  }
}

// Export a singleton logger instance
export const logger = new Logger()

// Export individual logging functions for convenience
export const { trace, debug, info, warn, error } = logger
