import { supabase } from '@/lib/supabase'
import type { Goal } from '@oneway/shared'

export async function getGoals(userId: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function createGoal(goal: Omit<Goal, 'id' | 'created_at' | 'updated_at'>): Promise<Goal> {
  const { data, error } = await supabase
    .from('goals')
    .insert(goal)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateGoal(goalId: string, updates: Partial<Goal>): Promise<Goal> {
  const { data, error } = await supabase
    .from('goals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', goalId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteGoal(goalId: string): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', goalId)

  if (error) throw error
}
