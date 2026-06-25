import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FocusArea } from '@oneway/shared'
import {
  computeProgressSummary,
  extractCompletedTasks,
  getCompletedGoalsHistory,
  mergeCompletedRecords,
  type ProgressSummary,
} from '../api/progressStats'
import { useTaskStore } from './useTaskStore'

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
  const { tasks } = useTaskStore()
  const [summary, setSummary] = useState<ProgressSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const areasKey = useMemo(
    () => focusAreas.map((a) => a.id).join(','),
    [focusAreas],
  )
  const areasRef = useRef(focusAreas)
  areasRef.current = focusAreas

  const completedTasksKey = useMemo(
    () =>
      tasks
        .filter((task) => task.status === 'done' && task.completedAt)
        .map((task) => `${task.id}:${task.completedAt}`)
        .join('|'),
    [tasks],
  )

  const refetch = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      setError(null)
      const completedTasks = extractCompletedTasks(tasks)
      setSummary(computeProgressSummary(completedTasks, areasRef.current))
      return
    }

    setLoading(true)
    setError(null)
    try {
      const completedGoals = await getCompletedGoalsHistory(userId)
      const completedTasks = extractCompletedTasks(tasks)
      const completed = mergeCompletedRecords(completedGoals, completedTasks)
      setSummary(computeProgressSummary(completed, areasRef.current))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load progress'
      setError(msg)
      setSummary(null)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, areasKey, completedTasksKey])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { summary, loading, error, refetch }
}
