export type FocusAreaSource = 'user' | 'ai_proposed' | 'ai_confirmed'
export type FocusAreaStatus = 'active' | 'archived'

export type FocusArea = {
  id: string
  user_id: string
  label: string
  emoji: string | null
  color: string | null
  parent_id: string | null
  source: FocusAreaSource
  status: FocusAreaStatus
  confidence: number
  mention_count: number
  first_seen_at: string
  last_seen_at: string
  display_order: number
  created_at: string
  updated_at: string
}

export type FocusAreaInsert = Omit<
  FocusArea,
  'id' | 'created_at' | 'updated_at' | 'first_seen_at' | 'last_seen_at'
> & {
  first_seen_at?: string
  last_seen_at?: string
}

export type FocusAreaUpdate = Partial<
  Pick<FocusArea, 'label' | 'emoji' | 'color' | 'parent_id' | 'status' | 'display_order' | 'confidence' | 'mention_count' | 'last_seen_at'>
>

export type UserContext = {
  id: string
  user_id: string
  context_text: string
  processed: boolean
  created_at: string
  updated_at: string
}

export type UserContextInsert = Pick<UserContext, 'user_id' | 'context_text'>
