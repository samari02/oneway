import { useState, useEffect, useCallback } from 'react'
import { getTodayCheckIns } from '../api/habits'
import type { HabitCheckIn } from '@oneway/shared'

interface UseTodayCheckInsResult {
  checkIns: HabitCheckIn[]
  checkedIds: Set<string>
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useTodayCheckIns(userId: string | undefined): UseTodayCheckInsResult {
  const [checkIns, setCheckIns] = useState<HabitCheckIn[]>([])
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
      const data = await getTodayCheckIns(userId)
      setCheckIns(data)
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetch()
  }, [fetch])

  const checkedIds = new Set(checkIns.map(c => c.habit_id))

  return { checkIns, checkedIds, loading, error, refetch: fetch }
}
