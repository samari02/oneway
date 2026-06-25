import { supabase } from '@/lib/supabase'
import type { DailyPlan, FocusArea } from '@oneway/shared'
import { formatLocalDateKey } from './dailyPlans'

export type CompletedGoalRecord = {
  goalId: string
  title: string
  areaId: string | null
  planDate: string
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isInCurrentWeek(dateKey: string, now = new Date()): boolean {
  const date = parseDateKey(dateKey)
  const weekStart = startOfWeek(now)
  const weekEnd = addDays(weekStart, 7)
  return date >= weekStart && date < weekEnd
}

function isInPreviousWeek(dateKey: string, now = new Date()): boolean {
  const date = parseDateKey(dateKey)
  const weekStart = startOfWeek(now)
  const prevStart = addDays(weekStart, -7)
  return date >= prevStart && date < weekStart
}

export function extractCompletedGoals(plans: DailyPlan[]): CompletedGoalRecord[] {
  const records: CompletedGoalRecord[] = []

  for (const plan of plans) {
    for (const goal of plan.goals ?? []) {
      if (goal.status !== 'done') continue
      records.push({
        goalId: goal.id,
        title: goal.title,
        areaId: goal.area ?? null,
        planDate: plan.plan_date,
      })
    }
  }

  return records.sort((a, b) => b.planDate.localeCompare(a.planDate))
}

export async function getCompletedGoalsHistory(
  userId: string,
  lookbackDays = 120,
): Promise<CompletedGoalRecord[]> {
  const end = new Date()
  const start = addDays(end, -lookbackDays)
  const startKey = formatLocalDateKey(start)

  const { data, error } = await supabase
    .from('daily_plans')
    .select('*')
    .eq('user_id', userId)
    .gte('plan_date', startKey)
    .order('plan_date', { ascending: false })

  if (error) throw error
  return extractCompletedGoals((data ?? []) as DailyPlan[])
}

export type FocusAreaProgressStat = {
  areaId: string
  label: string
  emoji: string | null
  color: string | null
  totalCompleted: number
  thisWeek: number
  streak: number
  lastActiveDate: string | null
}

export type ProgressWeekGroup = {
  weekStartKey: string
  weekLabel: string
  totalCount: number
  goals: CompletedGoalRecord[]
}

export type ProgressSummary = {
  weekTotal: number
  lastWeekTotal: number
  areaStats: FocusAreaProgressStat[]
  weekGroups: ProgressWeekGroup[]
  observations: string[]
}

function formatWeekLabel(weekStart: Date): string {
  return `Week of ${weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
}

function computeAreaStreak(activeDates: string[], now = new Date()): number {
  if (activeDates.length === 0) return 0

  const unique = [...new Set(activeDates)].sort((a, b) => b.localeCompare(a))
  let streak = 0
  let cursor = new Date(now)
  cursor.setHours(0, 0, 0, 0)

  const todayKey = formatLocalDateKey(cursor)
  const hasToday = unique.includes(todayKey)
  if (!hasToday) {
    cursor = addDays(cursor, -1)
  }

  while (true) {
    const key = formatLocalDateKey(cursor)
    if (!unique.includes(key)) break
    streak += 1
    cursor = addDays(cursor, -1)
  }

  return streak
}

function resolveArea(
  areaId: string | null,
  focusAreas: FocusArea[],
): Pick<FocusAreaProgressStat, 'areaId' | 'label' | 'emoji' | 'color'> {
  if (areaId) {
    const area = focusAreas.find((a) => a.id === areaId)
    if (area) {
      return {
        areaId: area.id,
        label: area.label,
        emoji: area.emoji,
        color: area.color,
      }
    }
    return {
      areaId,
      label: areaId.charAt(0).toUpperCase() + areaId.slice(1),
      emoji: null,
      color: '#a78bfa',
    }
  }

  return {
    areaId: 'uncategorized',
    label: 'Other',
    emoji: '✦',
    color: '#a78bfa',
  }
}

export function computeProgressSummary(
  completedGoals: CompletedGoalRecord[],
  focusAreas: FocusArea[],
  now = new Date(),
): ProgressSummary {
  const weekTotal = completedGoals.filter((g) => isInCurrentWeek(g.planDate, now)).length
  const lastWeekTotal = completedGoals.filter((g) => isInPreviousWeek(g.planDate, now)).length

  const areaIds = new Set<string>()
  for (const area of focusAreas) areaIds.add(area.id)
  for (const goal of completedGoals) {
    areaIds.add(goal.areaId ?? 'uncategorized')
  }

  const areaStats: FocusAreaProgressStat[] = Array.from(areaIds).map((rawId) => {
    const areaGoals = completedGoals.filter((g) => (g.areaId ?? 'uncategorized') === rawId)
    const activeDates = areaGoals.map((g) => g.planDate)
    const meta = resolveArea(rawId === 'uncategorized' ? null : rawId, focusAreas)

    return {
      ...meta,
      totalCompleted: areaGoals.length,
      thisWeek: areaGoals.filter((g) => isInCurrentWeek(g.planDate, now)).length,
      streak: computeAreaStreak(activeDates, now),
      lastActiveDate: activeDates[0] ?? null,
    }
  })

  areaStats.sort((a, b) => b.thisWeek - a.thisWeek || b.totalCompleted - a.totalCompleted)

  const weekMap = new Map<string, CompletedGoalRecord[]>()
  for (const goal of completedGoals) {
    const weekStart = startOfWeek(parseDateKey(goal.planDate))
    const key = formatLocalDateKey(weekStart)
    const list = weekMap.get(key) ?? []
    list.push(goal)
    weekMap.set(key, list)
  }

  const weekGroups: ProgressWeekGroup[] = Array.from(weekMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([weekStartKey, goals]) => ({
      weekStartKey,
      weekLabel: formatWeekLabel(parseDateKey(weekStartKey)),
      totalCount: goals.length,
      goals,
    }))

  const observations = buildObservations(areaStats, weekTotal, lastWeekTotal, completedGoals.length)

  return { weekTotal, lastWeekTotal, areaStats, weekGroups, observations }
}

function buildObservations(
  areaStats: FocusAreaProgressStat[],
  weekTotal: number,
  lastWeekTotal: number,
  totalCompleted: number,
): string[] {
  if (totalCompleted < 3) return []

  const observations: string[] = []
  const topStreak = [...areaStats].sort((a, b) => b.streak - a.streak)[0]
  if (topStreak && topStreak.streak >= 3) {
    observations.push(`You've been consistent with ${topStreak.label} — ${topStreak.streak} days in a row.`)
  }

  if (weekTotal > lastWeekTotal && lastWeekTotal > 0) {
    observations.push(`Momentum is building — ${weekTotal} goals this week, up from ${lastWeekTotal} last week.`)
  } else if (weekTotal >= 5) {
    const leader = areaStats.find((a) => a.thisWeek > 0)
    if (leader) {
      observations.push(`${leader.label} picked up this week — ${leader.thisWeek} goal${leader.thisWeek === 1 ? '' : 's'} completed.`)
    }
  }

  if (observations.length === 0 && weekTotal > 0) {
    observations.push(`${weekTotal} goal${weekTotal === 1 ? '' : 's'} completed this week. Keep going.`)
  }

  return observations.slice(0, 2)
}

export function formatGoalDate(dateKey: string): string {
  const date = parseDateKey(dateKey)
  const now = new Date()
  if (isSameDay(date, now)) return 'Today'
  const yesterday = addDays(now, -1)
  if (isSameDay(date, yesterday)) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
