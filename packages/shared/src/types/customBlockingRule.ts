export type CustomBlockingRuleType = 'url_contains' | 'search_contains'

export type CustomBlockingMatchMode = 'contains' | 'host_is'

export type CommitmentLevel = 'flexible' | 'committed' | 'locked'

export interface CustomBlockingRule {
  id: string
  user_id: string
  rule_type: CustomBlockingRuleType
  value: string
  match_mode: CustomBlockingMatchMode
  note: string | null
  commitment_level: CommitmentLevel
  locked_until: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
