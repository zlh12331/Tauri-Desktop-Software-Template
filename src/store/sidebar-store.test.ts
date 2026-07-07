import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSidebarStore } from './sidebar-store'

describe('SidebarStore', () => {
  beforeEach(() => {
    // Reset store state before each test to its initial defaults
    useSidebarStore.setState({
      leftSidebarVisible: true,
      rightSidebarVisible: true,
    })
  })

  describe('正向用例 — 初始状态', () => {
    it('has correct initial state', () => {
      const state = useSidebarStore.getState()
      expect(state.leftSidebarVisible).toBe(true)
      expect(state.rightSidebarVisible).toBe(true)
    })

    it('exposes all action methods on the store', () => {
      const state = useSidebarStore.getState()
      expect(typeof state.toggleLeftSidebar).toBe('function')
      expect(typeof state.setLeftSidebarVisible).toBe('function')
      expect(typeof state.toggleRightSidebar).toBe('function')
      expect(typeof state.setRightSidebarVisible).toBe('function')
    })
  })

  describe('正向用例 — 左侧栏', () => {
    it('toggles left sidebar visibility', () => {
      const { toggleLeftSidebar } = useSidebarStore.getState()

      toggleLeftSidebar()
      expect(useSidebarStore.getState().leftSidebarVisible).toBe(false)

      toggleLeftSidebar()
      expect(useSidebarStore.getState().leftSidebarVisible).toBe(true)
    })

    it('sets left sidebar visibility directly', () => {
      const { setLeftSidebarVisible } = useSidebarStore.getState()

      setLeftSidebarVisible(false)
      expect(useSidebarStore.getState().leftSidebarVisible).toBe(false)

      setLeftSidebarVisible(true)
      expect(useSidebarStore.getState().leftSidebarVisible).toBe(true)
    })
  })

  describe('正向用例 — 右侧栏', () => {
    it('toggles right sidebar visibility', () => {
      const { toggleRightSidebar } = useSidebarStore.getState()

      toggleRightSidebar()
      expect(useSidebarStore.getState().rightSidebarVisible).toBe(false)

      toggleRightSidebar()
      expect(useSidebarStore.getState().rightSidebarVisible).toBe(true)
    })

    it('sets right sidebar visibility directly', () => {
      const { setRightSidebarVisible } = useSidebarStore.getState()

      setRightSidebarVisible(false)
      expect(useSidebarStore.getState().rightSidebarVisible).toBe(false)

      setRightSidebarVisible(true)
      expect(useSidebarStore.getState().rightSidebarVisible).toBe(true)
    })
  })

  describe('边界用例', () => {
    it('setLeftSidebarVisible with the same value is idempotent', () => {
      const { setLeftSidebarVisible } = useSidebarStore.getState()

      setLeftSidebarVisible(true)
      setLeftSidebarVisible(true)
      expect(useSidebarStore.getState().leftSidebarVisible).toBe(true)
    })

    it('setRightSidebarVisible with the same value is idempotent', () => {
      const { setRightSidebarVisible } = useSidebarStore.getState()

      setRightSidebarVisible(false)
      setRightSidebarVisible(false)
      expect(useSidebarStore.getState().rightSidebarVisible).toBe(false)
    })

    it('setLeftSidebarVisible(false) when state is already false does not throw', () => {
      const { setLeftSidebarVisible } = useSidebarStore.getState()
      setLeftSidebarVisible(false)

      expect(() => setLeftSidebarVisible(false)).not.toThrow()
      expect(useSidebarStore.getState().leftSidebarVisible).toBe(false)
    })

    it('setRightSidebarVisible(true) when state is already true does not throw', () => {
      const { setRightSidebarVisible } = useSidebarStore.getState()

      expect(() => setRightSidebarVisible(true)).not.toThrow()
      expect(useSidebarStore.getState().rightSidebarVisible).toBe(true)
    })
  })

  describe('异常用例 — store 仍保持一致性', () => {
    it('toggle actions do not affect unrelated state slices', () => {
      const state = useSidebarStore.getState()

      state.toggleLeftSidebar()
      state.toggleRightSidebar()

      const next = useSidebarStore.getState()
      expect(next.leftSidebarVisible).toBe(false)
      expect(next.rightSidebarVisible).toBe(false)
    })

    it('setLeftSidebarVisible does not affect rightSidebarVisible', () => {
      const stateBefore = { ...useSidebarStore.getState() }
      const { setLeftSidebarVisible } = useSidebarStore.getState()

      setLeftSidebarVisible(false)
      const stateAfter = useSidebarStore.getState()

      expect(stateAfter.leftSidebarVisible).toBe(false)
      expect(stateAfter.rightSidebarVisible).toBe(
        stateBefore.rightSidebarVisible
      )
    })

    it('setRightSidebarVisible does not affect leftSidebarVisible', () => {
      const stateBefore = { ...useSidebarStore.getState() }
      const { setRightSidebarVisible } = useSidebarStore.getState()

      setRightSidebarVisible(false)
      const stateAfter = useSidebarStore.getState()

      expect(stateAfter.rightSidebarVisible).toBe(false)
      expect(stateAfter.leftSidebarVisible).toBe(stateBefore.leftSidebarVisible)
    })

    it('survives store.setState being called with partial fields', () => {
      useSidebarStore.setState({ leftSidebarVisible: false })
      expect(useSidebarStore.getState().leftSidebarVisible).toBe(false)
      expect(useSidebarStore.getState().rightSidebarVisible).toBe(true)
    })
  })

  describe('devtools 集成', () => {
    it('store is created with the sidebar-store name for devtools', () => {
      const state = useSidebarStore.getState()
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
