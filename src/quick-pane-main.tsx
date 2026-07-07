import ReactDOM from 'react-dom/client'
import { StrictMode } from 'react'
import QuickPaneApp from './components/quick-pane/QuickPaneApp'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initSentry } from './lib/sentry'
import './i18n/config'
import './quick-pane.css'

// Initialize Sentry before rendering so runtime errors in the quick pane
// window are captured. The DSN and consent gate are handled inside initSentry.
initSentry()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ErrorBoundary>
      <QuickPaneApp />
    </ErrorBoundary>
  </StrictMode>
)
