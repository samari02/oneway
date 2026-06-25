import { supabase } from '@/lib/supabase'
import type { FocusArea, FocusAreaInsert, FocusAreaUpdate } from '@oneway/shared'

export async function getFocusAreas(userId: string): Promise<FocusArea[]> {
  const { data, error } = await supabase
    .from('focus_areas')
    .select('*')
    .eq('user_id', userId)
    .order('display_order', { ascending: true })

  if (error) throw error
  return (data as FocusArea[]) ?? []
}

export async function getActiveFocusAreas(userId: string): Promise<FocusArea[]> {
  const { data, error } = await supabase
    .from('focus_areas')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('display_order', { ascending: true })

  if (error) throw error
  return (data as FocusArea[]) ?? []
}

export async function createFocusArea(area: FocusAreaInsert): Promise<FocusArea> {
  const { data, error } = await supabase
    .from('focus_areas')
    .insert(area)
    .select()
    .single()

  if (error) throw error
  return data as FocusArea
}

export async function createFocusAreas(areas: FocusAreaInsert[]): Promise<FocusArea[]> {
  if (areas.length === 0) return []

  const { data, error } = await supabase
    .from('focus_areas')
    .insert(areas)
    .select()

  if (error) throw error
  return (data as FocusArea[]) ?? []
}

export async function updateFocusArea(
  id: string,
  updates: FocusAreaUpdate,
): Promise<FocusArea> {
  const { data, error } = await supabase
    .from('focus_areas')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as FocusArea
}

export async function archiveFocusArea(id: string): Promise<FocusArea> {
  return updateFocusArea(id, { status: 'archived' })
}

export async function reactivateFocusArea(id: string): Promise<FocusArea> {
  return updateFocusArea(id, { status: 'active' })
}

export async function deleteFocusArea(id: string): Promise<void> {
  const { error } = await supabase
    .from('focus_areas')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function incrementMentionCount(id: string): Promise<void> {
  const { error } = await supabase.rpc('increment_focus_area_mention', {
    area_id: id,
  })

  if (error) {
    // Fallback: fetch current, then update
    const { data } = await supabase
      .from('focus_areas')
      .select('mention_count')
      .eq('id', id)
      .single()

    if (data) {
      await supabase
        .from('focus_areas')
        .update({
          mention_count: (data.mention_count ?? 0) + 1,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
    }
  }
}
