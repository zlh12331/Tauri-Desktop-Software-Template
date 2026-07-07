import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDialogStore } from './dialog-store'

describe('DialogStore', () => {
  beforeEach(() => {
    // Reset store state before each test to its initial defaults
    useDialogStore.setState({
      commandPaletteOpen: false,
      preferencesOpen: false,
    })
  })

  describe('正向用例 — 初始状态', () => {
    it('has correct initial state', () => {
      const state = useDialogStore.getState()
      expect(state.commandPaletteOpen).toBe(false)
      expect(state.preferencesOpen).toBe(false)
    })

    it('exposes all action methods on the store', () => {
      const state = useDialogStore.getState()
      expect(typeof state.toggleCommandPalette).toBe('function')
      expect(typeof state.setCommandPaletteOpen).toBe('function')
      expect(typeof state.togglePreferences).toBe('function')
      expect(typeof state.setPreferencesOpen).toBe('function')
    })
  })

  describe('正向用例 — 命令面板', () => {
    it('toggles command palette', () => {
      const { toggleCommandPalette } = useDialogStore.getState()

      toggleCommandPalette()
      expect(useDialogStore.getState().commandPaletteOpen).toBe(true)

      toggleCommandPalette()
      expect(useDialogStore.getState().commandPaletteOpen).toBe(false)
    })

    it('sets command palette open directly', () => {
      const { setCommandPaletteOpen } = useDialogStore.getState()

      setCommandPaletteOpen(true)
      expect(useDialogStore.getState().commandPaletteOpen).toBe(true)

      setCommandPaletteOpen(false)
      expect(useDialogStore.getState().commandPaletteOpen).toBe(false)
    })
  })

  describe('正向用例 — 偏好设置', () => {
    it('toggles preferences dialog', () => {
      const { togglePreferences } = useDialogStore.getState()

      togglePreferences()
      expect(useDialogStore.getState().preferencesOpen).toBe(true)

      togglePreferences()
      expect(useDialogStore.getState().preferencesOpen).toBe(false)
    })

    it('sets preferences open directly', () => {
      const { setPreferencesOpen } = useDialogStore.getState()

      setPreferencesOpen(true)
      expect(useDialogStore.getState().preferencesOpen).toBe(true)

      setPreferencesOpen(false)
      expect(useDialogStore.getState().preferencesOpen).toBe(false)
    })
  })

  describe('边界用例', () => {
    it('setCommandPaletteOpen with the same value is idempotent', () => {
      const { setCommandPaletteOpen } = useDialogStore.getState()

      setCommandPaletteOpen(true)
      setCommandPaletteOpen(true)
      expect(useDialogStore.getState().commandPaletteOpen).toBe(true)
    })

    it('setPreferencesOpen with the same value is idempotent', () => {
      const { setPreferencesOpen } = useDialogStore.getState()

      setPreferencesOpen(false)
      setPreferencesOpen(false)
      expect(useDialogStore.getState().preferencesOpen).toBe(false)
    })

    it('setCommandPaletteOpen(false) when state is already false does not throw', () => {
      const { setCommandPaletteOpen } = useDialogStore.getState()

      expect(() => setCommandPaletteOpen(false)).not.toThrow()
      expect(useDialogStore.getState().commandPaletteOpen).toBe(false)
    })

    it('setPreferencesOpen(true) when state is already true does not throw', () => {
      const { setPreferencesOpen } = useDialogStore.getState()
      setPreferencesOpen(true)

      expect(() => setPreferencesOpen(true)).not.toThrow()
      expect(useDialogStore.getState().preferencesOpen).toBe(true)
    })
  })

  describe('异常用例 — store 仍保持一致性', () => {
    it('toggle actions do not affect unrelated state slices', () => {
      const state = useDialogStore.getState()

      state.toggleCommandPalette()
      state.togglePreferences()

      const next = useDialogStore.getState()
      expect(next.commandPaletteOpen).toBe(true)
      expect(next.preferencesOpen).toBe(true)
    })

    it('setCommandPaletteOpen does not affect preferencesOpen', () => {
      const stateBefore = { ...useDialogStore.getState() }
      const { setCommandPaletteOpen } = useDialogStore.getState()

      setCommandPaletteOpen(true)
      const stateAfter = useDialogStore.getState()

      expect(stateAfter.commandPaletteOpen).toBe(true)
      expect(stateAfter.preferencesOpen).toBe(stateBefore.preferencesOpen)
    })

    it('setPreferencesOpen does not affect commandPaletteOpen', () => {
      const stateBefore = { ...useDialogStore.getState() }
      const { setPreferencesOpen } = useDialogStore.getState()

      setPreferencesOpen(true)
      const stateAfter = useDialogStore.getState()

      expect(stateAfter.preferencesOpen).toBe(true)
      expect(stateAfter.commandPaletteOpen).toBe(stateBefore.commandPaletteOpen)
    })

    it('survives store.setState being called with partial fields', () => {
      useDialogStore.setState({ commandPaletteOpen: true })
      expect(useDialogStore.getState().commandPaletteOpen).toBe(true)
      expect(useDialogStore.getState().preferencesOpen).toBe(false)
    })
  })

  describe('devtools 集成', () => {
    it('store is created with the dialog-store name for devtools', () => {
      const state = useDialogStore.getState()
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
