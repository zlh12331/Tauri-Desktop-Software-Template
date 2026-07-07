import ReactDOM from 'react-dom/client'
import { StrictMode, lazy, Suspense } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { initSentry } from './lib/sentry'
import './i18n'
import App from './App'
import { queryClient } from './lib/query-client'

// Initialize Sentry before any React code runs.
// Events are captured but NOT sent until user grants consent
// (see use-crash-reporting.ts → setSentryConsent(true)).
// This ensures startup errors are captured even before consent is given.
initSentry()

// Lazy-load ReactQueryDevtools only in development to keep production
// bundle free of devtools code (~30-50 KB gzipped).
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then(m => ({
        default: m.ReactQueryDevtools,
      }))
    )
  : () => null

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Suspense fallback={null}>
        <ReactQueryDevtools initialIsOpen={false} />
      </Suspense>
    </QueryClientProvider>
  </StrictMode>
)
