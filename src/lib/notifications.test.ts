import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock sonner toast
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}
vi.mock('sonner', () => ({
  toast: mockToast,
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock Tauri bindings
const mockSendNativeNotification = vi.fn()
vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    sendNativeNotification: mockSendNativeNotification,
  },
}))

const { notify, notifications } = await import('./notifications')

describe('notify — toast notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('正向用例 — toast types', () => {
    it('sends success toast', async () => {
      await notify('Saved', 'File saved successfully', { type: 'success' })
      expect(mockToast.success).toHaveBeenCalledWith(
        'Saved: File saved successfully',
        {}
      )
    })

    it('sends error toast', async () => {
      await notify('Failed', 'Could not save', { type: 'error' })
      expect(mockToast.error).toHaveBeenCalledWith('Failed: Could not save', {})
    })

    it('sends warning toast', async () => {
      await notify('Warning', 'Deprecated feature', { type: 'warning' })
      expect(mockToast.warning).toHaveBeenCalledWith(
        'Warning: Deprecated feature',
        {}
      )
    })

    it('sends info toast by default', async () => {
      await notify('Info', 'Something happened')
      expect(mockToast.info).toHaveBeenCalledWith(
        'Info: Something happened',
        {}
      )
    })

    it('sends toast with title only (no message)', async () => {
      await notify('Done', undefined, { type: 'success' })
      expect(mockToast.success).toHaveBeenCalledWith('Done', {})
    })

    it('passes duration option to toast', async () => {
      await notify('Quick', 'message', { type: 'info', duration: 3000 })
      expect(mockToast.info).toHaveBeenCalledWith('Quick: message', {
        duration: 3000,
      })
    })
  })

  describe('边界用例 — default options', () => {
    it('defaults to info type when type not specified', async () => {
      await notify('Hello')
      expect(mockToast.info).toHaveBeenCalledWith('Hello', {})
    })

    it('defaults native to false when not specified', async () => {
      await notify('Title', 'Body')
      // Should use toast, not native notification
      expect(mockToast.info).toHaveBeenCalled()
      expect(mockSendNativeNotification).not.toHaveBeenCalled()
    })
  })
})

describe('notify — native notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('正向用例 — native success', () => {
    it('sends native notification when native=true', async () => {
      mockSendNativeNotification.mockResolvedValue({ status: 'ok', data: null })
      await notify('Update', 'New version available', { native: true })

      expect(mockSendNativeNotification).toHaveBeenCalledWith(
        'Update',
        'New version available'
      )
    })

    it('passes null body when message is undefined', async () => {
      mockSendNativeNotification.mockResolvedValue({ status: 'ok', data: null })
      await notify('Title Only', undefined, { native: true })

      expect(mockSendNativeNotification).toHaveBeenCalledWith(
        'Title Only',
        null
      )
    })
  })

  describe('异常用例 — native notification failure', () => {
    it('falls back to error toast when native notification fails', async () => {
      mockSendNativeNotification.mockResolvedValue({
        status: 'error',
        error: 'Permission denied',
      })

      await notify('Failed Native', 'body', { native: true, type: 'success' })

      expect(mockToast.error).toHaveBeenCalledWith('Failed Native: body')
    })
  })
})

describe('notifications convenience functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendNativeNotification.mockResolvedValue({ status: 'ok', data: null })
  })

  describe('正向用例 — convenience wrappers', () => {
    it('notifications.success calls success toast', async () => {
      await notifications.success('Title', 'Message')
      expect(mockToast.success).toHaveBeenCalledWith('Title: Message', {})
    })

    it('notifications.error calls error toast', async () => {
      await notifications.error('Title', 'Message')
      expect(mockToast.error).toHaveBeenCalledWith('Title: Message', {})
    })

    it('notifications.info calls info toast', async () => {
      await notifications.info('Title', 'Message')
      expect(mockToast.info).toHaveBeenCalledWith('Title: Message', {})
    })

    it('notifications.warning calls warning toast', async () => {
      await notifications.warning('Title', 'Message')
      expect(mockToast.warning).toHaveBeenCalledWith('Title: Message', {})
    })
  })

  describe('正向用例 — native flag passthrough', () => {
    it('notifications.success with native=true sends native notification', async () => {
      await notifications.success('Title', 'Message', true)
      expect(mockSendNativeNotification).toHaveBeenCalledWith(
        'Title',
        'Message'
      )
    })

    it('notifications.error without native uses toast', async () => {
      await notifications.error('Title', 'Message', false)
      expect(mockToast.error).toHaveBeenCalled()
      expect(mockSendNativeNotification).not.toHaveBeenCalled()
    })
  })

  describe('边界用例 — message omitted', () => {
    it('notifications.success with no message passes undefined', async () => {
      await notifications.success('Title')
      // When message is undefined, toast content is just the title
      expect(mockToast.success).toHaveBeenCalledWith('Title', {})
    })
  })
})
