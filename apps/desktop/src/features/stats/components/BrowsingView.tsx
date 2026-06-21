import { useEffect, useMemo, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAuth } from '../../auth'
import { inferBlockingRuleType, normalizeUrlBlockingValue } from '../../boundaries/api/customBlockingRules'
import { useCustomBlockingRules } from '../../boundaries/hooks/useCustomBlockingRules'
import { useBrowsingStatsWithOverride } from '../hooks/useBrowsingStatsWithOverride'
import { useCardPeriods } from '../hooks/useCardPeriods'
import { mapCategory } from '../hooks/useBrowsingStats'
import type { SiteVisit } from '../hooks/useBrowsingStats'
import { DistractionHeroCard } from './DistractionHeroCard'
import { TopDistractionsCard } from './TopDistractionsCard'
import { TopSitesCard } from './TopSitesCard'
import { TimeDistributionCard } from './TimeDistributionCard'
import { BrowsingHeatmapCard } from './BrowsingHeatmapCard'
import { DataSourceCard } from './DataSourceCard'
import type { Period } from './PeriodSelector'
import type { SiteCategory } from './SiteClassificationModal'
import './BrowsingView.css'

const BLOCK_RULE_MIN_LEN = 3

// Map Rust category to check if distraction
function isDistraction(category: string): boolean {
  return ['distraction', 'social_media', 'video', 'entertainment', 'news', 'shopping'].includes(category)
}

interface BrowsingViewProps {
  period: Period
  resetTrigger?: number
}

export function BrowsingView({ period, resetTrigger = 0 }: BrowsingViewProps) {
  const { user } = useAuth()
  const { rules: blockingRules, createRule, updateRule } = useCustomBlockingRules(user?.id)
  const { getEffectivePeriod, setCardPeriod, resetAllOverrides } = useCardPeriods(period)
  
  // Reset all card overrides when global period is clicked
  useEffect(() => {
    if (resetTrigger > 0) {
      resetAllOverrides()
    }
  }, [resetTrigger, resetAllOverrides])
  
  // Get effective periods for cards
  const cardPeriods = {
    'focus-score': period,
    'time-distribution': getEffectivePeriod('time-distribution'),
    'top-sites': getEffectivePeriod('top-sites'),
    'heatmap': getEffectivePeriod('heatmap'),
  }
  
  const { cardStats, loading, error, refetch } = useBrowsingStatsWithOverride(
    user?.id,
    period,
    cardPeriods
  )

  const handleClassificationSave = useCallback(async (classifications: Record<string, SiteCategory>) => {
    if (Object.keys(classifications).length === 0) return
    try {
      await invoke('save_site_classifications', { classifications })
      refetch()
    } catch (e) {
      console.error('[BrowsingView] Failed to save classification:', e)
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

  // All visited sites for the All Visited Sites card
  const allVisitedSites = useMemo<SiteVisit[]>(() => {
    return (cardStats.topSites?.topSites || []).map(site => ({
      domain: site.domain,
      visits: site.visits,
      timeSpent: site.timeSpent,
      category: mapCategory(site.category),
      source: 'web' as const,
    }))
  }, [cardStats.topSites])

  // Get distraction sites for TopDistractionsCard (must be before early returns)
  const distractionSites = useMemo(() => {
    const topSites = cardStats.timeDistribution?.topSites || []
    return topSites
      .filter(site => isDistraction(site.category))
      .map(site => ({
        domain: site.domain,
        timeSpent: site.timeSpent,
        source: 'web' as const,
      }))
  }, [cardStats.timeDistribution])
  
  // Projection data: always based on ALL available data for accurate yearly estimates
  const projectionData = useMemo(() => {
    const allTimeSites = cardStats.allTime?.topSites || []
    const periodStart = cardStats.allTime?.periodStart
    const periodEnd = cardStats.allTime?.periodEnd
    
    let totalDays = 30
    if (periodStart && periodEnd) {
      const start = new Date(periodStart)
      const end = new Date(periodEnd)
      totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
    }
    
    const sites = allTimeSites
      .filter(site => isDistraction(site.category))
      .map(site => ({
        domain: site.domain,
        timeSpent: site.timeSpent,
        source: 'web' as const,
      }))
    
    const totalMinutes = sites.reduce((sum, site) => sum + site.timeSpent, 0)
    
    return { sites, totalMinutes, totalDays }
  }, [cardStats.allTime])

  if (loading) {
    return (
      <div className="browsing-view">
        <div className="browsing-view__loading">
          <div className="browsing-view__loading-spinner" />
          <p>Analyzing your browsing...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="browsing-view">
        <div className="browsing-view__error">
          <p>Failed to load insights. Please try again.</p>
        </div>
      </div>
    )
  }

  const stats = cardStats.focusScore || cardStats.timeDistribution
  
  if (!stats || stats.totalVisits === 0) {
    return (
      <div className="browsing-view">
        <div className="browsing-view__empty">
          <div className="browsing-view__empty-icon">💎</div>
          <h3>No browsing data yet</h3>
          <p>Install the Clarity extension to start tracking your focus</p>
        </div>
      </div>
    )
  }

  const distractionMinutes = distractionSites.reduce((sum, site) => sum + site.timeSpent, 0)

  return (
    <div className="browsing-view">
      <div className="browsing-view__content">
        {/* Distraction Hero */}
        <section className="browsing-view__section">
          <DistractionHeroCard
            distractionMinutes={distractionMinutes}
            period={getEffectivePeriod('time-distribution')}
            projectionMinutes={projectionData.totalMinutes}
            projectionDays={projectionData.totalDays}
          />
        </section>

        {/* Top Distractions */}
        {distractionSites.length > 0 && (
          <section className="browsing-view__section">
            <TopDistractionsCard
              sites={distractionSites}
              period={getEffectivePeriod('time-distribution')}
              projectionSites={projectionData.sites}
              projectionDays={projectionData.totalDays}
              blockingRules={blockingRules}
              onBlock={(domain) => handleAddDomainToBlockList(domain)}
            />
          </section>
        )}

        {/* All Visited Sites */}
        {allVisitedSites.length > 0 && (
          <section className="browsing-view__section browsing-view__section--sites">
            <TopSitesCard
              sites={allVisitedSites}
              title="All visited sites"
              allowShowAll
              period={getEffectivePeriod('top-sites')}
              defaultPeriod={period}
              onPeriodChange={(p) => setCardPeriod('top-sites', p)}
              onClassificationSave={handleClassificationSave}
              onSiteDataDeleted={refetch}
              onAddDomainToBlockList={user?.id ? handleAddDomainToBlockList : undefined}
              blockingRules={blockingRules}
            />
          </section>
        )}

        {/* Time Distribution */}
        {cardStats.timeDistribution && (
          <section className="browsing-view__section">
            <TimeDistributionCard 
              productive={cardStats.timeDistribution.timeDistribution.productive}
              neutral={cardStats.timeDistribution.timeDistribution.neutral}
              distraction={cardStats.timeDistribution.timeDistribution.distraction}
              totalMinutes={cardStats.timeDistribution.totalTimeTracked}
              topSite={cardStats.timeDistribution.topSites[0]?.domain}
              period={getEffectivePeriod('time-distribution')}
              defaultPeriod={period}
              onPeriodChange={(p) => setCardPeriod('time-distribution', p)}
            />
          </section>
        )}

        {/* Heatmap */}
        {cardStats.heatmap && (
          <section className="browsing-view__section">
            <BrowsingHeatmapCard 
              dailyScores={cardStats.heatmap.dailyScores}
              period={getEffectivePeriod('heatmap')}
              defaultPeriod={period}
              onPeriodChange={(p) => setCardPeriod('heatmap', p)}
            />
          </section>
        )}

        {/* Data Source */}
        {stats && (
          <section className="browsing-view__section browsing-view__section--source">
            <DataSourceCard
              totalVisits={stats.totalVisits}
              periodStart={stats.periodStart}
              periodEnd={stats.periodEnd}
              lastSync={stats.lastSync}
              isConnected={stats.totalVisits > 0}
              onRefresh={refetch}
            />
          </section>
        )}
      </div>
    </div>
  )
}
