import { useEffect } from 'react'
import { useAuth } from '../../auth'
import { useBrowsingStatsWithOverride } from '../hooks/useBrowsingStatsWithOverride'
import { useCardPeriods } from '../hooks/useCardPeriods'
import { DistractionHeroCard } from './DistractionHeroCard'
import { TimeDistributionCard } from './TimeDistributionCard'
import { BrowsingHeatmapCard } from './BrowsingHeatmapCard'
import { DataSourceCard } from './DataSourceCard'
import type { Period } from './PeriodSelector'
import './BrowsingView.css'

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
  
  // Get effective periods for cards
  const cardPeriods = {
    'focus-score': period, // Not used but required by hook
    'time-distribution': getEffectivePeriod('time-distribution'),
    'top-sites': period, // Not used but required by hook
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

  // Get distraction time from time distribution
  const distractionMinutes = cardStats.timeDistribution?.timeDistribution.distraction || 0

  return (
    <div className="browsing-view">
      <div className="browsing-view__content">
        {/* Distraction Hero */}
        <section className="browsing-view__section">
          <DistractionHeroCard
            distractionMinutes={distractionMinutes}
            period={getEffectivePeriod('time-distribution')}
          />
        </section>

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
