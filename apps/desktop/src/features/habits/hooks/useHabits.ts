import { useState, useEffect, useCallback } from 'react'
import { getHabits } from '../api/habits'
import type { Habit } from '@oneway/shared'

interface UseHabitsResult {
  habits: Habit[]
  loading: boolean
  error: Error | null
  refetch: (silent?: boolean) => Promise<void>
  optimisticRemove: (habitId: string) => void
}

export function useHabits(userId: string | undefined): UseHabitsResult {
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetch = useCallback(async (silent = false) => {
    if (!userId) {
      setLoading(false)
      return
    }

    // Only show loading on initial fetch, not on silent refetch
    if (!silent) {
      setLoading(true)
    }
    setError(null)

    try {
      const data = await getHabits(userId)
      setHabits(data)
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'))
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [userId])

  useEffect(() => {
    fetch(false) // Initial fetch shows loading
  }, [fetch])

  // Optimistic remove: instantly remove from UI before server confirms
  const optimisticRemove = useCallback((habitId: string) => {
    setHabits(prev => prev.filter(h => h.id !== habitId))
  }, [])

  return { habits, loading, error, refetch: fetch, optimisticRemove }
}
