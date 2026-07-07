import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { CommandContext } from '@/lib/commands/types'

// Mock the command registry so we can assert on which command IDs are
// dispatched via executeCommand(), without needing to register real commands.
const mockExecuteCommand = vi.fn().mockResolvedValue({ success: true })

vi.mock('@/lib/commands/registry', () => ({
  executeCommand: mockExecuteCommand,
}))

// Mock the logger so we can assert on warn calls when commands fail.
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock each domain store so that imports from the real stores are satisfied.
// The keyboard-shortcut hook routes everything through executeCommand() and
// does not call store methods directly, but the mocks are needed to satisfy
// module resolution and any indirect imports through command modules.
vi.mock('@/store/sidebar-store', () => ({
  useSidebarStore: {
    getState: vi.fn(() => ({
      leftSidebarVisible: true,
      rightSidebarVisible: true,
      toggleLeftSidebar: vi.fn(),
      setLeftSidebarVisible: vi.fn(),
      toggleRightSidebar: vi.fn(),
      setRightSidebarVisible: vi.fn(),
    })),
  },
}))

vi.mock('@/store/dialog-store', () => ({
  useDialogStore: {
    getState: vi.fn(() => ({
      commandPaletteOpen: false,
      preferencesOpen: false,
      toggleCommandPalette: vi.fn(),
      setCommandPaletteOpen: vi.fn(),
      togglePreferences: vi.fn(),
      setPreferencesOpen: vi.fn(),
    })),
  },
}))

vi.mock('@/store/crash-report-store', () => ({
  useCrashReportStore: {
    getState: vi.fn(() => ({
      crashReportDialogOpen: false,
      pendingCrashReport: null,
      setCrashReportDialogOpen: vi.fn(),
      setPendingCrashReport: vi.fn(),
    })),
  },
}))

vi.mock('@/store/ui-store', () => ({
  useUIStore: {
    getState: vi.fn(() => ({
      lastQuickPaneEntry: null,
      squareCorners: false,
      setLastQuickPaneEntry: vi.fn(),
      setSquareCorners: vi.fn(),
    })),
  },
}))

const { useKeyboardShortcuts } = await import('./use-keyboard-shortcuts')

function createCommandContext(): CommandContext {
  return {
    openPreferences: vi.fn(),
    showToast: vi.fn(),
  }
}

function dispatchKey(
  key: string,
  options: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean } = {}
) {
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      metaKey: options.metaKey ?? false,
      ctrlKey: options.ctrlKey ?? false,
      shiftKey: options.shiftKey ?? false,
    })
  )
}

describe('useKeyboardShortcuts', () => {
  let commandContext: CommandContext

  beforeEach(() => {
    vi.clearAllMocks()
    mockExecuteCommand.mockResolvedValue({ success: true })
    commandContext = createCommandContext()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('正向用例 — 命令面板快捷键', () => {
    it('toggles command palette on Cmd+K (metaKey)', () => {
      renderHook(() => useKeyboardShortcuts(commandContext))

      dispatchKey('k', { metaKey: true })
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'toggle-command-palette',
        commandContext
      )
    })

    it('toggles command palette on Ctrl+K (ctrlKey)', () => {
      renderHook(() => useKeyboardShortcuts(commandContext))

      dispatchKey('k', { ctrlKey: true })
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'toggle-command-palette',
        commandContext
      )
    })

    it('toggles command palette on uppercase K (CapsLock) with metaKey', () => {
      renderHook(() => useKeyboardShortcuts(commandContext))

      dispatchKey('K', { metaKey: true })
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'toggle-command-palette',
        commandContext
      )
    })

    it('calls preventDefault on the K shortcut event', () => {
      renderHook(() => useKeyboardShortcuts(commandContext))

      const event = new KeyboardEvent('keydown', {
        key: 'k',
        bubbles: true,
        cancelable: true,
        metaKey: true,
      })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
      document.dispatchEvent(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })
  })

  describe('正向用例 — 偏好设置快捷键', () => {
    it('opens preferences on Cmd+, (metaKey)', () => {
      renderHook(() => useKeyboardShortcuts(commandContext))

      dispatchKey(',', { metaKey: true })
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'open-preferences',
        commandContext
      )
    })

    it('opens preferences on Ctrl+, (ctrlKey)', () => {
      renderHook(() => useKeyboardShortcuts(commandContext))

      dispatchKey(',', { ctrlKey: true })
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'open-preferences',
        commandContext
      )
    })

    it('calls preventDefault on the comma shortcut event', () => {
      renderHook(() => useKeyboardShortcuts(commandContext))

      const event = new KeyboardEvent('keydown', {
        key: ',',
        bubbles: true,
        cancelable: true,
        metaKey: true,
      })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
      document.dispatchEvent(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })
  })

  describe('正向用例 — 侧边栏快捷键', () => {
    it('toggles the left sidebar on Cmd+1', () => {
      renderHook(() => useKeyboardShortcuts(commandContext))

      dispatchKey('1', { metaKey: true })
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'toggle-left-sidebar',
        commandContext
      )
    })

    it('toggles the right sidebar on Cmd+2', () => {
      renderHook(() => useKeyboardShortcuts(commandContext))

      dispatchKey('2', { metaKey: true })
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'toggle-right-sidebar',
        commandContext
      )
    })

    it('toggles the left sidebar on Ctrl+1', () => {
      renderHook(() => useKeyboardShortcuts(commandContext))

      dispatchKey('1', { ctrlKey: true })
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'toggle-left-sidebar',
        commandContext
      )
    })

    it('toggles the right sidebar on Ctrl+2', () => {
      renderHook(() => useKeyboardShortcuts(commandContext))

      dispatchKey('2', { ctrlKey: true })
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'toggle-right-sidebar',
        commandContext
      )
    })
  })

  describe('边界用例 — 不应触发的按键', () => {
    it('does nothing when no modifier key is pressed', () => {
      renderHook(() => useKeyboardShortcuts(commandContext))

      dispatchKey(',')
      dispatchKey('1')
      dispatchKey('2')
      dispatchKey('k')
      dispatchKey('K')

      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('does nothing for unrelated keys even with modifier', () => {
      renderHook(() => useKeyboardShortcuts(commandContext))

      dispatchKey('a', { metaKey: true })
      dispatchKey('3', { metaKey: true })
      dispatchKey('Enter', { metaKey: true })

      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('does not call preventDefault for unrelated modifier+key combos', () => {
      renderHook(() => useKeyboardShortcuts(commandContext))

      const event = new KeyboardEvent('keydown', {
        key: 'x',
        bubbles: true,
        cancelable: true,
        metaKey: true,
      })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
      document.dispatchEvent(event)

      expect(preventDefaultSpy).not.toHaveBeenCalled()
    })
  })

  describe('边界用例 — 清理副作用', () => {
    it('removes the keydown listener on unmount', () => {
      const { unmount } = renderHook(() => useKeyboardShortcuts(commandContext))

      unmount()

      dispatchKey(',', { metaKey: true })
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })
  })

  describe('异常用例 — commandContext 变化时重新绑定', () => {
    it('re-binds the listener when commandContext reference changes', () => {
      const firstContext = createCommandContext()
      const secondContext = createCommandContext()

      const { rerender } = renderHook(
        ({ ctx }: { ctx: CommandContext }) => useKeyboardShortcuts(ctx),
        { initialProps: { ctx: firstContext } }
      )

      dispatchKey(',', { metaKey: true })
      expect(mockExecuteCommand).toHaveBeenLastCalledWith(
        'open-preferences',
        firstContext
      )

      rerender({ ctx: secondContext })
      dispatchKey(',', { metaKey: true })
      expect(mockExecuteCommand).toHaveBeenLastCalledWith(
        'open-preferences',
        secondContext
      )
    })
  })

  describe('异常用例 — 命令执行失败时记录日志', () => {
    it('logs a warning when executeCommand fails', async () => {
      const { logger } = await import('@/lib/logger')
      vi.mocked(logger.warn).mockClear()
      mockExecuteCommand.mockResolvedValueOnce({
        success: false,
        error: 'Command not found',
      })

      renderHook(() => useKeyboardShortcuts(commandContext))
      dispatchKey(',', { metaKey: true })

      // Wait for the async executeCommand promise to resolve
      await vi.waitFor(() => {
        expect(logger.warn).toHaveBeenCalled()
      })
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'open-preferences',
        commandContext
      )
    })
  })
})
