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

    const timeoutMs = 12_000

    try {
      const settings = await Promise.race([
        getUserSettings(userId),
        new Promise<null>((_, reject) =>
          window.setTimeout(() => reject(new Error('timeout')), timeoutMs)
        ),
      ])
      setNeedsOnboarding(!settings?.onboarding_completed)
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Unknown error')
      if (err.message === 'timeout') {
        console.warn('[onboarding] getUserSettings timed out — showing onboarding')
      } else {
        setError(err)
      }
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
