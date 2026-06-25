import { useCallback, useEffect, useState } from 'react'
import type { FocusArea } from '@oneway/shared'
import {
  computeProgressSummary,
  getCompletedGoalsHistory,
  type ProgressSummary,
} from '../api/progressStats'

type UseProgressStatsResult = {
  summary: ProgressSummary | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useProgressStats(
  userId: string | undefined,
  focusAreas: FocusArea[],
): UseProgressStatsResult {
  const [summary, setSummary] = useState<ProgressSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const completed = await getCompletedGoalsHistory(userId)
      setSummary(computeProgressSummary(completed, focusAreas))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load progress'
      setError(msg)
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [userId, focusAreas])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { summary, loading, error, refetch }
}
