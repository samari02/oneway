export type DailyGoalStatus = 'pending' | 'in_progress' | 'done' | 'skipped'

export type DailyGoal = {
  id: string
  title: string
  area?: string
  priority?: number
  status: DailyGoalStatus
  focused_seconds?: number
  carry_forward_count?: number
}

export type DailyPlanStatus = 'draft' | 'active' | 'completed' | 'reflected'

export type DailyPlan = {
  id: string
  user_id: string
  plan_date: string
  goals: DailyGoal[]
  priority_goal_id: string | null
  blockers: string[] | null
  suggested_duration_minutes: number | null
  status: DailyPlanStatus
  created_at: string
  updated_at: string
}

export type FocusSessionStatus = 'active' | 'paused' | 'completed' | 'abandoned'

export type DriftEventAction = 'return' | 'continue'

export type DriftEvent = {
  detected_at: string
  site?: string
  duration_seconds: number
  action: DriftEventAction
}

export type FocusSession = {
  id: string
  user_id: string
  daily_plan_id: string
  goal_id: string
  goal_title: string
  started_at: string
  ended_at: string | null
  duration_target_minutes: number | null
  blocked_sites: string[]
  focused_seconds: number
  drift_events: DriftEvent[]
  status: FocusSessionStatus
  created_at: string
  updated_at: string
}

export type DayState = 'morning' | 'active' | 'focus' | 'evening'
