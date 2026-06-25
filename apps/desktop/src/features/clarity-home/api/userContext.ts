import { supabase } from '@/lib/supabase'
import type { UserContext, UserContextInsert } from '@oneway/shared'

export async function getUserContext(userId: string): Promise<UserContext | null> {
  const { data, error } = await supabase
    .from('user_context')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as UserContext | null) ?? null
}

export async function saveUserContext(input: UserContextInsert): Promise<UserContext> {
  const existing = await getUserContext(input.user_id)

  if (existing) {
    const { data, error } = await supabase
      .from('user_context')
      .update({
        context_text: input.context_text,
        processed: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) throw error
    return data as UserContext
  }

  const { data, error } = await supabase
    .from('user_context')
    .insert({
      user_id: input.user_id,
      context_text: input.context_text,
    })
    .select()
    .single()

  if (error) throw error
  return data as UserContext
}

export async function markContextProcessed(contextId: string): Promise<void> {
  const { error } = await supabase
    .from('user_context')
    .update({
      processed: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contextId)

  if (error) throw error
}
