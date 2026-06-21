import { useMemo, useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAuth } from '../../auth'
import { inferBlockingRuleType, normalizeUrlBlockingValue } from '../../boundaries/api/customBlockingRules'
import { useCustomBlockingRules } from '../../boundaries/hooks/useCustomBlockingRules'
import { useBrowsingStatsWithOverride } from '../hooks/useBrowsingStatsWithOverride'
import { useCardPeriods } from '../hooks/useCardPeriods'
import { useAppUsage, formatDuration } from '../../app-blocking/hooks/useAppUsage'
import { mapCategory } from '../hooks/useBrowsingStats'
import { FocusScoreCard } from './FocusScoreCard'
import { TopSitesCard } from './TopSitesCard'
import type { Period } from './PeriodSelector'
import type { SiteVisit } from '../hooks/useBrowsingStats'
import type { SiteCategory } from './SiteClassificationModal'
import './OverviewTab.css'

const BLOCK_RULE_MIN_LEN = 3

interface OverviewTabProps {
  period: Period
  resetTrigger?: number
}

// Map period to app usage period string (must match Rust backend)
function mapPeriodToAppUsage(period: Period): string {
  switch (period) {
    case 'today': return 'today'
    case '7days': return '7days'
    case '30days': return '30days'
    case '90days': return '90days'
    case '180days': return '90days'
    case '365days': return 'all'
    case 'all': return 'all'
    default: return 'today'
  }
}

// Format period to display label
function getPeriodLabel(period: Period): string {
  switch (period) {
    case 'today': return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    case '7days': return 'Last 7 days'
    case '30days': return 'Last 30 days'
    case '90days': return 'Last 90 days'
    case '180days': return 'Last 180 days'
    case '365days': return 'Last year'
    case 'all': return 'All time'
    default: return 'Today'
  }
}

export function OverviewTab({ period, resetTrigger = 0 }: OverviewTabProps) {
  const { user } = useAuth()
  const { rules: blockingRules, createRule, updateRule } = useCustomBlockingRules(user?.id)
  const { getEffectivePeriod, setCardPeriod, resetAllOverrides } = useCardPeriods(period)
  
  // Reset all card overrides when global period is clicked
  useEffect(() => {
    if (resetTrigger > 0) {
      resetAllOverrides()
    }
  }, [resetTrigger, resetAllOverrides])
  
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
  
  // Handle classification save (web sites only)
  const handleClassificationSave = useCallback(async (classifications: Record<string, SiteCategory>) => {
    if (Object.keys(classifications).length === 0) return
    
    try {
      await invoke('save_site_classifications', { classifications })
      refetch()
    } catch (e) {
      console.error('[OverviewTab] Failed to save classification:', e)
    }
  }, [refetch])

  const handleAddDomainToBlockList = useCallback(
    async (domain: string) => {
      if (!user?.id) {
        throw new Error('Sign in to add sites to your block list.')
      }
      const raw = domain.trim()
      const mode = inferBlockingRuleType(raw)
      if (mode === 'url_contains') {
        const value = normalizeUrlBlockingValue(raw)
        if (value.length < BLOCK_RULE_MIN_LEN) {
          throw new Error(`Use at least ${BLOCK_RULE_MIN_LEN} characters in the domain.`)
        }
        const lower = value.toLowerCase()
        const existing = blockingRules.find(
          (r) =>
            r.rule_type === 'url_contains' &&
            normalizeUrlBlockingValue(r.value).toLowerCase() === lower
        )
        if (existing) {
          if (existing.is_active) {
            throw new Error('That site is already on your block list.')
          }
          await updateRule(existing.id, { is_active: true })
          return
        }
        await createRule({
          user_id: user.id,
          rule_type: 'url_contains',
          value,
          note: 'From Screen Time',
        })
        return
      }
      const value = raw.toLowerCase()
      if (value.length < BLOCK_RULE_MIN_LEN) {
        throw new Error(`Use at least ${BLOCK_RULE_MIN_LEN} characters.`)
      }
      const existing = blockingRules.find(
        (r) => r.rule_type === 'search_contains' && r.value.toLowerCase() === value
      )
      if (existing) {
        if (existing.is_active) {
          throw new Error('That keyword is already on your block list.')
        }
        await updateRule(existing.id, { is_active: true })
        return
      }
      await createRule({
        user_id: user.id,
        rule_type: 'search_contains',
        value,
        note: 'From Screen Time',
      })
    },
    [user?.id, blockingRules, createRule, updateRule]
  )
  
  const loading = browsingLoading || appLoading
  
  // Web-only sites for summary top sites card
  const webSites = useMemo<SiteVisit[]>(() => {
    return (cardStats.topSites?.topSites || []).map(site => ({
      domain: site.domain,
      visits: site.visits,
      timeSpent: site.timeSpent,
      category: mapCategory(site.category),
      source: 'web' as const,
    }))
  }, [cardStats.topSites])
  
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
  
  const hasData = totalTimeMs > 0 || webSites.length > 0
  
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
        
        {/* Top Sites (web only — apps live in Apps tab) */}
        {webSites.length > 0 && (
          <TopSitesCard 
            sites={webSites}
            period={getEffectivePeriod('top-sites')}
            defaultPeriod={period}
            onPeriodChange={(p) => setCardPeriod('top-sites', p)}
            onClassificationSave={handleClassificationSave}
            onSiteDataDeleted={refetch}
            onAddDomainToBlockList={user?.id ? handleAddDomainToBlockList : undefined}
            blockingRules={blockingRules}
          />
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
