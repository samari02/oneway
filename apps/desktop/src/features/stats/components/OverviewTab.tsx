import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAuth } from '../../auth'
import { useBrowsingStatsWithOverride } from '../hooks/useBrowsingStatsWithOverride'
import { useAppUsage, formatDuration } from '../../app-blocking/hooks/useAppUsage'
import { FocusScoreCard } from './FocusScoreCard'
import type { Period } from './PeriodSelector'
import './OverviewTab.css'

interface OverviewTabProps {
  period: Period
  resetTrigger?: number
}

// Hook to fetch and cache app icons
function useAppIcons() {
  const [icons, setIcons] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState<Set<string>>(new Set())

  const fetchIcon = useCallback(async (bundleId: string) => {
    if (bundleId in icons || loading.has(bundleId)) return
    
    setLoading(prev => new Set(prev).add(bundleId))
    
    try {
      const iconData = await invoke<string | null>('get_app_icon', { bundleId })
      setIcons(prev => ({ ...prev, [bundleId]: iconData }))
    } catch {
      setIcons(prev => ({ ...prev, [bundleId]: null }))
    } finally {
      setLoading(prev => {
        const next = new Set(prev)
        next.delete(bundleId)
        return next
      })
    }
  }, [icons, loading])

  return { icons, fetchIcon }
}

// Map period to app usage period string
function mapPeriodToAppUsage(period: Period): string {
  switch (period) {
    case 'today': return 'today'
    case '7d': return '7d'
    case '30d': return '30d'
    case 'all': return 'all'
    default: return 'today'
  }
}

// Format period to display label
function getPeriodLabel(period: Period): string {
  switch (period) {
    case 'today': return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    case '7d': return 'Last 7 days'
    case '30d': return 'Last 30 days'
    case 'all': return 'All time'
    default: return 'Today'
  }
}

export function OverviewTab({ period, resetTrigger = 0 }: OverviewTabProps) {
  const { user } = useAuth()
  
  // Browsing stats
  const { cardStats, loading: browsingLoading } = useBrowsingStatsWithOverride(
    user?.id,
    period,
    {
      'focus-score': period,
      'time-distribution': period,
      'top-sites': period,
      'heatmap': period,
    }
  )
  
  // App usage stats
  const { stats: appStats, loading: appLoading } = useAppUsage(mapPeriodToAppUsage(period))
  
  const loading = browsingLoading || appLoading
  
  if (loading) {
    return (
      <div className="overview-tab">
        <div className="overview-tab__loading">
          <div className="overview-tab__loading-spinner" />
          <p>Loading your screen time...</p>
        </div>
      </div>
    )
  }
  
  const browsingStats = cardStats.timeDistribution
  const focusStats = cardStats.focusScore
  
  // Calculate totals
  const browsingTimeMs = browsingStats?.totalTimeTracked 
    ? browsingStats.totalTimeTracked * 60 * 1000 // Convert minutes to ms
    : 0
  const appTimeMs = appStats.total_time_ms || 0
  const totalTimeMs = browsingTimeMs + appTimeMs
  
  // App icons
  const { icons, fetchIcon } = useAppIcons()
  
  // Get top distractions from both sources
  const topBrowsingSites = browsingStats?.topSites?.slice(0, 3) || []
  const topApps = appStats.apps.slice(0, 3)
  
  // Fetch icons for apps
  useEffect(() => {
    topApps.forEach(app => fetchIcon(app.bundle_id))
  }, [topApps, fetchIcon])
  
  // Combine and sort by time
  const allDistractions = [
    ...topBrowsingSites.map(site => ({
      name: site.domain,
      timeMs: site.timeSpent * 60 * 1000, // Convert minutes to ms
      type: 'web' as const,
      category: site.category,
      bundleId: null as string | null,
    })),
    ...topApps.map(app => ({
      name: app.app_name,
      timeMs: app.total_time_ms,
      type: 'app' as const,
      category: 'app',
      bundleId: app.bundle_id,
    })),
  ].sort((a, b) => b.timeMs - a.timeMs).slice(0, 5)
  
  const hasData = totalTimeMs > 0 || allDistractions.length > 0
  
  if (!hasData) {
    return (
      <div className="overview-tab">
        <div className="overview-tab__empty">
          <div className="overview-tab__empty-icon">📊</div>
          <h3>No data yet</h3>
          <p>Install the extension and enable app tracking to see your screen time</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="overview-tab">
      <div className="overview-tab__content">
        {/* Total Screen Time Hero */}
        <section className="overview-tab__hero">
          <div className="overview-tab__total-card">
            <div className="overview-tab__total-header">
              <span className="overview-tab__total-label">Total Screen Time</span>
              <span className="overview-tab__total-period">{getPeriodLabel(period)}</span>
            </div>
            <span className="overview-tab__total-value">{formatDuration(totalTimeMs)}</span>
            <div className="overview-tab__total-breakdown">
              <span className="overview-tab__breakdown-item">
                <span className="overview-tab__breakdown-icon">🌐</span>
                <span>Browsing: {formatDuration(browsingTimeMs)}</span>
              </span>
              <span className="overview-tab__breakdown-item">
                <span className="overview-tab__breakdown-icon">📱</span>
                <span>Apps: {formatDuration(appTimeMs)}</span>
              </span>
            </div>
          </div>
          
          {/* Focus Score with Mascot */}
          {focusStats && (
            <FocusScoreCard 
              score={focusStats.focusScore} 
              trend={focusStats.focusTrend as 'up' | 'down' | 'stable'}
              period={period}
              defaultPeriod={period}
              onPeriodChange={() => {}}
            />
          )}
        </section>
        
        {/* Top Activity */}
        {allDistractions.length > 0 && (
          <section className="overview-tab__section">
            <h3 className="overview-tab__section-title">Top Activity</h3>
            <div className="overview-tab__activity-list">
              {allDistractions.map((item, index) => {
                const appIcon = item.bundleId ? icons[item.bundleId] : null
                return (
                  <div key={`${item.type}-${item.name}`} className="overview-tab__activity-item">
                    <span className="overview-tab__activity-rank">{index + 1}</span>
                    <span className="overview-tab__activity-icon">
                      {item.type === 'web' ? (
                        '🌐'
                      ) : appIcon ? (
                        <img src={appIcon} alt="" className="overview-tab__app-icon-img" />
                      ) : (
                        '📱'
                      )}
                    </span>
                    <span className="overview-tab__activity-name">{item.name}</span>
                    <span className="overview-tab__activity-time">{formatDuration(item.timeMs)}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}
        
        {/* Quick Stats Grid */}
        <section className="overview-tab__section">
          <h3 className="overview-tab__section-title">Quick Stats</h3>
          <div className="overview-tab__stats-grid">
            <div className="overview-tab__stat-card">
              <span className="overview-tab__stat-icon">🌐</span>
              <span className="overview-tab__stat-value">{browsingStats?.topSites?.length || 0}</span>
              <span className="overview-tab__stat-label">Sites visited</span>
            </div>
            <div className="overview-tab__stat-card">
              <span className="overview-tab__stat-icon">📱</span>
              <span className="overview-tab__stat-value">{appStats.apps.length}</span>
              <span className="overview-tab__stat-label">Apps used</span>
            </div>
            <div className="overview-tab__stat-card">
              <span className="overview-tab__stat-icon">🎯</span>
              <span className="overview-tab__stat-value">{focusStats?.focusScore || 0}%</span>
              <span className="overview-tab__stat-label">Focus score</span>
            </div>
            <div className="overview-tab__stat-card">
              <span className="overview-tab__stat-icon">⏱️</span>
              <span className="overview-tab__stat-value">
                {browsingTimeMs > appTimeMs ? 'Web' : 'Apps'}
              </span>
              <span className="overview-tab__stat-label">Most time on</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
