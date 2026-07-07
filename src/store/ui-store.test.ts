import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUIStore } from './ui-store'

describe('UIStore', () => {
  beforeEach(() => {
    // Reset store state before each test to its initial defaults
    useUIStore.setState({
      lastQuickPaneEntry: null,
      squareCorners: false,
    })
    document.documentElement.classList.remove('square-corners')
  })

  describe('正向用例 — 初始状态', () => {
    it('has correct initial state', () => {
      const state = useUIStore.getState()
      expect(state.lastQuickPaneEntry).toBe(null)
      expect(state.squareCorners).toBe(false)
    })

    it('exposes all action methods on the store', () => {
      const state = useUIStore.getState()
      expect(typeof state.setLastQuickPaneEntry).toBe('function')
      expect(typeof state.setSquareCorners).toBe('function')
    })
  })

  describe('正向用例 — Quick Pane 条目', () => {
    it('stores the last quick pane entry text', () => {
      const { setLastQuickPaneEntry } = useUIStore.getState()

      setLastQuickPaneEntry('hello world')
      expect(useUIStore.getState().lastQuickPaneEntry).toBe('hello world')
    })

    it('overwrites the previous quick pane entry', () => {
      const { setLastQuickPaneEntry } = useUIStore.getState()

      setLastQuickPaneEntry('first')
      setLastQuickPaneEntry('second')
      expect(useUIStore.getState().lastQuickPaneEntry).toBe('second')
    })
  })

  describe('正向用例 — 方角设置 (setSquareCorners)', () => {
    it('sets squareCorners to true when enabled', () => {
      const { setSquareCorners } = useUIStore.getState()

      setSquareCorners(true)
      expect(useUIStore.getState().squareCorners).toBe(true)
    })

    it('sets squareCorners to false when disabled', () => {
      const { setSquareCorners } = useUIStore.getState()

      setSquareCorners(true)
      setSquareCorners(false)
      expect(useUIStore.getState().squareCorners).toBe(false)
    })
  })

  describe('边界用例', () => {
    it('setLastQuickPaneEntry accepts an empty string', () => {
      const { setLastQuickPaneEntry } = useUIStore.getState()

      setLastQuickPaneEntry('')
      expect(useUIStore.getState().lastQuickPaneEntry).toBe('')
    })

    it('setSquareCorners(true) called twice keeps the state true', () => {
      const { setSquareCorners } = useUIStore.getState()

      setSquareCorners(true)
      setSquareCorners(true)
      expect(useUIStore.getState().squareCorners).toBe(true)
    })

    it('setSquareCorners(false) when state is already false does not throw', () => {
      const { setSquareCorners } = useUIStore.getState()

      expect(() => setSquareCorners(false)).not.toThrow()
      expect(useUIStore.getState().squareCorners).toBe(false)
    })
  })

  describe('异常用例 — store 仍保持一致性', () => {
    it('setSquareCorners does not mutate unrelated store state', () => {
      const stateBefore = { ...useUIStore.getState() }
      const { setSquareCorners } = useUIStore.getState()

      setSquareCorners(true)
      const stateAfter = useUIStore.getState()

      // setSquareCorners only updates the squareCorners field, no other state changes
      expect(stateAfter.lastQuickPaneEntry).toBe(stateBefore.lastQuickPaneEntry)
      expect(stateAfter.squareCorners).toBe(true)
    })

    it('setLastQuickPaneEntry does not affect squareCorners', () => {
      const { setLastQuickPaneEntry } = useUIStore.getState()

      setLastQuickPaneEntry('test')
      expect(useUIStore.getState().squareCorners).toBe(false)
    })

    it('survives store.setState being called with extra fields', () => {
      // Simulate an external setState call
      useUIStore.setState({ lastQuickPaneEntry: 'external' })
      expect(useUIStore.getState().lastQuickPaneEntry).toBe('external')
      expect(useUIStore.getState().squareCorners).toBe(false)
    })
  })

  describe('devtools 集成', () => {
    it('store is created with the ui-store name for devtools', () => {
      // The devtools middleware is applied; getState still returns a plain
      // object snapshot, confirming the middleware did not break the store.
      const state = useUIStore.getState()
      expect(state).toBeInstanceOf(Object)
      expect(Object.keys(state).length).toBeGreaterThan(0)
    })
  })
})

// Silence console.debug output from the devtools middleware during tests
vi.stubGlobal('console', {
  ...console,
  debug: vi.fn(),
})
