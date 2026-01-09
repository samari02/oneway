import { useState, useEffect, useCallback } from 'react'
import { getUserSettings } from '../api/settings'

interface UseOnboardingStatusResult {
  needsOnboarding: boolean
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function useOnboardingStatus(userId: string | undefined): UseOnboardingStatusResult {
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
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
      const settings = await getUserSettings(userId)
      setNeedsOnboarding(!settings?.onboarding_completed)
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'))
      // If we can't fetch settings, assume onboarding is needed
      setNeedsOnboarding(true)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { needsOnboarding, loading, error, refetch: fetch }
}
