import { useState } from 'react'
import { 
  checkHabit as checkHabitApi, 
  uncheckHabit as uncheckHabitApi,
  createHabit as createHabitApi,
  updateHabit as updateHabitApi,
  deleteHabit as deleteHabitApi,
  type CreateHabitData,
  type UpdateHabitData
} from '../api/habits'
import type { Habit } from '@oneway/shared'

interface UseHabitActionsResult {
  check: (habitId: string, userId: string) => Promise<void>
  uncheck: (habitId: string) => Promise<void>
  create: (habit: CreateHabitData) => Promise<Habit>
  update: (habitId: string, updates: UpdateHabitData) => Promise<Habit>
  remove: (habitId: string) => Promise<void>
  loading: boolean
  error: Error | null
}

export function useHabitActions(): UseHabitActionsResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const check = async (habitId: string, userId: string) => {
    setLoading(true)
    setError(null)
    try {
      await checkHabitApi(habitId, userId)
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'))
      throw e
    } finally {
      setLoading(false)
    }
  }

  const uncheck = async (habitId: string) => {
    setLoading(true)
    setError(null)
    try {
      await uncheckHabitApi(habitId)
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'))
      throw e
    } finally {
      setLoading(false)
    }
  }

  const create = async (habit: CreateHabitData) => {
    setLoading(true)
    setError(null)
    try {
      const newHabit = await createHabitApi(habit)
      return newHabit
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'))
      throw e
    } finally {
      setLoading(false)
    }
  }

  const update = async (habitId: string, updates: UpdateHabitData) => {
    setLoading(true)
    setError(null)
    try {
      const updatedHabit = await updateHabitApi(habitId, updates)
      return updatedHabit
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'))
      throw e
    } finally {
      setLoading(false)
    }
  }

  const remove = async (habitId: string) => {
    setLoading(true)
    setError(null)
    try {
      await deleteHabitApi(habitId)
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'))
      throw e
    } finally {
      setLoading(false)
    }
  }

  return { check, uncheck, create, update, remove, loading, error }
}
