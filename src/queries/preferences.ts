import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import i18n from '@/i18n/config'
import {
  commands,
  type AppPreferences,
  type PreferencePatch,
} from '@/lib/tauri-bindings'

// Query keys for preferences
export const preferencesQueryKeys = {
  all: ['preferences'] as const,
  preferences: () => [...preferencesQueryKeys.all] as const,
}

// TanStack Query hooks following the architectural patterns
export function usePreferences() {
  return useQuery({
    queryKey: preferencesQueryKeys.preferences(),
    queryFn: async (): Promise<AppPreferences> => {
      logger.debug('Loading preferences from backend')
      const result = await commands.loadPreferences()

      if (result.status === 'error') {
        // A missing file is a first run; a file that cannot be parsed is data
        // damage, and treating the two alike is how a corrupt preferences.json
        // silently resets the whole app to defaults with nothing said to anyone.
        if (result.error.kind === 'Serialization') {
          logger.error('Preferences file could not be parsed, using defaults', {
            error: result.error,
          })
          toast.error(i18n.t('toast.error.preferencesCorrupted'))
        } else {
          logger.warn('Failed to load preferences, using defaults', {
            error: result.error,
          })
        }
        return {
          theme: 'system',
          quick_pane_shortcut: null,
          language: null,
          crash_reporting_consent: null,
        }
      }

      logger.info('Preferences loaded successfully', {
        preferences: result.data,
      })
      return result.data
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  })
}

/**
 * Applies field-level patches and refreshes the cache from what Rust reports.
 *
 * The cache is set from the response rather than from the caller's guess, because
 * the caller is exactly the party that may be holding a stale document.
 */
export function usePatchPreferences() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (patches: PreferencePatch[]): Promise<AppPreferences> => {
      logger.debug('Patching preferences', { patches })
      const result = await commands.applyPreferencePatches(patches)

      if (result.status === 'error') {
        logger.error('Failed to patch preferences', {
          error: result.error,
          patches,
        })
        toast.error(i18n.t('toast.error.preferencesSaveFailed'), {
          description: result.error.message,
        })
        throw new Error(result.error.message)
      }

      logger.info('Preferences patched successfully', {
        preferences: result.data,
      })
      return result.data
    },
    onSuccess: preferences => {
      queryClient.setQueryData(preferencesQueryKeys.preferences(), preferences)
      toast.success(i18n.t('toast.success.preferencesSaved'))
    },
  })
}
