export type BlockingMode = 'off' | 'focus' | 'morning_routine'

export interface BlockingRule {
  id: string
  user_id: string
  pattern: string // e.g. "*://twitter.com/*"
  is_active: boolean
  mode: BlockingMode
  created_at: string
}

export interface BlockingState {
  mode: BlockingMode
  active_until?: string // ISO timestamp
  morning_routine_completed: boolean
}
