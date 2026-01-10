import { useState, useEffect, useCallback } from 'react'
import type { Goal } from '@oneway/shared'
import { getGoals, createGoal, updateGoal, deleteGoal } from '../api/goals'

export function useGoals(userId: string | undefined) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchGoals = useCallback(async () => {
    if (!userId) {
      setGoals([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await getGoals(userId)
      setGoals(data)
      setError(null)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  const create = async (goal: Omit<Goal, 'id' | 'created_at' | 'updated_at'>) => {
    const newGoal = await createGoal(goal)
    setGoals(prev => [...prev, newGoal])
    return newGoal
  }

  const update = async (goalId: string, updates: Partial<Goal>) => {
    const updated = await updateGoal(goalId, updates)
    setGoals(prev => prev.map(g => g.id === goalId ? updated : g))
    return updated
  }

  const remove = async (goalId: string) => {
    await deleteGoal(goalId)
    setGoals(prev => prev.filter(g => g.id !== goalId))
  }

  return {
    goals,
    loading,
    error,
    refetch: fetchGoals,
    create,
    update,
    remove
  }
}
