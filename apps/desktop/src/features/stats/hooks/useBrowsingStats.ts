import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

export interface SiteVisit {
  domain: string
  visits: number
  timeSpent: number // in minutes
  category: 'productive' | 'neutral' | 'distraction'
  source: 'web' | 'app'
  bundleId?: string // For apps only
  iconData?: string // Base64 icon data for apps
}

export interface DailyFocusScore {
  date: string
  score: number // 0-100
}

export interface DataSourceMeta {
  isConnected: boolean
  totalVisits: number
  periodStart?: string
  periodEnd?: string
  lastSync?: string
}

export interface BrowsingStats {
  focusScore: number
  focusTrend: 'up' | 'down' | 'stable'
  timeDistribution: {
    productive: number // percentage
    neutral: number
    distraction: number
  }
  topSites: SiteVisit[]
  dailyScores: DailyFocusScore[]
  totalVisits: number
  totalTimeTracked: number // in minutes
  dataSource: DataSourceMeta
}

// Response from Rust (matches BrowsingStats struct)
interface RustBrowsingStats {
  focusScore: number
  focusTrend: string
  timeDistribution: {
    productive: number
    neutral: number
    distraction: number
  }
  topSites: Array<{
    domain: string
    visits: number
    timeSpent: number
    category: string
  }>
  dailyScores: Array<{
    date: string
    score: number
  }>
  totalVisits: number
  totalTimeTracked: number
  // Data source metadata
  periodStart?: string
  periodEnd?: string
  lastSync?: string
}

// Map Rust category to frontend category
function mapCategory(category: string): 'productive' | 'neutral' | 'distraction' {
  switch (category) {
    case 'work':
    case 'dev':
    case 'productivity':
      return 'productive'
    case 'social_media':
    case 'video':
    case 'entertainment':
    case 'news':
    case 'shopping':
      return 'distraction'
    default:
      return 'neutral'
  }
}

// Transform Rust response to frontend format
function transformStats(rust: RustBrowsingStats): BrowsingStats {
  return {
    focusScore: rust.focusScore,
    focusTrend: (rust.focusTrend as 'up' | 'down' | 'stable') || 'stable',
    timeDistribution: rust.timeDistribution,
    topSites: rust.topSites.map(site => ({
      domain: site.domain,
      visits: site.visits,
      timeSpent: site.timeSpent,
      category: mapCategory(site.category),
      source: 'web' as const,
    })),
    dailyScores: rust.dailyScores,
    totalVisits: rust.totalVisits,
    totalTimeTracked: rust.totalTimeTracked,
    dataSource: {
      isConnected: rust.totalVisits > 0,
      totalVisits: rust.totalVisits,
      periodStart: rust.periodStart,
      periodEnd: rust.periodEnd,
      lastSync: rust.lastSync,
    },
  }
}

export function useBrowsingStats(userId?: string, period?: string) {
  const [stats, setStats] = useState<BrowsingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // showLoading: true for initial load, false for background refresh
  async function fetchStats(showLoading = true) {
    if (showLoading) {
      setLoading(true)
    }
    setError(null)

    try {
      // Call Rust backend via Tauri with period filter
      const rustStats = await invoke<RustBrowsingStats>('get_browsing_stats', {
        period: period || 'all'
      })
      
      // Transform to frontend format
      const transformedStats = transformStats(rustStats)
      
      setStats(transformedStats)
    } catch (err) {
      console.error('[useBrowsingStats] Error fetching stats:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch browsing stats'))
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    // Initial fetch with loading indicator
    fetchStats(true)
    
    // Background refresh every 60 seconds (silent, no loading state)
    const interval = setInterval(() => fetchStats(false), 60000)
    
    return () => clearInterval(interval)
  }, [userId, period])

  // Expose refetch for manual refresh
  const refetch = async () => {
    await fetchStats()
  }

  return { stats, loading, error, refetch }
}
