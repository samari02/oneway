import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAuth } from '@/features/auth/context/AuthContext'
import {
  getAoiPreferences as getFromSupabase,
  updateAoiPreferences as updateInSupabase,
  type AoiPreferences,
} from '@/features/onboarding/api/settings'

/** Matches `AoiPreferencesData` JSON from Tauri (serde `rename` → camelCase) */
interface AoiPreferencesFromRust {
  hiddenGlobal: boolean
  hiddenDomains: string[]
}

/**
 * Hook to sync Aoi preferences between:
 * - Supabase (cloud persistence)
 * - Local file (~/.clarity/aoi-preferences.json)
 * - Chrome extension (via native messaging + GET_AOI_PREFERENCES polling)
 */
export function useAoiPreferences() {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState<AoiPreferences>({
    hiddenGlobal: false,
    hiddenDomains: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [lastSyncFromExtension, setLastSyncFromExtension] = useState<number>(0)

  // Fetch from Supabase on mount
  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false)
      return
    }

    const fetchFromSupabase = async () => {
      try {
        const prefs = await getFromSupabase(user.id)
        setPreferences(prefs)

        await invoke('save_aoi_preferences', {
          hiddenGlobal: prefs.hiddenGlobal,
          hiddenDomains: prefs.hiddenDomains,
        })
      } catch (error) {
        console.error('Failed to fetch Aoi preferences from Supabase:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchFromSupabase()
  }, [user?.id])

  // Poll local file for changes from extension (every 5 seconds)
  useEffect(() => {
    if (!user?.id) return

    const checkForExtensionUpdates = async () => {
      try {
        const localPrefs = await invoke<AoiPreferencesFromRust>('get_aoi_preferences')

        const prefs: AoiPreferences = {
          hiddenGlobal: Boolean(localPrefs?.hiddenGlobal),
          hiddenDomains: Array.isArray(localPrefs?.hiddenDomains)
            ? localPrefs.hiddenDomains
            : [],
        }

        setPreferences((prev) => {
          const hasChanged =
            prefs.hiddenGlobal !== prev.hiddenGlobal ||
            JSON.stringify(prefs.hiddenDomains) !== JSON.stringify(prev.hiddenDomains)

          if (!hasChanged) return prev

          console.log('[AoiPreferences] Extension updated preferences:', prefs)
          setLastSyncFromExtension(Date.now())
          void updateInSupabase(user.id, prefs).then(() => {
            console.log('[AoiPreferences] Synced to Supabase')
          })
          return prefs
        })
      } catch {
        // File might not exist yet
      }
    }

    const interval = setInterval(checkForExtensionUpdates, 5000)
    return () => clearInterval(interval)
  }, [user?.id])

  const updatePreferences = useCallback(
    async (newPrefs: Partial<AoiPreferences>) => {
      if (!user?.id) return

      let updated: AoiPreferences | null = null
      setPreferences((prev) => {
        updated = { ...prev, ...newPrefs }
        return updated
      })
      if (!updated) return

      try {
        await invoke('save_aoi_preferences', {
          hiddenGlobal: updated.hiddenGlobal,
          hiddenDomains: updated.hiddenDomains,
        })
        await updateInSupabase(user.id, updated)
      } catch (error) {
        console.error('Failed to save Aoi preferences:', error)
      }
    },
    [user?.id]
  )

  return {
    preferences,
    isLoading,
    updatePreferences,
    lastSyncFromExtension,
  }
}
