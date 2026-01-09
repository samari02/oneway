import { useState, useEffect, useCallback, useRef } from 'react'
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
  
  // Track in-flight toggles to prevent double-clicks
  const pendingToggles = useRef<Set<string>>(new Set())
  // Keep current checkIns in ref to avoid stale closures
  const checkInsRef = useRef<HabitCheckIn[]>([])
  
  // Sync ref with state
  useEffect(() => {
    checkInsRef.current = checkIns
  }, [checkIns])

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
      checkInsRef.current = data
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

  // Toggle with optimistic update
  const toggleHabit = useCallback(async (habitId: string, visibleUserId: string) => {
    // Prevent double-clicks
    if (pendingToggles.current.has(habitId)) {
      return
    }
    pendingToggles.current.add(habitId)

    // Read current state from ref (always fresh)
    const currentCheckIns = checkInsRef.current
    const isCurrentlyChecked = currentCheckIns.some(c => c.habit_id === habitId)
    
    // Optimistic update
    if (isCurrentlyChecked) {
      const newCheckIns = currentCheckIns.filter(c => c.habit_id !== habitId)
      setCheckIns(newCheckIns)
      checkInsRef.current = newCheckIns
    } else {
      const optimisticCheckIn: HabitCheckIn = {
        id: `temp-${habitId}-${Date.now()}`,
        habit_id: habitId,
        user_id: visibleUserId,
        date: new Date().toISOString().split('T')[0],
        completed_at: new Date().toISOString(),
      }
      const newCheckIns = [...currentCheckIns, optimisticCheckIn]
      setCheckIns(newCheckIns)
      checkInsRef.current = newCheckIns
    }

    // Sync with server
    try {
      if (isCurrentlyChecked) {
        await uncheckHabit(habitId)
        // Uncheck successful - state is already updated
      } else {
        const realCheckIn = await checkHabit(habitId, visibleUserId)
        // Replace temp with real check-in
        setCheckIns(prev => {
          const updated = prev.map(c => 
            c.habit_id === habitId && c.id.startsWith('temp-') ? realCheckIn : c
          )
          checkInsRef.current = updated
          return updated
        })
      }
    } catch (e) {
      console.error('Failed to sync habit:', e)
      // Revert on error
      await fetch()
    } finally {
      pendingToggles.current.delete(habitId)
    }
  }, [fetch])

  return { checkIns, checkedIds, loading, error, refetch: fetch, toggleHabit }
}
