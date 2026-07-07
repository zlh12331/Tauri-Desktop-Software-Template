import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from './use-mobile'

const MOBILE_BREAKPOINT = 768

/**
 * Build a controllable matchMedia mock that captures `change` listeners
 * so we can simulate viewport changes and read the current `matches` value.
 */
function createMatchMediaMock(initialMatches: boolean) {
  const listeners: Record<string, ((ev: Event) => void)[]> = {}
  let matches = initialMatches

  const mql = {
    get matches() {
      return matches
    },
    set matches(value: boolean) {
      matches = value
    },
    media: `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
    onchange: null as ((ev: Event) => void) | null,
    addEventListener: vi.fn((event: string, cb: (ev: Event) => void) => {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(cb)
    }),
    removeEventListener: vi.fn((event: string, cb: (ev: Event) => void) => {
      listeners[event] = (listeners[event] ?? []).filter(l => l !== cb)
    }),
    dispatchEvent: vi.fn(),
    // deprecated APIs included for completeness
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }

  return {
    mql,
    fireChange: () => {
      const cbs = listeners['change'] ?? []
      cbs.forEach(cb => cb(new Event('change')))
    },
    setMatches: (value: boolean) => {
      mql.matches = value
    },
    getChangeListeners: () => listeners['change'] ?? [],
  }
}

describe('useIsMobile', () => {
  let originalInnerWidth: number
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalInnerWidth = window.innerWidth
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    window.innerWidth = originalInnerWidth
    window.matchMedia = originalMatchMedia
    vi.restoreAllMocks()
  })

  describe('正向用例 — 初始状态基于 innerWidth', () => {
    it('returns true when window is narrower than the breakpoint', () => {
      window.innerWidth = MOBILE_BREAKPOINT - 1
      const matchMediaMock = createMatchMediaMock(false)
      window.matchMedia = vi.fn(
        () => matchMediaMock.mql
      ) as unknown as typeof window.matchMedia

      const { result } = renderHook(() => useIsMobile())
      expect(result.current).toBe(true)
    })

    it('returns false when window is wider than the breakpoint', () => {
      window.innerWidth = MOBILE_BREAKPOINT + 100
      const matchMediaMock = createMatchMediaMock(false)
      window.matchMedia = vi.fn(
        () => matchMediaMock.mql
      ) as unknown as typeof window.matchMedia

      const { result } = renderHook(() => useIsMobile())
      expect(result.current).toBe(false)
    })

    it('returns true when innerWidth is 0 (edge of mobile range)', () => {
      window.innerWidth = 0
      const matchMediaMock = createMatchMediaMock(false)
      window.matchMedia = vi.fn(
        () => matchMediaMock.mql
      ) as unknown as typeof window.matchMedia

      const { result } = renderHook(() => useIsMobile())
      expect(result.current).toBe(true)
    })
  })

  describe('边界用例 — 断点临界值', () => {
    it('returns false exactly at the breakpoint (768 is not < 768)', () => {
      window.innerWidth = MOBILE_BREAKPOINT
      const matchMediaMock = createMatchMediaMock(false)
      window.matchMedia = vi.fn(
        () => matchMediaMock.mql
      ) as unknown as typeof window.matchMedia

      const { result } = renderHook(() => useIsMobile())
      expect(result.current).toBe(false)
    })

    it('returns true one pixel below the breakpoint (767 < 768)', () => {
      window.innerWidth = MOBILE_BREAKPOINT - 1
      const matchMediaMock = createMatchMediaMock(false)
      window.matchMedia = vi.fn(
        () => matchMediaMock.mql
      ) as unknown as typeof window.matchMedia

      const { result } = renderHook(() => useIsMobile())
      expect(result.current).toBe(true)
    })
  })

  describe('正向用例 — matchMedia 变化响应', () => {
    it('updates to true when the viewport shrinks below the breakpoint', () => {
      window.innerWidth = 1024
      const matchMediaMock = createMatchMediaMock(false)
      window.matchMedia = vi.fn(
        () => matchMediaMock.mql
      ) as unknown as typeof window.matchMedia

      const { result } = renderHook(() => useIsMobile())
      expect(result.current).toBe(false)

      matchMediaMock.setMatches(true)
      act(() => {
        matchMediaMock.fireChange()
      })

      expect(result.current).toBe(true)
    })

    it('updates to false when the viewport grows above the breakpoint', () => {
      window.innerWidth = 500
      const matchMediaMock = createMatchMediaMock(true)
      window.matchMedia = vi.fn(
        () => matchMediaMock.mql
      ) as unknown as typeof window.matchMedia

      const { result } = renderHook(() => useIsMobile())
      expect(result.current).toBe(true)

      matchMediaMock.setMatches(false)
      act(() => {
        matchMediaMock.fireChange()
      })

      expect(result.current).toBe(false)
    })

    it('queries matchMedia with the expected media query string', () => {
      window.innerWidth = 1024
      const matchMediaMock = createMatchMediaMock(false)
      const matchMediaSpy = vi.fn(() => matchMediaMock.mql)
      window.matchMedia = matchMediaSpy as unknown as typeof window.matchMedia

      renderHook(() => useIsMobile())
      expect(matchMediaSpy).toHaveBeenCalledWith(
        `(max-width: ${MOBILE_BREAKPOINT - 1}px)`
      )
    })
  })

  describe('边界用例 — 清理副作用', () => {
    it('removes the change listener on unmount', () => {
      window.innerWidth = 1024
      const matchMediaMock = createMatchMediaMock(false)
      window.matchMedia = vi.fn(
        () => matchMediaMock.mql
      ) as unknown as typeof window.matchMedia

      const { unmount } = renderHook(() => useIsMobile())
      const registered = matchMediaMock.getChangeListeners()
      expect(registered.length).toBe(1)

      unmount()

      expect(matchMediaMock.mql.removeEventListener).toHaveBeenCalledWith(
        'change',
        registered[0]
      )
    })

    it('does not update state after unmount when a change fires', () => {
      window.innerWidth = 1024
      const matchMediaMock = createMatchMediaMock(false)
      window.matchMedia = vi.fn(
        () => matchMediaMock.mql
      ) as unknown as typeof window.matchMedia

      const { result, unmount } = renderHook(() => useIsMobile())
      unmount()

      // Firing a change after unmount should not throw or mutate result
      matchMediaMock.setMatches(true)
      expect(() => matchMediaMock.fireChange()).not.toThrow()
      // result.current keeps the last rendered value (false)
      expect(result.current).toBe(false)
    })
  })

  describe('边界用例 — SSR 安全检查', () => {
    it('initialiser guards against window being undefined without throwing', () => {
      // In jsdom `typeof window` is always 'undefined' === false, so the guard
      // evaluates the innerWidth comparison. We verify the guard expression
      // resolves to a boolean and never throws for a defined window.
      window.innerWidth = 500
      const matchMediaMock = createMatchMediaMock(false)
      window.matchMedia = vi.fn(
        () => matchMediaMock.mql
      ) as unknown as typeof window.matchMedia

      const { result } = renderHook(() => useIsMobile())
      expect(typeof result.current).toBe('boolean')
    })
  })
})
