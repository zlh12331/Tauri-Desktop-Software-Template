import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CommandContext } from './types'

// Mock @/lib/notifications — the only external dependency of notification-commands.
// Mocking it here keeps the unit test isolated from sonner / tauri-bindings internals.
const mockSuccess = vi.fn()
const mockError = vi.fn()
const mockInfo = vi.fn()
const mockWarning = vi.fn()

vi.mock('@/lib/notifications', () => ({
  notifications: {
    success: mockSuccess,
    error: mockError,
    info: mockInfo,
    warning: mockWarning,
  },
}))

// Import the module under test AFTER mocks are hoisted.
const { notificationCommands } = await import('./notification-commands')

const createMockContext = (): CommandContext => ({
  openPreferences: vi.fn(),
  showToast: vi.fn(),
})

describe('notificationCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSuccess.mockReset()
    mockError.mockReset()
    mockInfo.mockReset()
    mockWarning.mockReset()
  })

  describe('正向用例 — module structure', () => {
    it('exports a non-empty array of commands', () => {
      expect(Array.isArray(notificationCommands)).toBe(true)
      expect(notificationCommands.length).toBeGreaterThan(0)
    })

    it('exports exactly one command', () => {
      expect(notificationCommands).toHaveLength(1)
    })

    it('command has the expected id', () => {
      expect(notificationCommands[0]?.id).toBe('notification.test-toast')
    })

    it('command has the expected labelKey and descriptionKey', () => {
      const cmd = notificationCommands[0]
      expect(cmd?.labelKey).toBe('commands.testToast.label')
      expect(cmd?.descriptionKey).toBe('commands.testToast.description')
    })

    it('command belongs to the debug group', () => {
      expect(notificationCommands[0]?.group).toBe('debug')
    })
  })

  describe('正向用例 — execute', () => {
    it('calls notifications.success with the test toast payload', async () => {
      mockSuccess.mockResolvedValue(undefined)
      const cmd = notificationCommands[0]

      await cmd?.execute(createMockContext())

      expect(mockSuccess).toHaveBeenCalledTimes(1)
      expect(mockSuccess).toHaveBeenCalledWith(
        'Test notification sent',
        'Check your system notifications'
      )
    })

    it('execute resolves to undefined on success', async () => {
      mockSuccess.mockResolvedValue(undefined)
      const cmd = notificationCommands[0]

      await expect(cmd?.execute(createMockContext())).resolves.toBeUndefined()
    })

    it('only success helper is invoked on the happy path', async () => {
      mockSuccess.mockResolvedValue(undefined)
      const cmd = notificationCommands[0]

      await cmd?.execute(createMockContext())

      expect(mockSuccess).toHaveBeenCalled()
      expect(mockError).not.toHaveBeenCalled()
      expect(mockInfo).not.toHaveBeenCalled()
      expect(mockWarning).not.toHaveBeenCalled()
    })
  })

  describe('边界用例 — metadata & defaults', () => {
    it('keywords contain test, toast, notification, debug', () => {
      expect(notificationCommands[0]?.keywords).toEqual([
        'test',
        'toast',
        'notification',
        'debug',
      ])
    })

    it('command does not define a shortcut', () => {
      expect(notificationCommands[0]?.shortcut).toBeUndefined()
    })

    it('command does not define an icon', () => {
      expect(notificationCommands[0]?.icon).toBeUndefined()
    })

    it('execute returns a Promise (async function)', () => {
      const cmd = notificationCommands[0]
      const result = cmd?.execute(createMockContext())
      expect(result).toBeInstanceOf(Promise)
    })

    it('execute still resolves when notifications.success returns undefined', async () => {
      // Bare vi.fn() returns undefined — await undefined resolves immediately
      const cmd = notificationCommands[0]

      await expect(cmd?.execute(createMockContext())).resolves.toBeUndefined()
      expect(mockSuccess).toHaveBeenCalledTimes(1)
    })
  })

  describe('异常用例 — notification failure', () => {
    it('propagates rejection when notifications.success rejects', async () => {
      mockSuccess.mockRejectedValue(new Error('toast render failed'))
      const cmd = notificationCommands[0]

      await expect(cmd?.execute(createMockContext())).rejects.toThrow(
        'toast render failed'
      )
    })

    it('propagates synchronous throw from notifications.success as rejection', async () => {
      mockSuccess.mockImplementation(() => {
        throw new Error('sync boom')
      })
      const cmd = notificationCommands[0]

      await expect(cmd?.execute(createMockContext())).rejects.toThrow(
        'sync boom'
      )
    })

    it('propagates non-Error rejection reason', async () => {
      mockSuccess.mockRejectedValue('string failure')
      const cmd = notificationCommands[0]

      await expect(cmd?.execute(createMockContext())).rejects.toBe(
        'string failure'
      )
    })
  })
})
