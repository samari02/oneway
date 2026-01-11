import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

export interface SiteVisit {
  domain: string
  visits: number
  timeSpent: number // in minutes
  category: 'productive' | 'neutral' | 'distraction'
}

export interface DailyFocusScore {
  date: string
  score: number // 0-100
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
    })),
    dailyScores: rust.dailyScores,
    totalVisits: rust.totalVisits,
    totalTimeTracked: rust.totalTimeTracked,
  }
}

export function useBrowsingStats(userId?: string) {
  const [stats, setStats] = useState<BrowsingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      setError(null)

      try {
        // Call Rust backend via Tauri
        const rustStats = await invoke<RustBrowsingStats>('get_browsing_stats')
        
        // Transform to frontend format
        const transformedStats = transformStats(rustStats)
        
        // Check if we have any data
        if (transformedStats.totalVisits === 0) {
          // No data yet - could show empty state or mock data
          console.log('[useBrowsingStats] No data from extension yet')
        }
        
        setStats(transformedStats)
      } catch (err) {
        console.error('[useBrowsingStats] Error fetching stats:', err)
        setError(err instanceof Error ? err : new Error('Failed to fetch browsing stats'))
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    
    // Refresh every 30 seconds to pick up new data
    const interval = setInterval(fetchStats, 30000)
    
    return () => clearInterval(interval)
  }, [userId])

  return { stats, loading, error }
}
