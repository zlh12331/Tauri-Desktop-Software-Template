import type { Transition, Variants } from 'motion/react'

/**
 * Shared animation presets for the application.
 *
 * Style: 流畅优雅 (smooth & elegant) — spring-based, 250-300ms.
 * These presets ensure consistent motion across all animated components.
 */

/** Default spring transition — smooth, non-bouncy, ~250ms. */
export const springTransition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 0.8,
}

/** Gentler spring for larger elements (dialogs, panels) — ~300ms. */
export const gentleSpring: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 26,
  mass: 1,
}

/** Fade in/out — for content area transitions. */
export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

/** Slide from right + fade — for preferences pane transitions. */
export const slideRightVariants: Variants = {
  initial: { opacity: 0, x: -12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 12 },
}

/** Slide from left + fade — for right sidebar content. */
export const slideLeftVariants: Variants = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
}

/** Scale + fade — for quick pane entrance. */
export const scaleFadeVariants: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
}
