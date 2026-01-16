export type BoundaryMode = 'block' | 'awareness'
export type BoundarySchedule = 'always' | 'scheduled' | 'weekdays' | 'weekends'

export interface Boundary {
  id: string
  user_id: string
  
  // What to block
  name: string                    // Display name (e.g., "Social Media")
  patterns: string[]              // URL patterns (e.g., ["twitter.com", "*.reddit.com"])
  
  // When to block
  schedule: BoundarySchedule
  time_start?: string             // HH:MM - only for 'scheduled'
  time_end?: string               // HH:MM - only for 'scheduled'
  
  // How to handle
  mode: BoundaryMode              // 'block' = redirect, 'awareness' = toast only
  reason?: string                 // Why this boundary exists (shown on block page)
  
  // State
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface BoundaryViolation {
  id: string
  boundary_id: string
  user_id: string
  url: string
  domain: string
  action: 'blocked' | 'bypassed' | 'notified'  // What happened
  timestamp: string
}

export interface BoundaryStats {
  boundary_id: string
  blocks_today: number
  blocks_this_week: number
  bypasses_today: number
  bypasses_this_week: number
  respect_rate: number            // 0-100 percentage
}
