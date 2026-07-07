import { useEffect, useState } from 'react'
import * as Sentry from '@sentry/react'
import { initializeCommandSystem } from './lib/commands'
import { buildAppMenu, setupMenuLanguageListener } from './lib/menu'
import { initializeLanguage } from './i18n/language-init'
import { logger } from './lib/logger'
import { cleanupOldFiles } from './lib/recovery'
import './App.css'
import { MainWindow } from './components/layout/MainWindow'
import { ThemeProvider } from './components/ThemeProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useSquareCornersEffect } from './hooks/useSquareCornersEffect'
import { useDeepLink } from './hooks/use-deep-link'
import { useCrashReporting } from './hooks/use-crash-reporting'
import { useAutoUpdater } from './hooks/use-auto-updater'
import { isSentryInitialized } from './lib/sentry'
import { usePreferences } from './queries/preferences'

/** Debug panel for Sentry E2E testing — only shown in dev mode. */
function SentryDebugPanel() {
  const [lastEvent, setLastEvent] = useState<string>('')

  const triggerJsError = () => {
    const msg = `E2E JS error @ ${new Date().toISOString()}`
    Sentry.captureMessage(msg, 'error')
    setLastEvent(`Sent: ${msg}`)
    logger.info('E2E: Triggered JS Sentry event', { msg })
  }

  const triggerUnhandledRejection = () => {
    const msg = `E2E unhandled rejection @ ${new Date().toISOString()}`
    Promise.reject(new Error(msg))
    setLastEvent(`Triggered: ${msg}`)
  }

  if (!import.meta.env.DEV) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 8,
        right: 8,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.85)',
        color: '#0f0',
        padding: 12,
        borderRadius: 8,
        fontFamily: 'monospace',
        fontSize: 12,
        maxWidth: 320,
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
        Sentry E2E Debug
      </div>
      <div>Sentry init: {isSentryInitialized() ? 'Yes' : 'No'}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <button onClick={triggerJsError} style={{ fontSize: 11 }}>
          JS Error
        </button>
        <button onClick={triggerUnhandledRejection} style={{ fontSize: 11 }}>
          Unhandled Rejection
        </button>
      </div>
      {lastEvent && (
        <div style={{ marginTop: 6, color: '#ff0', fontSize: 10 }}>
          {lastEvent}
        </div>
      )}
    </div>
  )
}

function App() {
  useSquareCornersEffect()
  useDeepLink()
  useCrashReporting()
  useAutoUpdater()

  // Reuse the preferences query (cached by TanStack Query) to avoid
  // a duplicate IPC call for language initialization.
  const { data: preferences } = usePreferences()

  // Initialize command system, language, menu, and recovery cleanup on startup
  useEffect(() => {
    logger.info('Frontend application starting up')
    initializeCommandSystem()
    logger.debug('Command system initialized')

    // Initialize language based on saved preference or system locale
    const initLanguageAndMenu = async () => {
      try {
        const savedLanguage = preferences?.language ?? null

        // Initialize language (will use system locale if no preference)
        await initializeLanguage(savedLanguage)

        // Build the application menu with the initialized language
        await buildAppMenu()
        logger.debug('Application menu built')
        setupMenuLanguageListener()
      } catch (error) {
        logger.warn('Failed to initialize language or menu', { error })
      }
    }

    void initLanguageAndMenu()

    // Clean up old recovery files on startup
    cleanupOldFiles().catch(error => {
      logger.warn('Failed to cleanup old recovery files', { error })
    })

    // Example of logging with context
    logger.info('App environment', {
      isDev: import.meta.env.DEV,
      mode: import.meta.env.MODE,
    })
  }, [preferences?.language])

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <MainWindow />
        <SentryDebugPanel />
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
