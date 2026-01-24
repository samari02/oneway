import { useState, useEffect, useCallback, useTransition } from 'react'
import { invoke } from '@tauri-apps/api/core'

export interface AppUsageStat {
  bundle_id: string
  app_name: string
  total_time_ms: number
  percentage: number
}

export interface AppUsageStats {
  apps: AppUsageStat[]
  total_time_ms: number
  days_count: number
}

interface UseAppUsageResult {
  stats: AppUsageStats
  loading: boolean
  error: Error | null
  refetch: () => void
}

const defaultStats: AppUsageStats = {
  apps: [],
  total_time_ms: 0,
  days_count: 0,
}

export function useAppUsage(period: string = 'today'): UseAppUsageResult {
  const [stats, setStats] = useState<AppUsageStats>(defaultStats)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true)
      const data = await invoke<AppUsageStats>('get_app_usage_stats', { period })
      setStats(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to fetch app usage'))
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchStats()
    
    // Refresh every minute to update stats
    const interval = setInterval(fetchStats, 60000)
    return () => clearInterval(interval)
  }, [fetchStats])

  return { stats, loading, error, refetch: fetchStats }
}

// Hook to get list of running apps - lazy loaded with transitions
export function useRunningApps(enabled: boolean = true) {
  const [apps, setApps] = useState<Array<[string, string]>>([])
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()

  const fetchApps = useCallback(async () => {
    if (!enabled) return
    
    setLoading(true)
    try {
      const runningApps = await invoke<Array<[string, string]>>('get_running_apps')
      startTransition(() => {
        setApps(runningApps)
        setHasLoaded(true)
      })
    } catch (e) {
      console.error('Failed to fetch running apps:', e)
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    
    // Delay initial fetch to let the UI render first
    const timeout = setTimeout(fetchApps, 300)
    
    // Refresh every 60 seconds (not too frequent)
    const interval = setInterval(fetchApps, 60000)
    
    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [fetchApps, enabled])

  return { apps, loading: loading || isPending, hasLoaded, refetch: fetchApps }
}

// Format milliseconds as human-readable duration
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }
  
  if (minutes > 0) {
    return `${minutes}m`
  }
  
  return `${seconds}s`
}
