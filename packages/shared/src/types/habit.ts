export type TimeOfDay = 'morning' | 'evening' | 'anytime'

export interface Habit {
  id: string
  user_id: string
  name: string
  icon?: string
  description?: string
  duration_minutes?: number
  is_required: boolean
  time_of_day: TimeOfDay
  scheduled_time?: string // HH:MM format, e.g. "05:30", "14:00"
  order: number
  is_active: boolean
  created_at: string
}

export interface HabitCheckIn {
  id: string
  habit_id: string
  user_id: string
  date: string // YYYY-MM-DD
  completed_at: string
}

export interface HabitStreak {
  habit_id: string
  current_streak: number
  longest_streak: number
  last_check_in: string | null
}
