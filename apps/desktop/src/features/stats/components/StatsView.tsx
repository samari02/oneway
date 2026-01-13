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
  const [resetCounter, setResetCounter] = useState(0) // Increments on every global period click
  const { user } = useAuth()
  const { stats, loading, error } = useStats(user?.id)

  // Handle global period change - always reset individual overrides
  const handleGlobalPeriodChange = (period: Period) => {
    setSelectedPeriod(period)
    setResetCounter((c) => c + 1) // Trigger reset even if same period
  }

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
            <svg className="stats-view__tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L12 6M12 18L12 22M4.93 4.93L7.76 7.76M16.24 16.24L19.07 19.07M2 12H6M18 12H22M4.93 19.07L7.76 16.24M16.24 7.76L19.07 4.93"/>
            </svg>
            <span>habits</span>
          </button>
          <button
            className={`stats-view__tab ${activeTab === 'browsing' ? 'stats-view__tab--active' : ''}`}
            onClick={() => setActiveTab('browsing')}
          >
            <svg className="stats-view__tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <span>browsing</span>
          </button>
        </div>

        {/* Period Selector */}
        <PeriodSelector selected={selectedPeriod} onChange={handleGlobalPeriodChange} />
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
          <BrowsingView period={selectedPeriod} resetTrigger={resetCounter} />
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
