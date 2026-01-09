import { supabase } from '@/lib/supabase'
import type { Habit, HabitCheckIn } from '@oneway/shared'

export async function getHabits(userId: string): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('order')

  if (error) throw new Error(error.message)
  return data ?? []
}

export interface CreateHabitData {
  user_id: string
  name: string
  icon?: string
  description?: string
  duration_minutes?: number | null
  scheduled_time?: string
  is_required?: boolean
  time_of_day?: 'morning' | 'evening' | 'anytime'
}

export async function createHabit(habit: CreateHabitData): Promise<Habit> {
  const { data, error } = await supabase
    .from('habits')
    .insert({
      user_id: habit.user_id,
      name: habit.name,
      icon: habit.icon || '✨',
      description: habit.description || null,
      duration_minutes: habit.duration_minutes || null,
      scheduled_time: habit.scheduled_time || null,
      is_required: habit.is_required || false,
      time_of_day: habit.time_of_day || 'anytime',
      order: 0,
      is_active: true,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export interface UpdateHabitData {
  name?: string
  icon?: string
  description?: string
  duration_minutes?: number
  scheduled_time?: string
  is_required?: boolean
  time_of_day?: 'morning' | 'evening' | 'anytime'
  order?: number
  is_active?: boolean
}

export async function updateHabit(
  id: string,
  updates: UpdateHabitData
): Promise<Habit> {
  const { data, error } = await supabase
    .from('habits')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteHabit(id: string): Promise<void> {
  const { error } = await supabase
    .from('habits')
    .update({ is_active: false })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function getTodayCheckIns(userId: string): Promise<HabitCheckIn[]> {
  const today = new Date().toISOString().split('T')[0]
  
  const { data, error } = await supabase
    .from('habit_check_ins')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function checkHabit(
  habitId: string,
  userId: string
): Promise<HabitCheckIn> {
  const today = new Date().toISOString().split('T')[0]
  
  const { data, error } = await supabase
    .from('habit_check_ins')
    .upsert(
      {
        habit_id: habitId,
        user_id: userId,
        date: today,
      },
      { 
        onConflict: 'habit_id,date',
        ignoreDuplicates: true 
      }
    )
    .select()
    .single()

  // If ignoreDuplicates returns no data, fetch existing
  if (error?.code === 'PGRST116') {
    const { data: existing } = await supabase
      .from('habit_check_ins')
      .select('*')
      .eq('habit_id', habitId)
      .eq('date', today)
      .single()
    return existing!
  }

  if (error) throw new Error(error.message)
  return data
}

export async function uncheckHabit(habitId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  
  const { error } = await supabase
    .from('habit_check_ins')
    .delete()
    .eq('habit_id', habitId)
    .eq('date', today)

  if (error) throw new Error(error.message)
}

export async function getHabitStreak(habitId: string): Promise<number> {
  const { data, error } = await supabase
    .from('habit_check_ins')
    .select('date')
    .eq('habit_id', habitId)
    .order('date', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return 0

  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < data.length; i++) {
    const checkDate = new Date(data[i].date)
    checkDate.setHours(0, 0, 0, 0)
    
    const expectedDate = new Date(today)
    expectedDate.setDate(expectedDate.getDate() - i)
    
    if (checkDate.getTime() === expectedDate.getTime()) {
      streak++
    } else {
      break
    }
  }

  return streak
}
