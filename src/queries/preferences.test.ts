import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock sonner toast
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}
vi.mock('sonner', () => ({ toast: mockToast }))

// Mock logger
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}
vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

// Mock tauri-bindings — overrides the global mock registered in src/test/setup.ts.
// Real @tanstack/react-query is kept so the hooks actually run their lifecycle.
const mockLoadPreferences = vi.fn()
const mockSavePreferences = vi.fn()
vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    loadPreferences: mockLoadPreferences,
    savePreferences: mockSavePreferences,
  },
}))

// Import the module under test AFTER mocks are hoisted
const { usePreferences, useSavePreferences, preferencesQueryKeys } =
  await import('@/queries/preferences')

interface WrapperProps {
  children: ReactNode
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  // children passed as a positional argument to createElement so we never
  // assign an explicit `undefined` to the optional `children` prop
  // (required for exactOptionalPropertyTypes compatibility).
  const Wrapper = ({ children }: WrapperProps) =>
    createElement(QueryClientProvider, { client: queryClient }, children)

  return { Wrapper, queryClient }
}

const defaultPreferences = {
  theme: 'system',
  quick_pane_shortcut: null,
  language: null,
  crash_reporting_consent: null,
}

describe('preferencesQueryKeys', () => {
  describe('正向用例', () => {
    it('all is a tuple containing "preferences"', () => {
      expect(preferencesQueryKeys.all).toEqual(['preferences'])
    })

    it('preferences() returns an array containing "preferences"', () => {
      expect(preferencesQueryKeys.preferences()).toEqual(['preferences'])
    })
  })

  describe('边界用例 — immutability', () => {
    it('preferences() returns a new array instance each call (spread copy)', () => {
      const a = preferencesQueryKeys.preferences()
      const b = preferencesQueryKeys.preferences()
      expect(a).not.toBe(b)
      expect(a).toEqual(b)
    })

    it('all is a readonly tuple', () => {
      expect(Array.isArray(preferencesQueryKeys.all)).toBe(true)
      expect(preferencesQueryKeys.all).toHaveLength(1)
    })
  })
})

describe('usePreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadPreferences.mockReset()
    mockSavePreferences.mockReset()
  })

  describe('正向用例', () => {
    it('returns loaded preferences and logs success on ok status', async () => {
      const prefs = {
        theme: 'dark',
        quick_pane_shortcut: 'CommandOrControl+Shift+.',
        language: 'en',
        crash_reporting_consent: true,
      }
      mockLoadPreferences.mockResolvedValue({ status: 'ok', data: prefs })

      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => usePreferences(), {
        wrapper: Wrapper,
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(prefs)
      expect(mockLoadPreferences).toHaveBeenCalledTimes(1)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Loading preferences from backend'
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Preferences loaded successfully',
        { preferences: prefs }
      )
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })
  })

  describe('边界用例 — error status yields defaults', () => {
    it('returns default preferences when backend reports error (missing file)', async () => {
      mockLoadPreferences.mockResolvedValue({
        status: 'error',
        error: 'File does not exist',
      })

      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => usePreferences(), {
        wrapper: Wrapper,
      })

      // The queryFn catches the error status and returns defaults,
      // so the query still resolves successfully.
      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(defaultPreferences)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to load preferences, using defaults',
        { error: 'File does not exist' }
      )
      expect(mockLogger.info).not.toHaveBeenCalled()
    })
  })

  describe('异常用例', () => {
    it('query errors when loadPreferences rejects (Promise reject)', async () => {
      mockLoadPreferences.mockRejectedValue(new Error('backend unreachable'))

      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => usePreferences(), {
        wrapper: Wrapper,
      })

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(result.current.error).toBeInstanceOf(Error)
      expect(result.current.data).toBeUndefined()
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Loading preferences from backend'
      )
      // queryFn throws before reaching the success log
      expect(mockLogger.info).not.toHaveBeenCalled()
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })
  })
})

describe('useSavePreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadPreferences.mockReset()
    mockSavePreferences.mockReset()
  })

  describe('正向用例', () => {
    it('saves preferences, updates cache and shows success toast on ok status', async () => {
      mockSavePreferences.mockResolvedValue({ status: 'ok', data: null })
      const prefs = { ...defaultPreferences, theme: 'dark' }

      const { Wrapper, queryClient } = createWrapper()
      const { result } = renderHook(() => useSavePreferences(), {
        wrapper: Wrapper,
      })

      await result.current.mutateAsync(prefs)

      expect(mockSavePreferences).toHaveBeenCalledWith(prefs)
      expect(mockSavePreferences).toHaveBeenCalledTimes(1)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Saving preferences to backend',
        { preferences: prefs }
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Preferences saved successfully'
      )
      expect(mockLogger.info).toHaveBeenCalledWith('Preferences cache updated')
      expect(mockToast.success).toHaveBeenCalledWith('Preferences saved')
      // onSuccess should have written the new prefs into the query cache
      expect(
        queryClient.getQueryData(preferencesQueryKeys.preferences())
      ).toEqual(prefs)
      expect(mockToast.error).not.toHaveBeenCalled()
    })
  })

  describe('边界用例 — minimal payload', () => {
    it('passes a fully-null preferences object to the backend unchanged', async () => {
      mockSavePreferences.mockResolvedValue({ status: 'ok', data: null })
      const minimal = {
        theme: 'light',
        quick_pane_shortcut: null,
        language: null,
        crash_reporting_consent: null,
      }

      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useSavePreferences(), {
        wrapper: Wrapper,
      })

      await result.current.mutateAsync(minimal)

      expect(mockSavePreferences).toHaveBeenCalledWith(minimal)
      expect(mockSavePreferences).toHaveBeenCalledTimes(1)
    })
  })

  describe('异常用例', () => {
    it('throws and shows error toast when backend reports error status', async () => {
      mockSavePreferences.mockResolvedValue({
        status: 'error',
        error: { kind: 'Io', message: 'disk full' },
      })
      const prefs = { ...defaultPreferences }

      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useSavePreferences(), {
        wrapper: Wrapper,
      })

      await expect(result.current.mutateAsync(prefs)).rejects.toThrow(
        'disk full'
      )

      expect(mockSavePreferences).toHaveBeenCalledWith(prefs)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to save preferences',
        { error: { kind: 'Io', message: 'disk full' }, preferences: prefs }
      )
      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to save preferences',
        { description: 'disk full' }
      )
      expect(mockToast.success).not.toHaveBeenCalled()

      await waitFor(() => expect(result.current.isError).toBe(true))
    })

    it('mutation fails (no error toast) when savePreferences rejects', async () => {
      mockSavePreferences.mockRejectedValue(new Error('network failure'))
      const prefs = { ...defaultPreferences }

      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useSavePreferences(), {
        wrapper: Wrapper,
      })

      await expect(result.current.mutateAsync(prefs)).rejects.toThrow(
        'network failure'
      )

      expect(mockSavePreferences).toHaveBeenCalledWith(prefs)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Saving preferences to backend',
        { preferences: prefs }
      )
      // Rejection happens before the error-status branch, so neither
      // logger.error nor toast.error should fire.
      expect(mockLogger.error).not.toHaveBeenCalled()
      expect(mockToast.error).not.toHaveBeenCalled()
      expect(mockToast.success).not.toHaveBeenCalled()

      await waitFor(() => expect(result.current.isError).toBe(true))
    })
  })
})
