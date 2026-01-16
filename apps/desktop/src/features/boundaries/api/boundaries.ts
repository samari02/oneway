import { supabase } from '@/lib/supabase'
import type { Boundary, BoundaryViolation } from '@oneway/shared'

export async function getBoundaries(userId: string): Promise<Boundary[]> {
  const { data, error } = await supabase
    .from('boundaries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getActiveBoundaries(userId: string): Promise<Boundary[]> {
  const { data, error } = await supabase
    .from('boundaries')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export interface CreateBoundaryData {
  user_id: string
  name: string
  patterns: string[]
  schedule?: 'always' | 'scheduled' | 'weekdays' | 'weekends'
  time_start?: string
  time_end?: string
  mode?: 'block' | 'awareness'
  reason?: string
}

export async function createBoundary(boundary: CreateBoundaryData): Promise<Boundary> {
  const { data, error } = await supabase
    .from('boundaries')
    .insert({
      user_id: boundary.user_id,
      name: boundary.name,
      patterns: boundary.patterns,
      schedule: boundary.schedule || 'always',
      time_start: boundary.time_start || null,
      time_end: boundary.time_end || null,
      mode: boundary.mode || 'block',
      reason: boundary.reason || null,
      is_active: true,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export interface UpdateBoundaryData {
  name?: string
  patterns?: string[]
  schedule?: 'always' | 'scheduled' | 'weekdays' | 'weekends'
  time_start?: string | null
  time_end?: string | null
  mode?: 'block' | 'awareness'
  reason?: string | null
  is_active?: boolean
}

export async function updateBoundary(
  id: string,
  updates: UpdateBoundaryData
): Promise<Boundary> {
  const { data, error } = await supabase
    .from('boundaries')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteBoundary(id: string): Promise<void> {
  const { error } = await supabase
    .from('boundaries')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function toggleBoundary(id: string, isActive: boolean): Promise<Boundary> {
  return updateBoundary(id, { is_active: isActive })
}

// Violations tracking
export async function logViolation(
  boundaryId: string,
  userId: string,
  url: string,
  domain: string,
  action: 'blocked' | 'bypassed' | 'notified'
): Promise<BoundaryViolation> {
  const { data, error } = await supabase
    .from('boundary_violations')
    .insert({
      boundary_id: boundaryId,
      user_id: userId,
      url,
      domain,
      action,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function getViolations(
  userId: string,
  since?: Date
): Promise<BoundaryViolation[]> {
  let query = supabase
    .from('boundary_violations')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })

  if (since) {
    query = query.gte('timestamp', since.toISOString())
  }

  const { data, error } = await query.limit(500)

  if (error) throw new Error(error.message)
  return data ?? []
}

export interface BoundaryStatsResult {
  boundary_id: string
  blocks_today: number
  blocks_this_week: number
  bypasses_today: number
  bypasses_this_week: number
  respect_rate: number
}

export async function getBoundaryStats(
  userId: string,
  boundaryId?: string
): Promise<BoundaryStatsResult[]> {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(startOfDay)
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())

  let query = supabase
    .from('boundary_violations')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', startOfWeek.toISOString())

  if (boundaryId) {
    query = query.eq('boundary_id', boundaryId)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  // Group by boundary_id and calculate stats
  const statsByBoundary = new Map<string, BoundaryStatsResult>()

  for (const v of data ?? []) {
    if (!statsByBoundary.has(v.boundary_id)) {
      statsByBoundary.set(v.boundary_id, {
        boundary_id: v.boundary_id,
        blocks_today: 0,
        blocks_this_week: 0,
        bypasses_today: 0,
        bypasses_this_week: 0,
        respect_rate: 100,
      })
    }

    const stats = statsByBoundary.get(v.boundary_id)!
    const timestamp = new Date(v.timestamp)
    const isToday = timestamp >= startOfDay

    if (v.action === 'blocked' || v.action === 'notified') {
      stats.blocks_this_week++
      if (isToday) stats.blocks_today++
    } else if (v.action === 'bypassed') {
      stats.bypasses_this_week++
      if (isToday) stats.bypasses_today++
    }
  }

  // Calculate respect rate
  for (const stats of statsByBoundary.values()) {
    const total = stats.blocks_this_week + stats.bypasses_this_week
    if (total > 0) {
      stats.respect_rate = Math.round((stats.blocks_this_week / total) * 100)
    }
  }

  return Array.from(statsByBoundary.values())
}
