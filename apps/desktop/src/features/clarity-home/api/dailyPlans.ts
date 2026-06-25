import { supabase } from '@/lib/supabase'
import type { DailyGoal, DailyPlan, FocusSession } from '@oneway/shared'
import {
  getDayPlanStorageKey,
  getTodayDayPlan,
  type DayPlan,
  type MorningFlowState,
} from '../hooks/useMorningFlow'

export function clearTodayDayPlanLocal(): void {
  localStorage.removeItem(getDayPlanStorageKey())
}

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
    area: item.area,
    status: item.id === local.priorityItemId ? 'in_progress' : 'pending',
  }))

  return {
    id: `local-${formatLocalDateKey()}`,
    user_id: userId,
    plan_date: formatLocalDateKey(),
    goals,
    priority_goal_id: local.priorityItemId ?? null,
    blockers: local.blockers?.length ? local.blockers : null,
    suggested_duration_minutes: local.durationMinutes ?? null,
    status: 'active',
    created_at: local.completedAt,
    updated_at: local.completedAt,
  }
}

function mapMorningFlowToInsert(userId: string, state: MorningFlowState): Omit<DailyPlan, 'id' | 'created_at' | 'updated_at'> {
  const goals: DailyGoal[] = (state.items ?? []).map((item) => ({
    id: item.id,
    title: item.text,
    area: item.area,
    status: item.id === state.priorityItemId ? 'in_progress' : 'pending',
  }))

  return {
    user_id: userId,
    plan_date: formatLocalDateKey(),
    goals,
    priority_goal_id: state.priorityItemId ?? null,
    blockers: state.blockers?.length ? state.blockers : null,
    suggested_duration_minutes: state.durationMinutes ?? null,
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

export async function endActiveFocusSessions(userId: string): Promise<void> {
  const { error } = await supabase
    .from('focus_sessions')
    .update({
      status: 'abandoned',
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .in('status', ['active', 'paused'])

  if (error) throw error
}

export async function resetTodayPlan(userId: string): Promise<void> {
  const planDate = formatLocalDateKey()

  await endActiveFocusSessions(userId)

  const { error: deleteError } = await supabase
    .from('daily_plans')
    .delete()
    .eq('user_id', userId)
    .eq('plan_date', planDate)

  if (deleteError) throw deleteError

  clearTodayDayPlanLocal()
}

export async function skipEveningReflection(userId: string): Promise<DailyPlan> {
  const plan = await getTodayPlan(userId)
  if (!plan) throw new Error('No plan to skip evening reflection for')

  if (plan.id.startsWith('local-')) {
    const reflected = await createDailyPlan(userId, {
      user_id: userId,
      plan_date: formatLocalDateKey(),
      goals: plan.goals,
      priority_goal_id: plan.priority_goal_id,
      blockers: plan.blockers,
      suggested_duration_minutes: plan.suggested_duration_minutes,
      status: 'reflected',
    })
    clearTodayDayPlanLocal()
    return reflected
  }

  return updateDailyPlan(plan.id, { status: 'reflected' })
}

export async function syncMorningFlowPlan(userId: string, state: MorningFlowState): Promise<DailyPlan | null> {
  try {
    const existing = await getTodayPlan(userId)
    if (existing && !existing.id.startsWith('local-')) {
      const mapped = mapMorningFlowToInsert(userId, state)
      return updateDailyPlan(existing.id, {
        goals: mapped.goals,
        priority_goal_id: state.priorityItemId ?? null,
        blockers: mapped.blockers,
        suggested_duration_minutes: mapped.suggested_duration_minutes,
        status: 'active',
      })
    }
    return await createDailyPlanFromMorningFlow(userId, state)
  } catch (err) {
    console.error('[dailyPlans] Failed to sync morning flow plan:', err)
    return null
  }
}
