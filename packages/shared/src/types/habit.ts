export interface Habit {
  id: string
  user_id: string
  name: string
  icon?: string
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
