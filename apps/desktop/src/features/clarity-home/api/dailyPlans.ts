import { supabase } from '@/lib/supabase'
import type { DailyGoal, DailyPlan, FocusSession } from '@oneway/shared'
import {
  getTodayDayPlan,
  type DayPlan,
  type MorningFlowState,
} from '../hooks/useMorningFlow'

export function formatLocalDateKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function mapLocalPlanToDailyPlan(userId: string, local: DayPlan): DailyPlan {
  const goals: DailyGoal[] = (local.items ?? []).map((item) => ({
    id: item.id,
    title: item.text,
    status: item.id === local.priorityItemId ? 'in_progress' : 'pending',
  }))

  return {
    id: `local-${formatLocalDateKey()}`,
    user_id: userId,
    plan_date: formatLocalDateKey(),
    goals,
    priority_goal_id: local.priorityItemId ?? null,
    blockers: null,
    suggested_duration_minutes: null,
    status: 'active',
    created_at: local.completedAt,
    updated_at: local.completedAt,
  }
}

function mapMorningFlowToInsert(userId: string, state: MorningFlowState): Omit<DailyPlan, 'id' | 'created_at' | 'updated_at'> {
  const goals: DailyGoal[] = (state.items ?? []).map((item) => ({
    id: item.id,
    title: item.text,
    status: item.id === state.priorityItemId ? 'in_progress' : 'pending',
  }))

  return {
    user_id: userId,
    plan_date: formatLocalDateKey(),
    goals,
    priority_goal_id: state.priorityItemId ?? null,
    blockers: null,
    suggested_duration_minutes: null,
    status: 'active',
  }
}

export async function getTodayPlan(userId: string): Promise<DailyPlan | null> {
  const planDate = formatLocalDateKey()

  const { data, error } = await supabase
    .from('daily_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('plan_date', planDate)
    .maybeSingle()

  if (error) throw error
  if (data) return data as DailyPlan

  const localPlan = getTodayDayPlan()
  if (!localPlan) return null

  return mapLocalPlanToDailyPlan(userId, localPlan)
}

export async function createDailyPlan(
  userId: string,
  plan: Omit<DailyPlan, 'id' | 'created_at' | 'updated_at'>,
): Promise<DailyPlan> {
  const { data, error } = await supabase
    .from('daily_plans')
    .insert({
      ...plan,
      user_id: userId,
    })
    .select()
    .single()

  if (error) throw error
  return data as DailyPlan
}

export async function createDailyPlanFromMorningFlow(
  userId: string,
  state: MorningFlowState,
): Promise<DailyPlan> {
  return createDailyPlan(userId, mapMorningFlowToInsert(userId, state))
}

export async function updateDailyPlan(
  planId: string,
  updates: Partial<
    Pick<
      DailyPlan,
      'goals' | 'priority_goal_id' | 'blockers' | 'suggested_duration_minutes' | 'status'
    >
  >,
): Promise<DailyPlan> {
  const { data, error } = await supabase
    .from('daily_plans')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', planId)
    .select()
    .single()

  if (error) throw error
  return data as DailyPlan
}

export async function getActiveFocusSession(userId: string): Promise<FocusSession | null> {
  const { data, error } = await supabase
    .from('focus_sessions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'paused'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as FocusSession | null) ?? null
}

export async function syncMorningFlowPlan(userId: string, state: MorningFlowState): Promise<DailyPlan | null> {
  try {
    const existing = await getTodayPlan(userId)
    if (existing && !existing.id.startsWith('local-')) {
      return updateDailyPlan(existing.id, {
        goals: mapMorningFlowToInsert(userId, state).goals,
        priority_goal_id: state.priorityItemId ?? null,
        status: 'active',
      })
    }
    return await createDailyPlanFromMorningFlow(userId, state)
  } catch (err) {
    console.error('[dailyPlans] Failed to sync morning flow plan:', err)
    return null
  }
}
