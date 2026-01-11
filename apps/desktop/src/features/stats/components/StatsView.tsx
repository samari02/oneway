import { useAuth } from '../../auth'
import { useStats } from '../hooks/useStats'
import { StreakCard } from './StreakCard'
import { HeatmapCard } from './HeatmapCard'
import { CompletionBar } from './CompletionBar'
import { HabitStatsCard } from './HabitStatsCard'
import { Mascot, type MascotMood } from '../../mascot'
import './StatsView.css'

export function StatsView() {
  const { user } = useAuth()
  const { stats, loading, error } = useStats(user?.id)

  if (loading) {
    return (
      <div className="stats-view">
        <div className="stats-view__loading">
          <div className="stats-view__loading-spinner" />
          <p>Loading your stats...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="stats-view">
        <div className="stats-view__error">
          <p>Failed to load stats. Please try again.</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="stats-view">
        <div className="stats-view__empty">
          <p>No data yet. Start tracking your habits!</p>
        </div>
      </div>
    )
  }

  // Determine mascot mood based on stats
  const getMascotMood = (): MascotMood => {
    if (stats.currentStreak >= 7) return 'proud'
    if (stats.weekCompletion.rate >= 70) return 'happy'
    if (stats.weekCompletion.rate >= 40) return 'encouraging'
    return 'thinking'
  }

  return (
    <div className="stats-view">
      <header className="stats-view__header">
        <h1>Statistics</h1>
        <p className="stats-view__subtitle">Track your progress</p>
      </header>

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
            mood={getMascotMood()} 
            message={stats.encouragingMessage}
            size="medium"
          />
        </section>
      </div>
    </div>
  )
}
