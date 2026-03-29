import { supabase } from '@/lib/supabase'
import type {
  CommitmentLevel,
  CustomBlockingMatchMode,
  CustomBlockingRule,
  CustomBlockingRuleType,
} from '@oneway/shared'

export async function getCustomBlockingRules(userId: string): Promise<CustomBlockingRule[]> {
  const { data, error } = await supabase
    .from('custom_blocking_rules')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as CustomBlockingRule[]
}

export interface CreateCustomBlockingRuleInput {
  user_id: string
  rule_type: CustomBlockingRuleType
  value: string
  match_mode?: CustomBlockingMatchMode
  note?: string | null
  commitment_level?: CommitmentLevel
  locked_until?: string | null
}

export async function createCustomBlockingRule(
  input: CreateCustomBlockingRuleInput
): Promise<CustomBlockingRule> {
  const { data, error } = await supabase
    .from('custom_blocking_rules')
    .insert({
      user_id: input.user_id,
      rule_type: input.rule_type,
      value: input.value.trim(),
      match_mode: input.match_mode ?? 'contains',
      note: input.note?.trim() || null,
      commitment_level: input.commitment_level ?? 'flexible',
      locked_until: input.locked_until ?? null,
      is_active: true,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as CustomBlockingRule
}

export async function createCustomBlockingRulesBatch(
  inputs: CreateCustomBlockingRuleInput[]
): Promise<CustomBlockingRule[]> {
  if (inputs.length === 0) return []
  const rows = inputs.map((input) => ({
    user_id: input.user_id,
    rule_type: input.rule_type,
    value: input.value.trim(),
    match_mode: input.match_mode ?? 'contains',
    note: input.note?.trim() || null,
    commitment_level: input.commitment_level ?? 'flexible',
    locked_until: input.locked_until ?? null,
    is_active: true,
  }))
  const { data, error } = await supabase.from('custom_blocking_rules').insert(rows).select()
  if (error) throw new Error(error.message)
  return (data ?? []) as CustomBlockingRule[]
}

export interface UpdateCustomBlockingRuleInput {
  value?: string
  match_mode?: CustomBlockingMatchMode
  note?: string | null
  commitment_level?: CommitmentLevel
  locked_until?: string | null
  is_active?: boolean
}

export async function updateCustomBlockingRule(
  id: string,
  updates: UpdateCustomBlockingRuleInput
): Promise<CustomBlockingRule> {
  const { data, error } = await supabase
    .from('custom_blocking_rules')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as CustomBlockingRule
}

export async function deleteCustomBlockingRule(id: string): Promise<void> {
  const { error } = await supabase.from('custom_blocking_rules').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
