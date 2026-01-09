import { useState } from 'react'
import { useAuth, LoginForm } from '@/features/auth'
import { useHabits, useTodayCheckIns, useHabitActions, HabitList, AddHabitForm, EditHabitModal } from '@/features/habits'
import { OnboardingFlow, useOnboardingStatus, useUserSettings, saveOnboardingData } from '@/features/onboarding'
import { Sidebar, type ViewType } from '@/features/navigation'
import { StatsView } from '@/features/stats'
import { SettingsView } from '@/features/settings'
import { Mascot, type MascotMood } from '@/features/mascot'
import type { OnboardingData } from '@/features/onboarding'
import type { Habit } from '@oneway/shared'
import './App.css'

function TodayView() {
  const { user } = useAuth()
  const { settings } = useUserSettings(user?.id)
  const { habits, loading: habitsLoading, refetch: refetchHabits } = useHabits(user?.id)
  const { checkedIds, toggleHabit } = useTodayCheckIns(user?.id)
  const { create, update, remove } = useHabitActions()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)

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

  return (
    <div className="today-view">
      <section className="today-view__header">
        <div className="today-view__hero-mascot">
          <Mascot 
            mood={mascotState.mood} 
            message={mascotState.message}
            size="large"
          />
        </div>
        <div className="today-view__header-text">
          <h2>Today</h2>
          <p className="today-view__date">{today}</p>
        </div>
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
          />

          {showAddForm ? (
            <AddHabitForm
              onAdd={handleAddHabit}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <button 
              className="today-view__add-button"
              onClick={() => setShowAddForm(true)}
            >
              + Add Habit
            </button>
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

  return (
    <div className={`app-layout ${sidebarPinned ? 'app-layout--sidebar-pinned' : ''}`}>
      <Sidebar 
        currentView={currentView} 
        onNavigate={setCurrentView} 
        onPinnedChange={setSidebarPinned}
      />
      
      <main className="app-layout__content">
        <header className="app-layout__header">
          <div className="app-layout__brand">
            <h1 className="app-layout__title">Clarity</h1>
          </div>
          <span className="app-layout__email">{user?.email}</span>
        </header>
        
        <div className="app-layout__view">
          {renderView()}
        </div>
      </main>
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
