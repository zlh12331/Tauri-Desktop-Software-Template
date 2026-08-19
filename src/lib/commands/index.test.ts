import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AppCommand } from './types'

// ---------------------------------------------------------------------------
// Mocks — command modules and registry are injected fakes so initializeCommandSystem
// can be asserted on pure wiring (registry implementation is covered elsewhere).
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  // Test fixtures use FAKE translation keys (not present in en.json) on
  // purpose — they exercise generic wiring, not real i18n. Cast because
  // labelKey is typed against en.json (compile-time key check).
  const fakeLabelKey = 'commands.mock.label' as AppCommand['labelKey']

  const navCmd: AppCommand = {
    id: 'nav-test',
    labelKey: fakeLabelKey,
    execute: vi.fn(),
  }
  const winCmd: AppCommand = {
    id: 'win-test',
    labelKey: fakeLabelKey,
    execute: vi.fn(),
  }
  const notifCmd: AppCommand = {
    id: 'notif-test',
    labelKey: fakeLabelKey,
    execute: vi.fn(),
  }
  const appCmd: AppCommand = {
    id: 'app-test',
    labelKey: fakeLabelKey,
    execute: vi.fn(),
  }
  return {
    navCommands: [navCmd],
    winCommands: [winCmd],
    notifCommands: [notifCmd],
    appCommands: [appCmd],
    registerCommands: vi.fn(),
    getAllCommands: vi.fn(() => []),
    executeCommand: vi.fn(),
    loggerDebug: vi.fn(),
  }
})

vi.mock('./navigation-commands', () => ({
  navigationCommands: mocks.navCommands,
}))
vi.mock('./window-commands', () => ({
  windowCommands: mocks.winCommands,
}))
vi.mock('./notification-commands', () => ({
  notificationCommands: mocks.notifCommands,
}))
vi.mock('./app-commands', () => ({
  appCommands: mocks.appCommands,
}))
vi.mock('./registry', () => ({
  registerCommands: mocks.registerCommands,
  getAllCommands: mocks.getAllCommands,
  executeCommand: mocks.executeCommand,
}))

// Mock logger
mocks.loggerDebug = vi.fn()
vi.mock('@/lib/logger', () => ({
  logger: { debug: mocks.loggerDebug },
}))

const { initializeCommandSystem } = await import('./index')

describe('commands index', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('正向用例 — initializeCommandSystem 注册全部命令组', () => {
    it('registers all four command groups', () => {
      initializeCommandSystem()

      expect(mocks.registerCommands).toHaveBeenCalledTimes(4)
      expect(mocks.registerCommands).toHaveBeenCalledWith(mocks.navCommands)
      expect(mocks.registerCommands).toHaveBeenCalledWith(mocks.winCommands)
      expect(mocks.registerCommands).toHaveBeenCalledWith(mocks.notifCommands)
      expect(mocks.registerCommands).toHaveBeenCalledWith(mocks.appCommands)
    })

    it('logs debug message in dev mode', () => {
      initializeCommandSystem()
      expect(mocks.loggerDebug).toHaveBeenCalled()
    })
  })

  describe('边界用例 — DEV 模式', () => {
    it('skips debug logging when not in dev mode', () => {
      // Temporarily flip DEV off to cover the false branch
      const originalDev = import.meta.env.DEV
      ;(import.meta.env as { DEV: boolean }).DEV = false
      try {
        initializeCommandSystem()
        expect(mocks.loggerDebug).not.toHaveBeenCalled()
      } finally {
        ;(import.meta.env as { DEV: boolean }).DEV = originalDev
      }
    })
  })

  describe('正向用例 — 导出转发', () => {
    it('re-exports registry functions', async () => {
      const idx = await import('./index')
      expect(idx.getAllCommands).toBe(mocks.getAllCommands)
      expect(idx.executeCommand).toBe(mocks.executeCommand)
      expect(idx.registerCommands).toBe(mocks.registerCommands)
    })

    it('re-exports all command group arrays', async () => {
      const idx = await import('./index')
      expect(idx.navigationCommands).toBe(mocks.navCommands)
      expect(idx.windowCommands).toBe(mocks.winCommands)
      expect(idx.notificationCommands).toBe(mocks.notifCommands)
      expect(idx.appCommands).toBe(mocks.appCommands)
    })
  })

  describe('异常用例 — 初始化失败传播', () => {
    it('propagates errors thrown by registerCommands', () => {
      mocks.registerCommands.mockImplementationOnce(() => {
        throw new Error('registry broken')
      })

      expect(() => initializeCommandSystem()).toThrow('registry broken')
    })
  })
})
