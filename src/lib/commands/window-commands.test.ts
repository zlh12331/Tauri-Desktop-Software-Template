import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CommandContext } from './types'

// Mock @tauri-apps/api/window — getCurrentWindow returns a stub window object
const mockClose = vi.fn()
const mockMinimize = vi.fn()
const mockToggleMaximize = vi.fn()
const mockSetFullscreen = vi.fn()
const mockGetCurrentWindow = vi.fn()

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: mockGetCurrentWindow,
}))

// Mock @/i18n/config — default export is the i18n instance used by window-commands
const mockT = vi.fn((key: string) => key)
vi.mock('@/i18n/config', () => ({
  default: { t: mockT },
  i18n: { t: mockT },
}))

// Import the module under test AFTER mocks are hoisted
const { windowCommands } = await import('./window-commands')

const createMockContext = (): CommandContext => ({
  openPreferences: vi.fn(),
  showToast: vi.fn(),
})

const findCommand = (id: string) => windowCommands.find(cmd => cmd.id === id)

const stubWindow = () => ({
  close: mockClose,
  minimize: mockMinimize,
  toggleMaximize: mockToggleMaximize,
  setFullscreen: mockSetFullscreen,
})

describe('windowCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClose.mockReset()
    mockMinimize.mockReset()
    mockToggleMaximize.mockReset()
    mockSetFullscreen.mockReset()
    mockGetCurrentWindow.mockReset()
    // Re-establish default successful implementations
    mockClose.mockResolvedValue(undefined)
    mockMinimize.mockResolvedValue(undefined)
    mockToggleMaximize.mockResolvedValue(undefined)
    mockSetFullscreen.mockResolvedValue(undefined)
    mockGetCurrentWindow.mockReturnValue(stubWindow())
  })

  describe('正向用例 — module structure', () => {
    it('exports five window commands', () => {
      expect(windowCommands).toHaveLength(5)
    })

    it('contains all expected command ids in order', () => {
      const ids = windowCommands.map(c => c.id)
      expect(ids).toEqual([
        'window-close',
        'window-minimize',
        'window-toggle-maximize',
        'window-fullscreen',
        'window-exit-fullscreen',
      ])
    })

    it('each command defines labelKey and descriptionKey', () => {
      for (const cmd of windowCommands) {
        expect(typeof cmd.labelKey).toBe('string')
        expect(cmd.labelKey.length).toBeGreaterThan(0)
        expect(typeof cmd.descriptionKey).toBe('string')
        expect(cmd.descriptionKey?.length).toBeGreaterThan(0)
      }
    })
  })

  describe('正向用例 — execute calls the right window API', () => {
    it('window-close calls appWindow.close()', async () => {
      const ctx = createMockContext()
      await findCommand('window-close')?.execute(ctx)

      expect(mockGetCurrentWindow).toHaveBeenCalledTimes(1)
      expect(mockClose).toHaveBeenCalledTimes(1)
      expect(ctx.showToast).not.toHaveBeenCalled()
    })

    it('window-minimize calls appWindow.minimize()', async () => {
      const ctx = createMockContext()
      await findCommand('window-minimize')?.execute(ctx)

      expect(mockMinimize).toHaveBeenCalledTimes(1)
      expect(ctx.showToast).not.toHaveBeenCalled()
    })

    it('window-toggle-maximize calls appWindow.toggleMaximize()', async () => {
      const ctx = createMockContext()
      await findCommand('window-toggle-maximize')?.execute(ctx)

      expect(mockToggleMaximize).toHaveBeenCalledTimes(1)
      expect(ctx.showToast).not.toHaveBeenCalled()
    })

    it('window-fullscreen calls appWindow.setFullscreen(true)', async () => {
      const ctx = createMockContext()
      await findCommand('window-fullscreen')?.execute(ctx)

      expect(mockSetFullscreen).toHaveBeenCalledWith(true)
      expect(ctx.showToast).not.toHaveBeenCalled()
    })

    it('window-exit-fullscreen calls appWindow.setFullscreen(false)', async () => {
      const ctx = createMockContext()
      await findCommand('window-exit-fullscreen')?.execute(ctx)

      expect(mockSetFullscreen).toHaveBeenCalledWith(false)
      expect(ctx.showToast).not.toHaveBeenCalled()
    })
  })

  describe('边界用例 — metadata', () => {
    it('window-close has the ⌘+W shortcut', () => {
      expect(findCommand('window-close')?.shortcut).toBe('⌘+W')
    })

    it('window-minimize has the ⌘+M shortcut', () => {
      expect(findCommand('window-minimize')?.shortcut).toBe('⌘+M')
    })

    it('window-toggle-maximize has no shortcut defined', () => {
      expect(findCommand('window-toggle-maximize')?.shortcut).toBeUndefined()
    })

    it('window-fullscreen has the F11 shortcut', () => {
      expect(findCommand('window-fullscreen')?.shortcut).toBe('F11')
    })

    it('window-exit-fullscreen has the Escape shortcut', () => {
      expect(findCommand('window-exit-fullscreen')?.shortcut).toBe('Escape')
    })

    it('commands do not declare an icon', () => {
      for (const cmd of windowCommands) {
        expect(cmd.icon).toBeUndefined()
      }
    })

    it('commands do not declare keywords', () => {
      for (const cmd of windowCommands) {
        expect(cmd.keywords).toBeUndefined()
      }
    })
  })

  describe('异常用例 — error handling', () => {
    it('window-close shows error toast when close() rejects with Error', async () => {
      mockClose.mockRejectedValueOnce(new Error('close failed'))
      const ctx = createMockContext()

      await findCommand('window-close')?.execute(ctx)

      expect(mockT).toHaveBeenCalledWith('toast.error.windowCloseFailed', {
        message: 'close failed',
      })
      expect(ctx.showToast).toHaveBeenCalledWith(
        'toast.error.windowCloseFailed',
        'error'
      )
    })

    it('window-close uses "Unknown error" when rejection is not an Error', async () => {
      mockClose.mockRejectedValueOnce('plain string failure')
      const ctx = createMockContext()

      await findCommand('window-close')?.execute(ctx)

      expect(mockT).toHaveBeenCalledWith('toast.error.windowCloseFailed', {
        message: 'Unknown error',
      })
      expect(ctx.showToast).toHaveBeenCalledWith(
        'toast.error.windowCloseFailed',
        'error'
      )
    })

    it('window-minimize shows error toast when minimize() rejects', async () => {
      mockMinimize.mockRejectedValueOnce(new Error('minimize failed'))
      const ctx = createMockContext()

      await findCommand('window-minimize')?.execute(ctx)

      expect(mockT).toHaveBeenCalledWith('toast.error.windowMinimizeFailed', {
        message: 'minimize failed',
      })
      expect(ctx.showToast).toHaveBeenCalledWith(
        'toast.error.windowMinimizeFailed',
        'error'
      )
    })

    it('window-toggle-maximize shows error toast when toggleMaximize() rejects', async () => {
      mockToggleMaximize.mockRejectedValueOnce(new Error('maximize failed'))
      const ctx = createMockContext()

      await findCommand('window-toggle-maximize')?.execute(ctx)

      expect(mockT).toHaveBeenCalledWith('toast.error.windowMaximizeFailed', {
        message: 'maximize failed',
      })
      expect(ctx.showToast).toHaveBeenCalledWith(
        'toast.error.windowMaximizeFailed',
        'error'
      )
    })

    it('window-fullscreen uses fullscreenEnterFailed key on setFullscreen error', async () => {
      mockSetFullscreen.mockRejectedValueOnce(new Error('enter failed'))
      const ctx = createMockContext()

      await findCommand('window-fullscreen')?.execute(ctx)

      expect(mockT).toHaveBeenCalledWith('toast.error.fullscreenEnterFailed', {
        message: 'enter failed',
      })
      expect(ctx.showToast).toHaveBeenCalledWith(
        'toast.error.fullscreenEnterFailed',
        'error'
      )
    })

    it('window-exit-fullscreen uses fullscreenExitFailed key on setFullscreen error', async () => {
      mockSetFullscreen.mockRejectedValueOnce(new Error('exit failed'))
      const ctx = createMockContext()

      await findCommand('window-exit-fullscreen')?.execute(ctx)

      expect(mockT).toHaveBeenCalledWith('toast.error.fullscreenExitFailed', {
        message: 'exit failed',
      })
      expect(ctx.showToast).toHaveBeenCalledWith(
        'toast.error.fullscreenExitFailed',
        'error'
      )
    })

    it('does not rethrow — error is swallowed and surfaced via toast', async () => {
      mockClose.mockRejectedValueOnce(new Error('boom'))
      const ctx = createMockContext()

      await expect(
        findCommand('window-close')?.execute(ctx)
      ).resolves.toBeUndefined()
      expect(ctx.showToast).toHaveBeenCalledTimes(1)
    })

    it('does not call showToast on the success path', async () => {
      const ctx = createMockContext()
      await findCommand('window-minimize')?.execute(ctx)

      expect(ctx.showToast).not.toHaveBeenCalled()
      expect(mockT).not.toHaveBeenCalled()
    })
  })
})
