import { useState } from 'react'
import { useAuth } from '../../auth'
import { useStats } from '../hooks/useStats'
import { StreakCard } from './StreakCard'
import { HeatmapCard } from './HeatmapCard'
import { CompletionBar } from './CompletionBar'
import { HabitStatsCard } from './HabitStatsCard'
import { Mascot, type MascotMood } from '../../mascot'
import { BrowsingView } from './BrowsingView'
import { PeriodSelector, type Period } from './PeriodSelector'
import './StatsView.css'

type TabType = 'habits' | 'browsing'

export function StatsView() {
  const [activeTab, setActiveTab] = useState<TabType>('habits')
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('today')
  const { user } = useAuth()
  const { stats, loading, error } = useStats(user?.id)

  // Determine mascot mood based on stats
  const getMascotMood = (): MascotMood => {
    if (!stats) return 'thinking'
    if (stats.currentStreak >= 7) return 'proud'
    if (stats.weekCompletion.rate >= 70) return 'happy'
    if (stats.weekCompletion.rate >= 40) return 'encouraging'
    return 'thinking'
  }

  return (
    <div className="stats-view">
      <header className="stats-view__header">
        <div className="stats-view__title-row">
          <span className="stats-view__icon">💎</span>
          <h1>Statistics</h1>
        </div>
        <p className="stats-view__subtitle">Track your progress</p>
        
        {/* Tabs */}
        <div className="stats-view__tabs">
          <button
            className={`stats-view__tab ${activeTab === 'habits' ? 'stats-view__tab--active' : ''}`}
            onClick={() => setActiveTab('habits')}
          >
            <span className="stats-view__tab-icon">🌱</span>
            <span>Habits</span>
          </button>
          <button
            className={`stats-view__tab ${activeTab === 'browsing' ? 'stats-view__tab--active' : ''}`}
            onClick={() => setActiveTab('browsing')}
          >
            <span className="stats-view__tab-icon">🔍</span>
            <span>Browsing</span>
          </button>
        </div>

        {/* Period Selector */}
        <PeriodSelector selected={selectedPeriod} onChange={setSelectedPeriod} />
      </header>

      <div className="stats-view__tab-content">
        {activeTab === 'habits' ? (
          <HabitsContent 
            stats={stats} 
            loading={loading} 
            error={error}
            mascotMood={getMascotMood()}
            period={selectedPeriod}
          />
        ) : (
          <BrowsingView period={selectedPeriod} />
        )}
      </div>
    </div>
  )
}

// Separate component for habits content
interface HabitsContentProps {
  stats: ReturnType<typeof useStats>['stats']
  loading: boolean
  error: Error | null
  mascotMood: MascotMood
  period: Period
}

function HabitsContent({ stats, loading, error, mascotMood, period }: HabitsContentProps) {
  if (loading) {
    return (
      <div className="stats-view__loading">
        <div className="stats-view__loading-spinner" />
        <p>Loading your stats...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="stats-view__error">
        <p>Failed to load stats. Please try again.</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="stats-view__empty">
        <p>No data yet. Start tracking your habits!</p>
      </div>
    )
  }

  return (
    <div className="stats-view__content">
      {/* Streak Card - Main Hero */}
      <section className="stats-view__section stats-view__section--streak">
        <StreakCard
          currentStreak={stats.currentStreak}
          bestStreak={stats.bestStreak}
        />
      </section>

      {/* Activity Heatmap */}
      <section className="stats-view__section stats-view__section--heatmap">
        <HeatmapCard dailyStats={stats.dailyStats} />
      </section>

      {/* Completion Rates */}
      <section className="stats-view__section stats-view__section--completion">
        <div className="stats-view__completion-grid">
          <CompletionBar
            label="This Week"
            rate={stats.weekCompletion.rate}
            completed={stats.weekCompletion.completed}
            total={stats.weekCompletion.total}
          />
          <CompletionBar
            label="This Month"
            rate={stats.monthCompletion.rate}
            completed={stats.monthCompletion.completed}
            total={stats.monthCompletion.total}
          />
        </div>
      </section>

      {/* Per Habit Stats */}
      <section className="stats-view__section stats-view__section--habits">
        <HabitStatsCard habitStats={stats.perHabit} />
      </section>

      {/* Mascot Message */}
      <section className="stats-view__section stats-view__section--mascot">
        <Mascot 
          mood={mascotMood} 
          message={stats.encouragingMessage}
          size="medium"
        />
      </section>
    </div>
  )
}
