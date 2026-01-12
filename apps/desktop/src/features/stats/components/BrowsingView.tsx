import { useAuth } from '../../auth'
import { useBrowsingStats } from '../hooks/useBrowsingStats'
import { FocusScoreCard } from './FocusScoreCard'
import { TimeDistributionCard } from './TimeDistributionCard'
import { TopSitesCard } from './TopSitesCard'
import { BrowsingHeatmapCard } from './BrowsingHeatmapCard'
import { DataSourceCard } from './DataSourceCard'
import { Mascot, type MascotMood } from '../../mascot'
import type { Period } from './PeriodSelector'
import './BrowsingView.css'

interface BrowsingViewProps {
  period: Period
}

export function BrowsingView({ period }: BrowsingViewProps) {
  const { user } = useAuth()
  const { stats, loading, error, refetch } = useBrowsingStats(user?.id, period)

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

  if (!stats) {
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
    if (stats.focusScore >= 80) return 'proud'
    if (stats.focusScore >= 60) return 'happy'
    if (stats.focusScore >= 40) return 'encouraging'
    return 'thinking'
  }

  const getMascotMessage = () => {
    if (stats.focusScore >= 80) {
      return "Incredible focus today! You're crushing it! 💎"
    }
    if (stats.focusScore >= 60) {
      return "Good balance! A few less distractions and you'll be golden ✨"
    }
    if (stats.focusScore >= 40) {
      return "Room for improvement! Try blocking some distracting sites 🌱"
    }
    return "Let's work on reducing those distractions together 🤝"
  }

  return (
    <div className="browsing-view">
      <div className="browsing-view__content">
        {/* Top Row: Focus Score + Time Distribution */}
        <section className="browsing-view__section browsing-view__section--hero">
          <div className="browsing-view__hero-grid">
            <FocusScoreCard 
              score={stats.focusScore} 
              trend={stats.focusTrend} 
            />
            <TimeDistributionCard 
              productive={stats.timeDistribution.productive}
              neutral={stats.timeDistribution.neutral}
              distraction={stats.timeDistribution.distraction}
              totalMinutes={stats.totalTimeTracked}
              topSite={stats.topSites[0]?.domain}
            />
          </div>
        </section>

        {/* Heatmap */}
        <section className="browsing-view__section browsing-view__section--heatmap">
          <BrowsingHeatmapCard dailyScores={stats.dailyScores} />
        </section>

        {/* Top Sites */}
        <section className="browsing-view__section browsing-view__section--sites">
          <TopSitesCard sites={stats.topSites} />
        </section>

        {/* Data Source */}
        <section className="browsing-view__section browsing-view__section--source">
          <DataSourceCard
            totalVisits={stats.dataSource.totalVisits}
            periodStart={stats.dataSource.periodStart}
            periodEnd={stats.dataSource.periodEnd}
            lastSync={stats.dataSource.lastSync}
            isConnected={stats.dataSource.isConnected}
            onRefresh={refetch}
          />
        </section>

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
