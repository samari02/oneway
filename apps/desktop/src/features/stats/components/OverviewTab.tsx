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
  
  // Get top distractions from both sources
  const topBrowsingSites = browsingStats?.topSites?.slice(0, 3) || []
  const topApps = appStats.apps.slice(0, 3)
  
  // Combine and sort by time
  const allDistractions = [
    ...topBrowsingSites.map(site => ({
      name: site.domain,
      timeMs: site.timeSpent * 60 * 1000, // Convert minutes to ms
      type: 'web' as const,
      category: site.category,
    })),
    ...topApps.map(app => ({
      name: app.app_name,
      timeMs: app.total_time_ms,
      type: 'app' as const,
      category: 'app',
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
            <span className="overview-tab__total-label">Total Screen Time</span>
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
          
          {/* Focus Score */}
          {focusStats && (
            <FocusScoreCard 
              score={focusStats.focusScore} 
              trend={focusStats.focusTrend as 'up' | 'down' | 'stable'}
              period={period}
              defaultPeriod={period}
              onPeriodChange={() => {}}
              compact
            />
          )}
        </section>
        
        {/* Top Activity */}
        {allDistractions.length > 0 && (
          <section className="overview-tab__section">
            <h3 className="overview-tab__section-title">Top Activity</h3>
            <div className="overview-tab__activity-list">
              {allDistractions.map((item, index) => (
                <div key={`${item.type}-${item.name}`} className="overview-tab__activity-item">
                  <span className="overview-tab__activity-rank">{index + 1}</span>
                  <span className="overview-tab__activity-type">
                    {item.type === 'web' ? '🌐' : '📱'}
                  </span>
                  <span className="overview-tab__activity-name">{item.name}</span>
                  <span className="overview-tab__activity-time">{formatDuration(item.timeMs)}</span>
                </div>
              ))}
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
