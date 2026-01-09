import { supabase } from '../../../lib/supabase'
import type { HabitCheckIn, Habit } from '@oneway/shared'

export interface DailyCompletion {
  date: string
  completedHabits: string[]
  totalRequired: number
  completedRequired: number
}

/**
 * Fetch all check-ins for a user within a date range
 */
export async function fetchCheckIns(
  userId: string,
  startDate: string,
  endDate: string
): Promise<HabitCheckIn[]> {
  const { data, error } = await supabase
    .from('habit_check_ins')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Fetch all check-ins for a user (all time)
 */
export async function fetchAllCheckIns(userId: string): Promise<HabitCheckIn[]> {
  const { data, error } = await supabase
    .from('habit_check_ins')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Fetch active habits for a user
 */
export async function fetchActiveHabits(userId: string): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('order', { ascending: true })

  if (error) throw error
  return data || []
}
