import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Period } from '../components/PeriodSelector'

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
  periodStart?: string
  periodEnd?: string
  lastSync?: string
}

interface CardStats {
  focusScore?: RustBrowsingStats
  timeDistribution?: RustBrowsingStats
  topSites?: RustBrowsingStats
  heatmap?: RustBrowsingStats
}

export function useBrowsingStatsWithOverride(
  userId: string | undefined,
  defaultPeriod: Period,
  cardPeriods: {
    'focus-score': Period
    'time-distribution': Period
    'top-sites': Period
    'heatmap': Period
  }
) {
  const [cardStats, setCardStats] = useState<CardStats>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  // showLoading: true for initial load, false for period changes/background refresh
  async function fetchAllCardStats(showLoading = true) {
    if (showLoading) {
      setLoading(true)
    }
    setError(null)

    try {
      // Fetch stats for each card with its own period
      const [focusScore, timeDistribution, topSites, heatmap] = await Promise.all([
        invoke<RustBrowsingStats>('get_browsing_stats', {
          period: cardPeriods['focus-score'] || 'all'
        }),
        invoke<RustBrowsingStats>('get_browsing_stats', {
          period: cardPeriods['time-distribution'] || 'all'
        }),
        invoke<RustBrowsingStats>('get_browsing_stats', {
          period: cardPeriods['top-sites'] || 'all'
        }),
        invoke<RustBrowsingStats>('get_browsing_stats', {
          period: cardPeriods['heatmap'] || 'all'
        }),
      ])

      setCardStats({
        focusScore,
        timeDistribution,
        topSites,
        heatmap,
      })
    } catch (err) {
      console.error('[useBrowsingStatsWithOverride] Error fetching stats:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch browsing stats'))
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    if (!userId) return

    // Only show loading on initial load, not on period changes
    const shouldShowLoading = isInitialLoad
    fetchAllCardStats(shouldShowLoading)
    
    if (isInitialLoad) {
      setIsInitialLoad(false)
    }

    // Background refresh every 60 seconds (silent, no loading state)
    const interval = setInterval(() => fetchAllCardStats(false), 60000)

    return () => clearInterval(interval)
  }, [
    userId,
    cardPeriods['focus-score'],
    cardPeriods['time-distribution'],
    cardPeriods['top-sites'],
    cardPeriods['heatmap'],
  ])

  const refetch = async () => {
    // Don't show loading on refetch to avoid UI glitch and unmounting components
    await fetchAllCardStats(false)
  }

  return { cardStats, loading, error, refetch }
}
