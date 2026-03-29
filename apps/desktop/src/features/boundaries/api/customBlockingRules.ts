import { supabase } from '@/lib/supabase'
import type {
  CustomBlockingMatchMode,
  CustomBlockingRule,
  CustomBlockingRuleType,
} from '@oneway/shared'

/** Strip scheme and `www.` so pasted URLs match navigation (same logic as native host). */
export function normalizeUrlBlockingValue(raw: string): string {
  let s = raw.trim()
  if (!s) return s
  if (/^https:\/\//i.test(s)) s = s.slice(8)
  else if (/^http:\/\//i.test(s)) s = s.slice(7)
  s = s.trimStart()
  if (/^www\./i.test(s)) s = s.slice(4)
  return s.trim()
}

/**
 * Guess URL vs search keyword from a single line of input (no manual toggle).
 *
 * **URL** when: `http(s)://`, path-only starting with `/`, IPv4, `localhost`, or hostname-like
 * (`label.tld` with TLD length ≥ 2, no spaces).
 *
 * **Caveats:** Phrases with spaces always become search. Values like `no.porn` look like domains
 * and become URL rules. Version strings (`v1.0`) become search (TLD segment too short). Plain
 * `reddit` without a domain is search — type `reddit.com` to block the site.
 */
export function inferBlockingRuleType(input: string): CustomBlockingRuleType {
  const s = input.trim()
  if (!s) return 'search_contains'

  if (/^https?:\/\//i.test(s)) return 'url_contains'
  if (s.startsWith('/')) return 'url_contains'

  if (/\s/.test(s)) return 'search_contains'

  const hostPart = s.split('/')[0].split('?')[0].split('#')[0]

  if (/^localhost(:\d+)?$/i.test(hostPart)) return 'url_contains'

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostPart)) return 'url_contains'

  const labels = hostPart.split('.')
  if (labels.length >= 2) {
    const tld = labels[labels.length - 1]
    if (tld.length >= 2 && /^[a-z0-9-]+$/i.test(tld)) {
      return 'url_contains'
    }
  }

  return 'search_contains'
}

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
  const { data, error } = await supabase.from('custom_blocking_rules').delete().eq('id', id).select('id')
  if (error) throw new Error(error.message)
  if (!data?.length) {
    throw new Error('Could not delete this rule. Try signing in again or check your connection.')
  }
}
