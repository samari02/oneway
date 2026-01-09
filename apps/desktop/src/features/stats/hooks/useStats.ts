import { useState, useEffect, useCallback } from 'react'
import type { Habit, HabitCheckIn } from '@oneway/shared'
import { fetchAllCheckIns, fetchActiveHabits } from '../api/stats'
import {
  calculateCurrentStreak,
  calculateBestStreak,
  calculateCompletionRate,
  calculateHabitStats,
  getEncouragingMessage
} from '../utils/calculations'

export interface HabitStat {
  habit: Habit
  completionRate: number
  totalCheckIns: number
  totalDays: number
}

export interface Stats {
  currentStreak: number
  bestStreak: number
  weekCompletion: {
    rate: number
    completed: number
    total: number
  }
  monthCompletion: {
    rate: number
    completed: number
    total: number
  }
  perHabit: HabitStat[]
  encouragingMessage: string
}

export interface UseStatsResult {
  stats: Stats | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useStats(userId: string | undefined): UseStatsResult {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchStats = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetch data in parallel
      const [checkIns, habits] = await Promise.all([
        fetchAllCheckIns(userId),
        fetchActiveHabits(userId)
      ])

      // Calculate all stats
      const currentStreak = calculateCurrentStreak(checkIns, habits)
      const bestStreak = calculateBestStreak(checkIns, habits)
      const weekCompletion = calculateCompletionRate(checkIns, habits, 7)
      const monthCompletion = calculateCompletionRate(checkIns, habits, 30)
      const perHabit = calculateHabitStats(checkIns, habits, 14)
      const encouragingMessage = getEncouragingMessage(currentStreak, weekCompletion.rate)

      setStats({
        currentStreak,
        bestStreak,
        weekCompletion,
        monthCompletion,
        perHabit,
        encouragingMessage
      })
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to fetch stats'))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return { stats, loading, error, refetch: fetchStats }
}
