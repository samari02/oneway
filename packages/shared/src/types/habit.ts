export type TimeOfDay = 'morning' | 'evening' | 'anytime'
export type HabitType = 'do' | 'avoid'
export type AvoidCategory = 'digital' | 'physical'

export interface Goal {
  id: string
  user_id: string
  name: string
  icon?: string
  progress: number // 0-100
  target_date?: string // YYYY-MM-DD
  created_at: string
  updated_at: string
}

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
  
  // Boundary support (unified Do/Avoid system)
  habit_type: HabitType
  avoid_category?: AvoidCategory  // For 'avoid' type only
  time_start?: string             // HH:MM - boundary period start
  time_end?: string               // HH:MM - boundary period end
  blocked_sites?: string[]        // For digital boundaries
  days_of_week?: number[]         // 1=Mon, 7=Sun. null = every day
  
  // Goal linking
  goal_id?: string                // Link to a specific goal
  linked_to_north_star?: boolean  // Whether this habit contributes to the main goal
}

export interface HabitCheckIn {
  id: string
  habit_id: string
  user_id: string
  date: string // YYYY-MM-DD
  completed_at: string
  
  // Boundary tracking
  completed: boolean              // For boundaries: respected (true) or violated (false)
  violation_count?: number        // Number of bypass/violations
  bypass_timestamps?: string[]    // When violations occurred
}

export interface HabitStreak {
  habit_id: string
  current_streak: number
  longest_streak: number
  last_check_in: string | null
}
