import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { motion } from 'motion/react'
import { emit, listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { commands } from '@/lib/tauri-bindings'
import i18n from '@/i18n/config'
import { logger } from '@/lib/logger'
import { scaleFadeVariants, gentleSpring } from '@/lib/animations'
import { applyThemeClass, isValidTheme, readStoredTheme } from '@/lib/theme'
import type { Theme } from '@/lib/theme-context'

/** Dismiss the quick pane window, logging any errors */
async function dismissQuickPane() {
  const result = await commands.dismissQuickPane()
  if (result.status === 'error') {
    logger.error('Failed to dismiss quick pane', { error: result.error })
  }
}

/**
 * QuickPaneApp - A minimal floating window for quick text entry.
 *
 * Theme is synced with the main window via Tauri events (theme-changed).
 * The inline script in quick-pane.html applies the theme before first paint
 * to prevent FOUC. This component then keeps the DOM class in sync via
 * useLayoutEffect and event listeners.
 */
export default function QuickPaneApp() {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme())

  // Apply theme class before paint and react to theme changes
  useLayoutEffect(() => {
    applyThemeClass(theme)

    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      applyThemeClass(e.matches ? 'dark' : 'light')
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  // Listen for theme changes from the main window
  useEffect(() => {
    const unlistenPromise = listen<{ theme: string }>(
      'theme-changed',
      event => {
        const newTheme = event.payload.theme
        if (isValidTheme(newTheme)) {
          setTheme(newTheme)
        }
      }
    )

    return () => {
      unlistenPromise.then(fn => fn())
    }
  }, [])

  // Focus input when window becomes visible, hide on blur
  useEffect(() => {
    const currentWindow = getCurrentWindow()
    const unlisten = currentWindow.onFocusChanged(
      async ({ payload: focused }) => {
        if (focused) {
          // Re-sync theme from localStorage in case it changed while hidden
          setTheme(readStoredTheme())
          inputRef.current?.focus()
        } else {
          // Hide window when it loses focus (dismiss on blur)
          await dismissQuickPane()
        }
      }
    )

    return () => {
      unlisten.then(fn => fn())
    }
  }, [])

  // Handle Escape key to dismiss
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault() // Prevent system "boop" sound
        await dismissQuickPane()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (text.trim()) {
      // Emit the event for main window to handle
      await emit('quick-pane-submit', { text: text.trim() })
      setText('')
    }

    // Use dismiss command to avoid space switching on macOS
    await dismissQuickPane()
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      variants={scaleFadeVariants}
      initial="initial"
      animate="animate"
      transition={gentleSpring}
      className="flex h-screen w-screen items-center rounded-[var(--app-corner-radius)] border border-border bg-background px-5 shadow-lg"
    >
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={i18n.t('quickPane.placeholder')}
        className="w-full bg-transparent text-lg text-foreground placeholder:text-muted-foreground outline-none"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </motion.form>
  )
}
