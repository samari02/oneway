export interface User {
  id: string
  email: string
  created_at: string
}

export interface UserSettings {
  user_id: string
  morning_routine_habits: string[] // habit IDs required before unblocking
  default_blocking_mode: 'off' | 'focus' | 'morning_routine'
  updated_at: string
  // North Star Goal
  north_star_goal?: string
  north_star_icon?: string
  north_star_created_at?: string
}

export interface NorthStar {
  goal: string
  icon: string
  created_at?: string
}
