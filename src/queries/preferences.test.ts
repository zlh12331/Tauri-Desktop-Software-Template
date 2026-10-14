import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { preferencePatches } from '@/lib/preference-patches'

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
const mockApplyPatches = vi.fn()
vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    loadPreferences: mockLoadPreferences,
    applyPreferencePatches: mockApplyPatches,
  },
}))

// Import the module under test AFTER mocks are hoisted
const { usePreferences, usePatchPreferences, preferencesQueryKeys } =
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

describe('usePatchPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadPreferences.mockReset()
    mockApplyPatches.mockReset()
  })

  const merged = { ...defaultPreferences, theme: 'dark' }

  describe('正向用例', () => {
    it('sends only the named field and caches what the backend returns', async () => {
      mockApplyPatches.mockResolvedValue({ status: 'ok', data: merged })

      const { Wrapper, queryClient } = createWrapper()
      const { result } = renderHook(() => usePatchPreferences(), {
        wrapper: Wrapper,
      })

      await result.current.mutateAsync([preferencePatches.theme('dark')])

      // One patch, not a whole document built from a possibly stale cache.
      expect(mockApplyPatches).toHaveBeenCalledWith([
        { Theme: { value: 'dark' } },
      ])
      expect(mockToast.success).toHaveBeenCalledWith('Preferences saved')
      expect(
        queryClient.getQueryData(preferencesQueryKeys.preferences())
      ).toEqual(merged)
      expect(mockToast.error).not.toHaveBeenCalled()
    })

    it('keeps an explicit null as a value, not as an absent field', async () => {
      // "Follow the system locale" is a choice the user makes; if the builder
      // dropped it, choosing it would silently do nothing.
      mockApplyPatches.mockResolvedValue({ status: 'ok', data: merged })

      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => usePatchPreferences(), {
        wrapper: Wrapper,
      })

      await result.current.mutateAsync([preferencePatches.language(null)])

      expect(mockApplyPatches).toHaveBeenCalledWith([
        { Language: { value: null } },
      ])
    })
  })

  describe('异常用例', () => {
    it('throws and reports the backend message on error status', async () => {
      mockApplyPatches.mockResolvedValue({
        status: 'error',
        error: {
          kind: 'Serialization',
          message: 'Failed to parse preferences',
        },
      })

      const { Wrapper, queryClient } = createWrapper()
      queryClient.setQueryData(preferencesQueryKeys.preferences(), merged)
      const { result } = renderHook(() => usePatchPreferences(), {
        wrapper: Wrapper,
      })

      await expect(
        result.current.mutateAsync([preferencePatches.theme('light')])
      ).rejects.toThrow('Failed to parse preferences')

      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to save preferences',
        { description: 'Failed to parse preferences' }
      )
      expect(mockToast.success).not.toHaveBeenCalled()
      // A failed write must leave the cache as it was, not pretend the field moved.
      expect(
        queryClient.getQueryData(preferencesQueryKeys.preferences())
      ).toEqual(merged)
    })
  })
})

describe('usePreferences on a corrupt file', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadPreferences.mockReset()
  })

  it('says so out loud instead of quietly resetting the user', async () => {
    mockLoadPreferences.mockResolvedValue({
      status: 'error',
      error: { kind: 'Serialization', message: 'Failed to parse preferences' },
    })

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => usePreferences(), {
      wrapper: Wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(defaultPreferences)
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Preferences file could not be parsed, using defaults',
      {
        error: {
          kind: 'Serialization',
          message: 'Failed to parse preferences',
        },
      }
    )
    expect(mockToast.error).toHaveBeenCalledWith(
      'Preferences file could not be read, so defaults are in use'
    )
  })

  it('stays quiet on a missing file, which is just a first run', async () => {
    mockLoadPreferences.mockResolvedValue({
      status: 'error',
      error: { kind: 'Io', message: 'Failed to read preferences file' },
    })

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => usePreferences(), {
      wrapper: Wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(defaultPreferences)
    expect(mockToast.error).not.toHaveBeenCalled()
    expect(mockLogger.warn).toHaveBeenCalled()
  })
})
