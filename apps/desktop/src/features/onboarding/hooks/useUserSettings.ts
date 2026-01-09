import { useState, useEffect, useCallback } from 'react'
import { getUserSettings, type UserSettings } from '../api/settings'

interface UseUserSettingsResult {
  settings: UserSettings | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useUserSettings(userId: string | undefined): UseUserSettingsResult {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetch = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await getUserSettings(userId)
      setSettings(data)
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to fetch settings'))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { settings, loading, error, refetch: fetch }
}
