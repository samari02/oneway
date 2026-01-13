import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAuth } from '../../auth'
import { useBrowsingStatsWithOverride } from '../hooks/useBrowsingStatsWithOverride'
import { useCardPeriods } from '../hooks/useCardPeriods'
import { FocusScoreCard } from './FocusScoreCard'
import { TimeDistributionCard } from './TimeDistributionCard'
import { TopSitesCard } from './TopSitesCard'
import { BrowsingHeatmapCard } from './BrowsingHeatmapCard'
import { DataSourceCard } from './DataSourceCard'
import { Mascot, type MascotMood } from '../../mascot'
import type { Period } from './PeriodSelector'
import type { SiteVisit } from '../hooks/useBrowsingStats'
import type { SiteCategory } from './SiteClassificationModal'
import './BrowsingView.css'

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

interface BrowsingViewProps {
  period: Period
  resetTrigger?: number
}

export function BrowsingView({ period, resetTrigger = 0 }: BrowsingViewProps) {
  const { user } = useAuth()
  const { getEffectivePeriod, setCardPeriod, resetAllOverrides } = useCardPeriods(period)
  
  // Reset all card overrides when global period is clicked
  useEffect(() => {
    if (resetTrigger > 0) {
      resetAllOverrides()
    }
  }, [resetTrigger, resetAllOverrides])
  
  // Get effective periods for all cards
  const cardPeriods = {
    'focus-score': getEffectivePeriod('focus-score'),
    'time-distribution': getEffectivePeriod('time-distribution'),
    'top-sites': getEffectivePeriod('top-sites'),
    'heatmap': getEffectivePeriod('heatmap'),
  }
  
  const { cardStats, loading, error, refetch } = useBrowsingStatsWithOverride(
    user?.id,
    period,
    cardPeriods
  )

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

  // Use first available card stats for overall view (fallback to focus-score)
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

  // Determine mascot mood based on focus score
  const getMascotMood = (): MascotMood => {
    const score = cardStats.focusScore?.focusScore || stats.focusScore
    if (score >= 80) return 'proud'
    if (score >= 60) return 'happy'
    if (score >= 40) return 'encouraging'
    return 'thinking'
  }

  const getMascotMessage = () => {
    const score = cardStats.focusScore?.focusScore || stats.focusScore
    if (score >= 80) {
      return "Incredible focus today! You're crushing it!"
    }
    if (score >= 60) {
      return "Good balance! A few less distractions and you'll be golden"
    }
    if (score >= 40) {
      return "Room for improvement! Try blocking some distracting sites"
    }
    return "Let's work on reducing those distractions together"
  }

  const handleClassificationSave = async (classifications: Record<string, SiteCategory>) => {
    console.log('[BrowsingView] ========== SAVE START ==========')
    console.log('[BrowsingView] Received classifications:', classifications)
    console.log('[BrowsingView] Type:', typeof classifications)
    console.log('[BrowsingView] Keys:', Object.keys(classifications))
    
    if (Object.keys(classifications).length === 0) {
      console.warn('[BrowsingView] Empty classifications object!')
      return
    }
    
    try {
      console.log('[BrowsingView] Calling invoke...')
      await invoke('save_site_classifications', { classifications })
      console.log('[BrowsingView] ✅ invoke() completed successfully')
      // Refetch to see updated stats
      refetch()
    } catch (e) {
      console.error('[BrowsingView] ❌ Failed to save:', e)
    }
    console.log('[BrowsingView] ========== SAVE END ==========')
  }

  return (
    <div className="browsing-view">
      <div className="browsing-view__content">
        {/* Top Row: Focus Score + Time Distribution */}
        <section className="browsing-view__section browsing-view__section--hero">
          <div className="browsing-view__hero-grid">
            {cardStats.focusScore && (
              <FocusScoreCard 
                score={cardStats.focusScore.focusScore} 
                trend={cardStats.focusScore.focusTrend as 'up' | 'down' | 'stable'}
                period={getEffectivePeriod('focus-score')}
                defaultPeriod={period}
                onPeriodChange={(p) => setCardPeriod('focus-score', p)}
              />
            )}
            {cardStats.timeDistribution && (
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
            )}
          </div>
        </section>

        {/* Heatmap */}
        {cardStats.heatmap && (
          <section className="browsing-view__section browsing-view__section--heatmap">
            <BrowsingHeatmapCard 
              dailyScores={cardStats.heatmap.dailyScores}
              period={getEffectivePeriod('heatmap')}
              defaultPeriod={period}
              onPeriodChange={(p) => setCardPeriod('heatmap', p)}
            />
          </section>
        )}

        {/* Top Sites */}
        {cardStats.topSites && (
          <section className="browsing-view__section browsing-view__section--sites">
            <TopSitesCard 
              sites={cardStats.topSites.topSites.map(site => ({
                domain: site.domain,
                visits: site.visits,
                timeSpent: site.timeSpent,
                category: mapCategory(site.category),
              }))}
              period={getEffectivePeriod('top-sites')}
              defaultPeriod={period}
              onPeriodChange={(p) => setCardPeriod('top-sites', p)}
              onClassificationSave={handleClassificationSave}
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

        {/* Mascot Message */}
        <section className="browsing-view__section browsing-view__section--mascot">
          <Mascot 
            mood={getMascotMood()} 
            message={getMascotMessage()}
            size="medium"
          />
        </section>
      </div>
    </div>
  )
}
