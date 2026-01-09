import { useState, useEffect, useCallback } from 'react'
import { getHabits } from '../api/habits'
import type { Habit } from '@oneway/shared'

interface UseHabitsResult {
  habits: Habit[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useHabits(userId: string | undefined): UseHabitsResult {
  const [habits, setHabits] = useState<Habit[]>([])
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
      const data = await getHabits(userId)
      setHabits(data)
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { habits, loading, error, refetch: fetch }
}
