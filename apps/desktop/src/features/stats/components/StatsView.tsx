import { useState, useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAuth } from '../../auth'
import { useStats } from '../hooks/useStats'
import { StreakCard } from './StreakCard'
import { HeatmapCard } from './HeatmapCard'
import { CompletionBar } from './CompletionBar'
import { HabitStatsCard } from './HabitStatsCard'
import { Mascot, type MascotMood } from '../../mascot'
import { BrowsingView } from './BrowsingView'
import { OverviewTab } from './OverviewTab'
import { AppsTab } from './AppsTab'
import { PeriodSelector, type Period } from './PeriodSelector'
import './StatsView.css'

// SVG Icon for Screen Time header
const ScreenTimeIcon = () => (
  <svg className="stats-view__header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)

type TabType = 'overview' | 'browsing' | 'apps' | 'habits'

// Storage keys for persistence
const STORAGE_KEYS = {
  TAB: 'screen_time_active_tab',
  PERIOD: 'screen_time_selected_period',
}

export function StatsView() {
  // Load persisted values from localStorage
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TAB)
    // Migrate old values
    if (saved === 'browsing') return 'overview'
    return (saved as TabType) || 'overview'
  })
  const [selectedPeriod, setSelectedPeriod] = useState<Period>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PERIOD)
    return (saved as Period) || 'today'
  })
  const [resetCounter, setResetCounter] = useState(0) // Increments on every global period click
  const [isHeaderMinimized, setIsHeaderMinimized] = useState(false)
  const [availableDays, setAvailableDays] = useState<number | undefined>(undefined)
  const { user } = useAuth()
  const { stats, loading, error } = useStats(user?.id)
  
  // Fetch available data range for period selector
  useEffect(() => {
    async function fetchDataRange() {
      try {
        const result = await invoke<{
          periodStart?: string
          periodEnd?: string
        }>('get_browsing_stats', { period: 'all' })
        
        if (result.periodStart && result.periodEnd) {
          const start = new Date(result.periodStart)
          const end = new Date(result.periodEnd)
          const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
          setAvailableDays(days)
        }
      } catch (err) {
        console.error('[StatsView] Failed to fetch data range:', err)
      }
    }
    
    fetchDataRange()
  }, [])
  
  // Persist tab changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TAB, activeTab)
  }, [activeTab])
  
  // Persist period changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PERIOD, selectedPeriod)
  }, [selectedPeriod])
  
  // Track scroll to minimize header
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop
    setIsHeaderMinimized(scrollTop > 50)
  }, [])

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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab period={selectedPeriod} resetTrigger={resetCounter} />
      case 'browsing':
        return <BrowsingView period={selectedPeriod} resetTrigger={resetCounter} />
      case 'apps':
        return <AppsTab period={selectedPeriod} />
      case 'habits':
        return (
          <HabitsContent 
            stats={stats} 
            loading={loading} 
            error={error}
            mascotMood={getMascotMood()}
            period={selectedPeriod}
          />
        )
      default:
        return null
    }
  }

  // Format today's date
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  })

  return (
    <div className="stats-view">
      <header className="stats-view__header">
        <div className="stats-view__header-top">
          <div className="stats-view__title">
            <span className="stats-view__icon"><ScreenTimeIcon /></span>
            <h1>Screen Time</h1>
          </div>
          <span className="stats-view__date">{today}</span>
        </div>
        <div className="stats-view__header-controls">
          <div className="stats-view__tabs">
            <button
              className={`stats-view__tab ${activeTab === 'overview' ? 'stats-view__tab--active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <span>Overview</span>
            </button>
            <button
              className={`stats-view__tab ${activeTab === 'browsing' ? 'stats-view__tab--active' : ''}`}
              onClick={() => setActiveTab('browsing')}
            >
              <span>Browsing</span>
            </button>
            <button
              className={`stats-view__tab ${activeTab === 'apps' ? 'stats-view__tab--active' : ''}`}
              onClick={() => setActiveTab('apps')}
            >
              <span>Apps</span>
            </button>
            <button
              className={`stats-view__tab ${activeTab === 'habits' ? 'stats-view__tab--active' : ''}`}
              onClick={() => setActiveTab('habits')}
            >
              <span>Habits</span>
            </button>
          </div>
          <PeriodSelector 
            selected={selectedPeriod} 
            onChange={handleGlobalPeriodChange}
            availableDays={availableDays}
          />
        </div>
      </header>

      <div className="stats-view__tab-content" onScroll={handleScroll}>
        {renderTabContent()}
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
