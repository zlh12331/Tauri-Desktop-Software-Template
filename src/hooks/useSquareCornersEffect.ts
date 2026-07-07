import { useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useUIStore, type UIState } from '@/store/ui-store'
import { usePlatform } from './use-platform'

/**
 * Manages square corners based on platform and fullscreen state.
 *
 * Rules:
 * - macOS: always rounded (OS handles window corners)
 * - Windows: square when fullscreen (no rounded corners needed at screen edge)
 * - Linux: square when fullscreen
 *
 * Architecture: This hook updates the `squareCorners` boolean in the Zustand
 * store (pure state). A separate effect below subscribes to that state and
 * syncs it to the DOM, keeping the store free of side effects.
 */
export function useSquareCornersEffect() {
  const platform = usePlatform()
  const setSquareCorners = useUIStore(
    (state: UIState) => state.setSquareCorners
  )

  // Update the store state based on platform / fullscreen changes.
  useEffect(() => {
    // macOS always has rounded corners via windowEffects
    if (platform === 'macos') {
      setSquareCorners(false)
      return
    }

    let cancelled = false
    const window = getCurrentWindow()

    const updateCorners = async () => {
      const isFullscreen = await window.isFullscreen()
      if (cancelled) return
      // Windows/Linux: square corners only in fullscreen
      setSquareCorners(isFullscreen)
    }

    // Check initial state
    void updateCorners()

    // Listen for window state changes
    const unlisten = window.onResized(() => {
      if (cancelled) return
      void updateCorners()
    })

    return () => {
      cancelled = true
      void unlisten.then(fn => fn())
    }
  }, [platform, setSquareCorners])

  // Sync the `squareCorners` store state to the DOM.
  // This keeps the store pure (no DOM manipulation in setters).
  const squareCorners = useUIStore((state: UIState) => state.squareCorners)
  useEffect(() => {
    document.documentElement.classList.toggle('square-corners', squareCorners)
  }, [squareCorners])
}
