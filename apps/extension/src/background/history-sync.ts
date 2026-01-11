/**
 * History Sync Module
 * 
 * Syncs navigation history from chrome.storage.local to Supabase.
 * Privacy-first: Only domains synced, protected by RLS.
 */

import { supabase, getCurrentUser, isAuthenticated } from '../lib/supabase'
import { log } from '../shared/utils'
import type { CategorizedVisit } from '../shared/types'

// Sync status
interface SyncStatus {
  lastSync: number | null
  totalSynced: number
  pendingCount: number
  isAuthenticated: boolean
  error?: string
}

/**
 * Sync navigation history to Supabase
 * Only syncs visits that haven't been synced yet
 */
export async function syncHistoryToSupabase(): Promise<{ success: boolean; synced: number; error?: string }> {
  log('Starting history sync to Supabase...')
  
  // Check authentication
  const user = await getCurrentUser()
  if (!user) {
    log('User not authenticated, skipping sync')
    return { success: false, synced: 0, error: 'Not authenticated' }
  }
  
  try {
    // Get local history
    const { navigationHistory = [], lastSupabaseSync = 0 } = await chrome.storage.local.get([
      'navigationHistory',
      'lastSupabaseSync'
    ])
    
    // Filter visits that need to be synced (after last sync)
    const visitsToSync = (navigationHistory as CategorizedVisit[]).filter(
      visit => visit.visitTime > lastSupabaseSync
    )
    
    if (visitsToSync.length === 0) {
      log('No new visits to sync')
      return { success: true, synced: 0 }
    }
    
    log(`Syncing ${visitsToSync.length} visits to Supabase...`)
    
    // Transform to Supabase format
    const records = visitsToSync.map(visit => ({
      user_id: user.id,
      domain: visit.domain,
      category: visit.category,
      is_distraction: visit.isDistraction,
      visit_time: new Date(visit.visitTime).toISOString(),
      title: visit.title?.slice(0, 200), // Ensure max length
      source: 'extension'
    }))
    
    // Batch insert (Supabase handles duplicates via upsert if needed)
    const { error } = await supabase
      .from('navigation_history')
      .insert(records)
    
    if (error) {
      log('Error syncing to Supabase:', error)
      return { success: false, synced: 0, error: error.message }
    }
    
    // Update last sync timestamp
    const now = Date.now()
    await chrome.storage.local.set({ lastSupabaseSync: now })
    
    log(`Successfully synced ${visitsToSync.length} visits`)
    return { success: true, synced: visitsToSync.length }
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    log('Sync error:', message)
    return { success: false, synced: 0, error: message }
  }
}

/**
 * Get sync status
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const authenticated = await isAuthenticated()
  const { navigationHistory = [], lastSupabaseSync = null } = await chrome.storage.local.get([
    'navigationHistory',
    'lastSupabaseSync'
  ])
  
  const pendingCount = lastSupabaseSync
    ? (navigationHistory as CategorizedVisit[]).filter(v => v.visitTime > lastSupabaseSync).length
    : navigationHistory.length
  
  return {
    lastSync: lastSupabaseSync,
    totalSynced: navigationHistory.length - pendingCount,
    pendingCount,
    isAuthenticated: authenticated
  }
}

/**
 * Clear synced data from local storage (keep only recent)
 * Called periodically to prevent storage bloat
 */
export async function cleanupSyncedHistory(): Promise<void> {
  const { navigationHistory = [], lastSupabaseSync = 0 } = await chrome.storage.local.get([
    'navigationHistory',
    'lastSupabaseSync'
  ])
  
  if (!lastSupabaseSync) return
  
  // Keep only last 7 days of synced data locally
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
  const cutoff = Math.max(sevenDaysAgo, lastSupabaseSync)
  
  const recentHistory = (navigationHistory as CategorizedVisit[]).filter(
    visit => visit.visitTime > cutoff
  )
  
  if (recentHistory.length < navigationHistory.length) {
    log(`Cleaning up ${navigationHistory.length - recentHistory.length} old synced visits`)
    await chrome.storage.local.set({ navigationHistory: recentHistory })
  }
}

/**
 * Fetch stats from Supabase (for dashboard)
 */
export async function fetchStatsFromSupabase(days: number = 30): Promise<{
  totalVisits: number
  byCategory: Record<string, number>
  topDomains: Array<{ domain: string; count: number; category: string }>
} | null> {
  const user = await getCurrentUser()
  if (!user) return null
  
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  
  try {
    // Get total visits
    const { count: totalVisits } = await supabase
      .from('navigation_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('visit_time', startDate)
    
    // Get visits by category
    const { data: categoryData } = await supabase
      .from('navigation_history')
      .select('category')
      .eq('user_id', user.id)
      .gte('visit_time', startDate)
    
    const byCategory: Record<string, number> = {}
    categoryData?.forEach(row => {
      byCategory[row.category] = (byCategory[row.category] || 0) + 1
    })
    
    // Get top domains (using RPC or manual aggregation)
    const { data: domainData } = await supabase
      .from('navigation_history')
      .select('domain, category')
      .eq('user_id', user.id)
      .gte('visit_time', startDate)
    
    const domainCounts = new Map<string, { count: number; category: string }>()
    domainData?.forEach(row => {
      const existing = domainCounts.get(row.domain)
      if (existing) {
        existing.count++
      } else {
        domainCounts.set(row.domain, { count: 1, category: row.category })
      }
    })
    
    const topDomains = Array.from(domainCounts.entries())
      .map(([domain, data]) => ({ domain, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
    
    return {
      totalVisits: totalVisits || 0,
      byCategory,
      topDomains
    }
    
  } catch (error) {
    log('Error fetching stats from Supabase:', error)
    return null
  }
}
