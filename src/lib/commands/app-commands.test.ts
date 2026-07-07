import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CommandContext } from './types'

// Mock @/store/dialog-store — app commands read & mutate dialog store state
const mockToggleCommandPalette = vi.fn()
const mockGetState = vi.fn()

vi.mock('@/store/dialog-store', () => ({
  useDialogStore: { getState: mockGetState },
}))

// Import the module under test AFTER mocks are hoisted.
// lucide-react is left unmocked (it already loads cleanly under jsdom, matching
// the existing navigation-commands.test.ts convention) and only provides icon
// references.
const { appCommands } = await import('./app-commands')

const createMockContext = (): CommandContext => ({
  openPreferences: vi.fn(),
  showToast: vi.fn(),
})

const findCommand = (id: string) => appCommands.find(cmd => cmd.id === id)

const setState = (
  overrides: Partial<{
    commandPaletteOpen: boolean
    toggleCommandPalette: ReturnType<typeof vi.fn>
  }> = {}
) => {
  mockGetState.mockReturnValue({
    commandPaletteOpen: false,
    preferencesOpen: false,
    toggleCommandPalette: mockToggleCommandPalette,
    setCommandPaletteOpen: vi.fn(),
    togglePreferences: vi.fn(),
    setPreferencesOpen: vi.fn(),
    ...overrides,
  })
}

describe('appCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToggleCommandPalette.mockReset()
    mockGetState.mockReset()
    setState()
  })

  describe('正向用例 — module structure', () => {
    it('exports one app command', () => {
      expect(appCommands).toHaveLength(1)
    })

    it('contains the expected command id', () => {
      const ids = appCommands.map(c => c.id)
      expect(ids).toEqual(['toggle-command-palette'])
    })

    it('toggle-command-palette belongs to the tools group', () => {
      expect(findCommand('toggle-command-palette')?.group).toBe('tools')
    })

    it('defines labelKey and descriptionKey', () => {
      const cmd = findCommand('toggle-command-palette')
      expect(typeof cmd?.labelKey).toBe('string')
      expect(cmd?.labelKey.length).toBeGreaterThan(0)
      expect(typeof cmd?.descriptionKey).toBe('string')
      expect(cmd?.descriptionKey?.length).toBeGreaterThan(0)
    })

    it('defines the expected shortcut', () => {
      expect(findCommand('toggle-command-palette')?.shortcut).toBe('⌘+K')
    })

    it('defines an icon component', () => {
      const cmd = findCommand('toggle-command-palette')
      expect(cmd?.icon).toBeDefined()
      expect(cmd?.icon).not.toBeNull()
      expect(typeof cmd?.icon).toMatch(/^(function|object)$/)
    })

    it('keywords include expected entries', () => {
      expect(findCommand('toggle-command-palette')?.keywords).toEqual([
        'command',
        'palette',
        'cmdk',
        'k',
        'toggle',
        'open',
      ])
    })

    it('has no isAvailable function (always available)', () => {
      expect(findCommand('toggle-command-palette')?.isAvailable).toBeUndefined()
    })
  })

  describe('正向用例 — execute', () => {
    it('toggle-command-palette calls useDialogStore.getState().toggleCommandPalette()', () => {
      setState()
      findCommand('toggle-command-palette')?.execute(createMockContext())

      expect(mockGetState).toHaveBeenCalledTimes(1)
      expect(mockToggleCommandPalette).toHaveBeenCalledTimes(1)
      expect(mockToggleCommandPalette).toHaveBeenCalledWith()
    })

    it('execute does not touch the context channels directly', () => {
      const ctx = createMockContext()
      findCommand('toggle-command-palette')?.execute(ctx)

      expect(ctx.openPreferences).not.toHaveBeenCalled()
      expect(ctx.showToast).not.toHaveBeenCalled()
    })
  })

  describe('异常用例 — error propagation', () => {
    it('propagates error when toggleCommandPalette throws', () => {
      mockToggleCommandPalette.mockImplementation(() => {
        throw new Error('dialog store error')
      })
      setState()

      expect(() =>
        findCommand('toggle-command-palette')?.execute(createMockContext())
      ).toThrow('dialog store error')
    })

    it('throws when useDialogStore.getState throws', () => {
      mockGetState.mockImplementation(() => {
        throw new Error('store unavailable')
      })

      expect(() =>
        findCommand('toggle-command-palette')?.execute(createMockContext())
      ).toThrow('store unavailable')
    })
  })
})
