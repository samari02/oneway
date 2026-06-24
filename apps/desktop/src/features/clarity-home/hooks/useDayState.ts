import { useState, useEffect, useCallback } from 'react'
import type { DailyPlan, FocusSession, DayState } from '@oneway/shared'
import { getTodayPlan, getActiveFocusSession } from '../api/dailyPlans'

interface UseDayStateOptions {
  userId: string | undefined
  eveningReflectionTime?: string // HH:MM, default '18:00'
}

interface UseDayStateResult {
  dayState: DayState
  todayPlan: DailyPlan | null
  activeSession: FocusSession | null
  isLoading: boolean
  refetch: () => Promise<void>
}

function isAfterTime(timeStr: string): boolean {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const now = new Date()
  return now.getHours() > hours || (now.getHours() === hours && now.getMinutes() >= minutes)
}

function deriveDayState(
  plan: DailyPlan | null,
  session: FocusSession | null,
  eveningTime: string,
): DayState {
  if (!plan || plan.status === 'draft') return 'morning'
  if (session && (session.status === 'active' || session.status === 'paused')) return 'focus'
  if (plan.status === 'reflected') return 'active'
  if (plan.status === 'completed' || isAfterTime(eveningTime)) return 'evening'
  return 'active'
}

export function useDayState({ userId, eveningReflectionTime = '18:00' }: UseDayStateOptions): UseDayStateResult {
  const [todayPlan, setTodayPlan] = useState<DailyPlan | null>(null)
  const [activeSession, setActiveSession] = useState<FocusSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!userId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const [plan, session] = await Promise.all([
        getTodayPlan(userId),
        getActiveFocusSession(userId),
      ])
      setTodayPlan(plan)
      setActiveSession(session)
    } catch (err) {
      console.error('[useDayState] Failed to fetch day state:', err)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const dayState = deriveDayState(todayPlan, activeSession, eveningReflectionTime)

  return { dayState, todayPlan, activeSession, isLoading, refetch: fetchData }
}
