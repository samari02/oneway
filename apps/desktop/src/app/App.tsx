import { useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useAuth, LoginForm } from '@/features/auth'
import { useHabits, useTodayCheckIns, useHabitActions, HabitList, AddHabitModal, EditHabitModal } from '@/features/habits'
import { OnboardingFlow, useOnboardingStatus, useUserSettings, saveOnboardingData, NorthStarEditModal } from '@/features/onboarding'
import { Sidebar, type ViewType } from '@/features/navigation'
import { StatsView } from '@/features/stats'
import { SettingsView } from '@/features/settings'
import { Mascot, type MascotMood } from '@/features/mascot'
import { AICompanion } from '@/features/ai-companion'
import type { OnboardingData } from '@/features/onboarding'
import type { Habit } from '@oneway/shared'
import './App.css'

function TodayView() {
  const { user } = useAuth()
  const { settings, refetch: refetchSettings } = useUserSettings(user?.id)
  const { habits, loading: habitsLoading, refetch: refetchHabits } = useHabits(user?.id)
  const { checkedIds, toggleHabit } = useTodayCheckIns(user?.id)
  const { create, update, remove } = useHabitActions()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [showNorthStarEdit, setShowNorthStarEdit] = useState(false)
  const [showAiChat, setShowAiChat] = useState(false)

  const handleToggle = (habitId: string) => {
    if (!user) return
    toggleHabit(habitId, user.id)
  }

  const handleAddHabit = async (data: {
    name: string
    icon: string
    description: string
    duration_minutes: number | null
    scheduled_time: string
    is_required: boolean
    time_of_day: 'morning' | 'evening' | 'anytime'
    // Boundary fields
    habit_type: 'do' | 'avoid'
    avoid_category?: 'digital' | 'physical'
    time_start?: string
    time_end?: string
    blocked_sites?: string[]
    days_of_week?: number[]
  }) => {
    if (!user) return
    await create({
      user_id: user.id,
      name: data.name,
      icon: data.icon,
      description: data.description || undefined,
      duration_minutes: data.duration_minutes,
      scheduled_time: data.scheduled_time || undefined,
      is_required: data.is_required,
      time_of_day: data.time_of_day,
      // Boundary fields
      habit_type: data.habit_type,
      avoid_category: data.avoid_category,
      time_start: data.time_start,
      time_end: data.time_end,
      blocked_sites: data.blocked_sites,
      days_of_week: data.days_of_week,
    })
    setShowAddForm(false)
    refetchHabits()
  }

  const handleEditHabit = async (updates: Partial<Habit>) => {
    if (!editingHabit) return
    await update(editingHabit.id, updates)
    setEditingHabit(null)
    refetchHabits()
  }

  const handleDeleteHabit = async (habitId: string) => {
    try {
      await remove(habitId)
      refetchHabits()
    } catch (err) {
      console.error('Failed to delete habit:', err)
    }
  }

  // Mark a boundary as violated (user declares they didn't hold)
  const handleMarkViolated = async (habitId: string) => {
    if (!user) return
    // For now, we just toggle it like a regular habit check
    // but with completed: false semantics for boundaries
    // In the future, this should create a check-in with completed: false
    toggleHabit(habitId, user.id)
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  })

  const completedCount = Array.from(checkedIds).filter(id => 
    habits.some(h => h.id === id)
  ).length
  const totalCount = habits.length
  const allDone = totalCount > 0 && completedCount === totalCount
  const progress = totalCount > 0 ? completedCount / totalCount : 0

  // Determine mascot mood and message based on progress
  const displayName = settings?.display_name
  const greeting = displayName ? `Hi ${displayName}!` : 'Hey!'

  const getMascotState = (): { mood: MascotMood; message: string } => {
    const hour = new Date().getHours()
    
    if (allDone) {
      return { mood: 'proud', message: `${greeting} All done! 🎉` }
    }
    if (progress >= 0.7) {
      return { mood: 'encouraging', message: `${greeting} Almost there!` }
    }
    if (progress >= 0.3) {
      return { mood: 'happy', message: `${greeting} Great progress! 💪` }
    }
    if (hour >= 22 || hour < 5) {
      return { mood: 'sleepy', message: `${greeting} Time to rest...` }
    }
    if (totalCount === 0) {
      return { mood: 'thinking', message: `${greeting} Add a habit!` }
    }
    return { mood: 'encouraging', message: `${greeting} Let's go! ✨` }
  }

  const mascotState = getMascotState()

  const northStar = settings?.north_star_goal ? {
    goal: settings.north_star_goal,
    icon: settings.north_star_icon || '🎯'
  } : null

  return (
    <div className="today-view">
      <section className={`today-view__header ${showAiChat ? 'today-view__header--chat-open' : ''}`}>
        <h1 className="today-view__title">Home</h1>
        <div className="today-view__header-main">
          <div className="today-view__hero-mascot">
            <Mascot 
              mood={mascotState.mood} 
              message={mascotState.message}
              size="large"
              onChatClick={() => setShowAiChat(!showAiChat)}
            />
          </div>
          <div className="today-view__header-text">
            <p className="today-view__date">{today}</p>
            {northStar && (
              <button 
                className="today-view__north-star"
                onClick={() => setShowNorthStarEdit(true)}
              >
                <span className="today-view__north-star-text">{northStar.goal}</span>
                <span className="today-view__north-star-edit">✏️</span>
              </button>
            )}
          </div>
        </div>

        {/* AI Companion - inside header */}
        {user && showAiChat && (
          <AICompanion
            userId={user.id}
            displayName={settings?.display_name}
            currentGoal={northStar?.goal}
            habits={habits}
            checkedIds={checkedIds}
            userSettings={settings ? {
              wake_time: settings.wake_time,
              sleep_time: settings.sleep_time
            } : undefined}
            onGoalUpdate={() => refetchSettings()}
            isOpen={showAiChat}
            onOpenChange={setShowAiChat}
            hideTrigger={true}
          />
        )}
      </section>

      {habitsLoading ? (
        <div className="today-view__loader">Loading...</div>
      ) : (
        <>
          <HabitList
            habits={habits}
            checkedIds={checkedIds}
            onCheck={handleToggle}
            onUncheck={handleToggle}
            onEdit={setEditingHabit}
            onDelete={handleDeleteHabit}
            onMarkViolated={handleMarkViolated}
          />

          <button 
            className="today-view__add-button"
            onClick={() => setShowAddForm(true)}
          >
            + Add Habit
          </button>

          {showAddForm && (
            <AddHabitModal
              onAdd={handleAddHabit}
              onCancel={() => setShowAddForm(false)}
            />
          )}
        </>
      )}

      {editingHabit && (
        <EditHabitModal
          habit={editingHabit}
          onSave={handleEditHabit}
          onCancel={() => setEditingHabit(null)}
        />
      )}

      {showNorthStarEdit && user && northStar && (
        <NorthStarEditModal
          userId={user.id}
          goal={northStar.goal}
          icon={northStar.icon}
          habits={habits}
          userSettings={settings ? {
            display_name: settings.display_name,
            wake_time: settings.wake_time,
            sleep_time: settings.sleep_time
          } : undefined}
          onSave={() => {
            setShowNorthStarEdit(false)
            refetchSettings()
            refetchHabits()
          }}
          onCancel={() => setShowNorthStarEdit(false)}
        />
      )}
    </div>
  )
}

function Dashboard() {
  const { user } = useAuth()
  const [currentView, setCurrentView] = useState<ViewType>('today')
  const [sidebarPinned, setSidebarPinned] = useState(false)

  const renderView = () => {
    switch (currentView) {
      case 'today':
        return <TodayView />
      case 'stats':
        return <StatsView />
      case 'settings':
        return <SettingsView />
      default:
        return <TodayView />
    }
  }

  const handleDragStart = (e: React.MouseEvent) => {
    // Don't drag if clicking on interactive elements
    if ((e.target as HTMLElement).closest('button')) return
    getCurrentWindow().startDragging()
  }

  return (
    <div className={`app-layout ${sidebarPinned ? 'app-layout--sidebar-pinned' : ''}`}>
      {/* Titlebar for drag region - spans full width */}
      <div className="app-titlebar" onMouseDown={handleDragStart}>
        <div className="app-titlebar__spacer" />
        <span className="app-titlebar__title">Clarity</span>
        <button 
          className="app-titlebar__profile"
          onClick={() => setCurrentView('settings')}
          title={user?.email}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="8" r="4"/>
            <path d="M20 21a8 8 0 1 0-16 0"/>
          </svg>
        </button>
      </div>
      
      <div className="app-layout__body">
        <Sidebar 
          currentView={currentView} 
          onNavigate={setCurrentView} 
          onPinnedChange={setSidebarPinned}
        />
        
        <main className="app-layout__content">
          <div className="app-layout__view">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  )
}

function AuthenticatedApp() {
  const { user } = useAuth()
  const { needsOnboarding, loading, refetch } = useOnboardingStatus(user?.id)
  const { refetch: refetchHabits } = useHabits(user?.id)

  const handleOnboardingComplete = async (data: OnboardingData) => {
    if (!user) return
    await saveOnboardingData(user.id, data)
    refetch()
    refetchHabits()
  }

  if (loading) {
    return (
      <div className="app-loader">
        <span className="app-loader__mascot">💧</span>
      </div>
    )
  }

  if (needsOnboarding) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />
  }

  return <Dashboard />
}

export function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-loader">
        <span className="app-loader__mascot">💧</span>
      </div>
    )
  }

  if (!user) {
    return <LoginForm />
  }

  return <AuthenticatedApp />
}
