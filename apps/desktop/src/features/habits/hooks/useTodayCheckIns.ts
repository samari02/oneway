import { useState, useEffect, useCallback } from 'react'
import { getTodayCheckIns, checkHabit, uncheckHabit } from '../api/habits'
import type { HabitCheckIn } from '@oneway/shared'

interface UseTodayCheckInsResult {
  checkIns: HabitCheckIn[]
  checkedIds: Set<string>
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  toggleHabit: (habitId: string, userId: string) => Promise<void>
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

  // Optimistic toggle with instant UI update
  const toggleHabit = useCallback(async (habitId: string, userId: string) => {
    const isCurrentlyChecked = checkedIds.has(habitId)
    
    // Optimistic update - update UI immediately
    if (isCurrentlyChecked) {
      setCheckIns(prev => prev.filter(c => c.habit_id !== habitId))
    } else {
      const optimisticCheckIn: HabitCheckIn = {
        id: `temp-${habitId}`,
        habit_id: habitId,
        user_id: userId,
        date: new Date().toISOString().split('T')[0],
        completed_at: new Date().toISOString(),
      }
      setCheckIns(prev => [...prev, optimisticCheckIn])
    }

    // Sync with server in background
    try {
      if (isCurrentlyChecked) {
        await uncheckHabit(habitId)
      } else {
        await checkHabit(habitId, userId)
      }
    } catch (e) {
      // Revert on error
      console.error('Failed to sync habit:', e)
      fetch() // Refetch to get correct state
    }
  }, [checkedIds, fetch])

  return { checkIns, checkedIds, loading, error, refetch: fetch, toggleHabit }
}
