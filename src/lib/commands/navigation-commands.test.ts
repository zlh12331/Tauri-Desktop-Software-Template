import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CommandContext } from './types'

// Mock @/store/sidebar-store — navigation commands read & mutate sidebar store state
const mockSetLeftSidebarVisible = vi.fn()
const mockSetRightSidebarVisible = vi.fn()
const mockToggleLeftSidebar = vi.fn()
const mockToggleRightSidebar = vi.fn()
const mockGetState = vi.fn()

vi.mock('@/store/sidebar-store', () => ({
  useSidebarStore: { getState: mockGetState },
}))

// Import the module under test AFTER mocks are hoisted.
// lucide-react is left unmocked (it already loads cleanly under jsdom, matching
// the existing commands.test.ts convention) and only provides icon references.
const { navigationCommands } = await import('./navigation-commands')

const createMockContext = (): CommandContext => ({
  openPreferences: vi.fn(),
  showToast: vi.fn(),
})

const findCommand = (id: string) =>
  navigationCommands.find(cmd => cmd.id === id)

interface StoreOverrides {
  leftSidebarVisible?: boolean
  rightSidebarVisible?: boolean
}

const setState = (overrides: StoreOverrides = {}) => {
  mockGetState.mockReturnValue({
    leftSidebarVisible: false,
    rightSidebarVisible: false,
    setLeftSidebarVisible: mockSetLeftSidebarVisible,
    setRightSidebarVisible: mockSetRightSidebarVisible,
    toggleLeftSidebar: mockToggleLeftSidebar,
    toggleRightSidebar: mockToggleRightSidebar,
    ...overrides,
  })
}

describe('navigationCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSetLeftSidebarVisible.mockReset()
    mockSetRightSidebarVisible.mockReset()
    mockToggleLeftSidebar.mockReset()
    mockToggleRightSidebar.mockReset()
    mockGetState.mockReset()
    setState()
  })

  describe('正向用例 — module structure', () => {
    it('exports seven navigation commands', () => {
      expect(navigationCommands).toHaveLength(7)
    })

    it('contains all expected command ids in order', () => {
      const ids = navigationCommands.map(c => c.id)
      expect(ids).toEqual([
        'show-left-sidebar',
        'hide-left-sidebar',
        'show-right-sidebar',
        'hide-right-sidebar',
        'open-preferences',
        'toggle-left-sidebar',
        'toggle-right-sidebar',
      ])
    })

    it('sidebar commands belong to the navigation group', () => {
      for (const id of [
        'show-left-sidebar',
        'hide-left-sidebar',
        'show-right-sidebar',
        'hide-right-sidebar',
      ]) {
        expect(findCommand(id)?.group).toBe('navigation')
      }
    })

    it('open-preferences belongs to the settings group', () => {
      expect(findCommand('open-preferences')?.group).toBe('settings')
    })

    it('each command defines labelKey and descriptionKey', () => {
      for (const cmd of navigationCommands) {
        expect(typeof cmd.labelKey).toBe('string')
        expect(cmd.labelKey.length).toBeGreaterThan(0)
        expect(typeof cmd.descriptionKey).toBe('string')
        expect(cmd.descriptionKey?.length).toBeGreaterThan(0)
      }
    })
  })

  describe('正向用例 — execute', () => {
    it('show-left-sidebar sets left sidebar visible to true', () => {
      setState({ leftSidebarVisible: false })
      findCommand('show-left-sidebar')?.execute(createMockContext())

      expect(mockSetLeftSidebarVisible).toHaveBeenCalledWith(true)
      expect(mockSetLeftSidebarVisible).toHaveBeenCalledTimes(1)
    })

    it('hide-left-sidebar sets left sidebar visible to false', () => {
      setState({ leftSidebarVisible: true })
      findCommand('hide-left-sidebar')?.execute(createMockContext())

      expect(mockSetLeftSidebarVisible).toHaveBeenCalledWith(false)
      expect(mockSetLeftSidebarVisible).toHaveBeenCalledTimes(1)
    })

    it('show-right-sidebar sets right sidebar visible to true', () => {
      setState({ rightSidebarVisible: false })
      findCommand('show-right-sidebar')?.execute(createMockContext())

      expect(mockSetRightSidebarVisible).toHaveBeenCalledWith(true)
      expect(mockSetRightSidebarVisible).toHaveBeenCalledTimes(1)
    })

    it('hide-right-sidebar sets right sidebar visible to false', () => {
      setState({ rightSidebarVisible: true })
      findCommand('hide-right-sidebar')?.execute(createMockContext())

      expect(mockSetRightSidebarVisible).toHaveBeenCalledWith(false)
      expect(mockSetRightSidebarVisible).toHaveBeenCalledTimes(1)
    })

    it('toggle-left-sidebar calls toggleLeftSidebar', () => {
      setState({ leftSidebarVisible: true })
      findCommand('toggle-left-sidebar')?.execute(createMockContext())

      expect(mockToggleLeftSidebar).toHaveBeenCalledTimes(1)
    })

    it('toggle-right-sidebar calls toggleRightSidebar', () => {
      setState({ rightSidebarVisible: true })
      findCommand('toggle-right-sidebar')?.execute(createMockContext())

      expect(mockToggleRightSidebar).toHaveBeenCalledTimes(1)
    })

    it('open-preferences calls context.openPreferences()', () => {
      const ctx = createMockContext()
      findCommand('open-preferences')?.execute(ctx)

      expect(ctx.openPreferences).toHaveBeenCalledTimes(1)
      expect(ctx.openPreferences).toHaveBeenCalledWith()
    })

    it('sidebar execute does not touch the toast channel', () => {
      const ctx = createMockContext()
      findCommand('show-left-sidebar')?.execute(ctx)

      expect(ctx.showToast).not.toHaveBeenCalled()
    })
  })

  describe('边界用例 — isAvailable & metadata', () => {
    it('show-left-sidebar is available when left sidebar is hidden', () => {
      setState({ leftSidebarVisible: false })
      expect(
        findCommand('show-left-sidebar')?.isAvailable?.(createMockContext())
      ).toBe(true)
    })

    it('show-left-sidebar is unavailable when left sidebar is visible', () => {
      setState({ leftSidebarVisible: true })
      expect(
        findCommand('show-left-sidebar')?.isAvailable?.(createMockContext())
      ).toBe(false)
    })

    it('hide-left-sidebar is available when left sidebar is visible', () => {
      setState({ leftSidebarVisible: true })
      expect(
        findCommand('hide-left-sidebar')?.isAvailable?.(createMockContext())
      ).toBe(true)
    })

    it('hide-left-sidebar is unavailable when left sidebar is hidden', () => {
      setState({ leftSidebarVisible: false })
      expect(
        findCommand('hide-left-sidebar')?.isAvailable?.(createMockContext())
      ).toBe(false)
    })

    it('show-right-sidebar is available when right sidebar is hidden', () => {
      setState({ rightSidebarVisible: false })
      expect(
        findCommand('show-right-sidebar')?.isAvailable?.(createMockContext())
      ).toBe(true)
    })

    it('show-right-sidebar is unavailable when right sidebar is visible', () => {
      setState({ rightSidebarVisible: true })
      expect(
        findCommand('show-right-sidebar')?.isAvailable?.(createMockContext())
      ).toBe(false)
    })

    it('hide-right-sidebar is available when right sidebar is visible', () => {
      setState({ rightSidebarVisible: true })
      expect(
        findCommand('hide-right-sidebar')?.isAvailable?.(createMockContext())
      ).toBe(true)
    })

    it('hide-right-sidebar is unavailable when right sidebar is hidden', () => {
      setState({ rightSidebarVisible: false })
      expect(
        findCommand('hide-right-sidebar')?.isAvailable?.(createMockContext())
      ).toBe(false)
    })

    it('toggle commands have no isAvailable function (always available)', () => {
      expect(findCommand('toggle-left-sidebar')?.isAvailable).toBeUndefined()
      expect(findCommand('toggle-right-sidebar')?.isAvailable).toBeUndefined()
    })

    it('open-preferences has no isAvailable function (always available)', () => {
      expect(findCommand('open-preferences')?.isAvailable).toBeUndefined()
    })

    it('commands define the expected shortcuts', () => {
      expect(findCommand('show-left-sidebar')?.shortcut).toBe('⌘+1')
      expect(findCommand('hide-left-sidebar')?.shortcut).toBe('⌘+1')
      expect(findCommand('show-right-sidebar')?.shortcut).toBe('⌘+2')
      expect(findCommand('hide-right-sidebar')?.shortcut).toBe('⌘+2')
      expect(findCommand('open-preferences')?.shortcut).toBe('⌘+,')
      expect(findCommand('toggle-left-sidebar')?.shortcut).toBe('⌘+1')
      expect(findCommand('toggle-right-sidebar')?.shortcut).toBe('⌘+2')
    })

    it('each command defines an icon component', () => {
      // lucide-react icons are wrapped with React.forwardRef, so the icon is a
      // component object (not a plain function). Accept both shapes.
      for (const cmd of navigationCommands) {
        expect(cmd.icon).toBeDefined()
        expect(cmd.icon).not.toBeNull()
        expect(typeof cmd.icon).toMatch(/^(function|object)$/)
      }
    })

    it('keywords are defined with the expected entries', () => {
      expect(findCommand('show-left-sidebar')?.keywords).toEqual([
        'sidebar',
        'left',
        'panel',
        'show',
      ])
      expect(findCommand('hide-left-sidebar')?.keywords).toEqual([
        'sidebar',
        'left',
        'panel',
        'hide',
      ])
      expect(findCommand('show-right-sidebar')?.keywords).toEqual([
        'sidebar',
        'right',
        'panel',
        'show',
      ])
      expect(findCommand('hide-right-sidebar')?.keywords).toEqual([
        'sidebar',
        'right',
        'panel',
        'hide',
      ])
      expect(findCommand('open-preferences')?.keywords).toEqual([
        'preferences',
        'settings',
        'config',
        'options',
      ])
      expect(findCommand('toggle-left-sidebar')?.keywords).toEqual([
        'sidebar',
        'left',
        'panel',
        'toggle',
      ])
      expect(findCommand('toggle-right-sidebar')?.keywords).toEqual([
        'sidebar',
        'right',
        'panel',
        'toggle',
      ])
    })
  })

  describe('异常用例 — error propagation', () => {
    it('propagates error when setLeftSidebarVisible throws', () => {
      mockSetLeftSidebarVisible.mockImplementation(() => {
        throw new Error('store update failed')
      })
      setState()

      expect(() =>
        findCommand('show-left-sidebar')?.execute(createMockContext())
      ).toThrow('store update failed')
    })

    it('propagates error when setRightSidebarVisible throws', () => {
      mockSetRightSidebarVisible.mockImplementation(() => {
        throw new Error('right sidebar error')
      })
      setState()

      expect(() =>
        findCommand('hide-right-sidebar')?.execute(createMockContext())
      ).toThrow('right sidebar error')
    })

    it('propagates error when toggleLeftSidebar throws', () => {
      mockToggleLeftSidebar.mockImplementation(() => {
        throw new Error('toggle left error')
      })
      setState()

      expect(() =>
        findCommand('toggle-left-sidebar')?.execute(createMockContext())
      ).toThrow('toggle left error')
    })

    it('propagates error when toggleRightSidebar throws', () => {
      mockToggleRightSidebar.mockImplementation(() => {
        throw new Error('toggle right error')
      })
      setState()

      expect(() =>
        findCommand('toggle-right-sidebar')?.execute(createMockContext())
      ).toThrow('toggle right error')
    })

    it('propagates error when context.openPreferences throws', () => {
      const ctx = createMockContext()
      // ctx.openPreferences is typed as `() => void` by CommandContext, so use
      // vi.mocked() to access the Mock instance API for configuration.
      vi.mocked(ctx.openPreferences).mockImplementation(() => {
        throw new Error('preferences modal failed')
      })

      expect(() => findCommand('open-preferences')?.execute(ctx)).toThrow(
        'preferences modal failed'
      )
    })

    it('throws when useSidebarStore.getState throws', () => {
      mockGetState.mockImplementation(() => {
        throw new Error('store unavailable')
      })

      expect(() =>
        findCommand('show-left-sidebar')?.execute(createMockContext())
      ).toThrow('store unavailable')
    })
  })
})
