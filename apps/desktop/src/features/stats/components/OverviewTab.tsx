import { useMemo, useCallback, useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAuth } from '../../auth'
import { useBrowsingStatsWithOverride } from '../hooks/useBrowsingStatsWithOverride'
import { useCardPeriods } from '../hooks/useCardPeriods'
import { useAppUsage, formatDuration } from '../../app-blocking/hooks/useAppUsage'
import { FocusScoreCard } from './FocusScoreCard'
import { TopSitesCard } from './TopSitesCard'
import type { Period } from './PeriodSelector'
import type { SiteVisit } from '../hooks/useBrowsingStats'
import type { SiteCategory } from './SiteClassificationModal'
import './OverviewTab.css'

interface OverviewTabProps {
  period: Period
  resetTrigger?: number
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
  const { getEffectivePeriod, setCardPeriod, resetAllOverrides } = useCardPeriods(period)
  
  // Reset all card overrides when global period is clicked
  useEffect(() => {
    if (resetTrigger > 0) {
      resetAllOverrides()
    }
  }, [resetTrigger, resetAllOverrides])
  
  // App classifications (stored locally, same system as web sites)
  const [appClassifications, setAppClassifications] = useState<Record<string, SiteCategory>>({})
  
  // Load existing classifications on mount (includes both web and app)
  useEffect(() => {
    invoke<Record<string, string>>('get_site_classifications')
      .then(classifications => {
        const validClassifications: Record<string, SiteCategory> = {}
        Object.entries(classifications).forEach(([key, value]) => {
          if (value === 'productive' || value === 'neutral' || value === 'distraction') {
            validClassifications[key] = value
          }
        })
        setAppClassifications(validClassifications)
      })
      .catch(() => {})
  }, [])
  
  // Browsing stats - must be before handleClassificationSave so refetch is available
  const { cardStats, loading: browsingLoading, refetch } = useBrowsingStatsWithOverride(
    user?.id,
    period,
    {
      'focus-score': period,
      'time-distribution': period,
      'top-sites': getEffectivePeriod('top-sites'),
      'heatmap': period,
    }
  )
  
  // App usage stats - use top-sites effective period for unified view
  const { stats: appStats, loading: appLoading } = useAppUsage(mapPeriodToAppUsage(getEffectivePeriod('top-sites')))
  
  // Handle classification save (for both web sites and apps)
  const handleClassificationSave = useCallback(async (classifications: Record<string, SiteCategory>) => {
    if (Object.keys(classifications).length === 0) return
    
    try {
      await invoke('save_site_classifications', { classifications })
      // Update local app classifications state immediately for instant UI feedback
      setAppClassifications(prev => ({ ...prev, ...classifications }))
      // Refetch to update web sites with new classifications
      refetch()
    } catch (e) {
      console.error('[OverviewTab] Failed to save classification:', e)
    }
  }, [refetch])
  
  const loading = browsingLoading || appLoading
  
  // Combine web sites and apps into a unified list
  const allSites = useMemo<SiteVisit[]>(() => {
    const webSites: SiteVisit[] = (cardStats.topSites?.topSites || []).map(site => ({
      ...site,
      source: 'web' as const,
    }))
    
    const appSites: SiteVisit[] = appStats.apps.map(app => ({
      domain: app.app_name,
      visits: 1, // Apps don't track visits the same way
      timeSpent: Math.round(app.total_time_ms / 60000), // Convert ms to minutes
      category: appClassifications[app.app_name] || 'neutral', // Use saved classification or default
      source: 'app' as const,
      bundleId: app.bundle_id,
    }))
    
    // Sort by time spent descending
    return [...webSites, ...appSites].sort((a, b) => b.timeSpent - a.timeSpent)
  }, [cardStats.topSites, appStats.apps, appClassifications])
  
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
  
  const hasData = totalTimeMs > 0 || allSites.length > 0
  
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
        
        {/* Top Sites (Web + Apps unified) */}
        <TopSitesCard 
          sites={allSites}
          period={getEffectivePeriod('top-sites')}
          defaultPeriod={period}
          onPeriodChange={(p) => setCardPeriod('top-sites', p)}
          showSourceFilter={true}
          onClassificationSave={handleClassificationSave}
          onSiteDataDeleted={refetch}
        />
        
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
