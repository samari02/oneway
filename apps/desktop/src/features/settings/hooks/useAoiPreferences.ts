import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAuth } from '@/features/auth/context/AuthContext'
import { 
  getAoiPreferences as getFromSupabase, 
  updateAoiPreferences as updateInSupabase,
  type AoiPreferences 
} from '@/features/onboarding/api/settings'

interface RustAoiPreferences {
  hidden_global: boolean
  hidden_domains: string[]
}

/**
 * Hook to sync Aoi preferences between:
 * - Supabase (cloud persistence)
 * - Local file (~/.clarity/aoi-preferences.json)
 * - Chrome extension (via native messaging)
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
        
        // Also save to local file so extension can read it
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
        const localPrefs = await invoke<RustAoiPreferences>('get_aoi_preferences')
        
        // Convert from Rust format to JS format
        const prefs: AoiPreferences = {
          hiddenGlobal: localPrefs.hidden_global,
          hiddenDomains: localPrefs.hidden_domains,
        }
        
        // Check if different from current state
        const hasChanged = 
          prefs.hiddenGlobal !== preferences.hiddenGlobal ||
          JSON.stringify(prefs.hiddenDomains) !== JSON.stringify(preferences.hiddenDomains)
        
        if (hasChanged) {
          console.log('[AoiPreferences] Extension updated preferences:', prefs)
          setPreferences(prefs)
          setLastSyncFromExtension(Date.now())
          
          // Sync to Supabase
          await updateInSupabase(user.id, prefs)
          console.log('[AoiPreferences] Synced to Supabase')
        }
      } catch (error) {
        // Silently ignore - file might not exist yet
      }
    }

    const interval = setInterval(checkForExtensionUpdates, 5000)
    return () => clearInterval(interval)
  }, [user?.id, preferences])

  // Update preferences (from UI)
  const updatePreferences = useCallback(async (newPrefs: Partial<AoiPreferences>) => {
    if (!user?.id) return

    const updated: AoiPreferences = {
      ...preferences,
      ...newPrefs,
    }

    setPreferences(updated)

    try {
      // Save to local file (for extension)
      await invoke('save_aoi_preferences', {
        hiddenGlobal: updated.hiddenGlobal,
        hiddenDomains: updated.hiddenDomains,
      })

      // Save to Supabase
      await updateInSupabase(user.id, updated)
    } catch (error) {
      console.error('Failed to save Aoi preferences:', error)
    }
  }, [user?.id, preferences])

  return {
    preferences,
    isLoading,
    updatePreferences,
    lastSyncFromExtension,
  }
}
