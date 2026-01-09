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
}
