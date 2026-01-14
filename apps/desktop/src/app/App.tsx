import { useState, useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useAuth, LoginForm } from '@/features/auth'
import { useHabits, useTodayCheckIns, useHabitActions, HabitList, AddHabitModal, EditHabitModal } from '@/features/habits'
import { OnboardingFlow, useOnboardingStatus, useUserSettings, saveOnboardingData, NorthStarEditModal } from '@/features/onboarding'
import { Sidebar, type ViewType } from '@/features/navigation'
import { StatsView } from '@/features/stats'
import { SettingsView } from '@/features/settings'
import { Mascot, type MascotMood } from '@/features/mascot'
import { AICompanion } from '@/features/ai-companion'
import { GoalsBar, useGoals } from '@/features/goals'
import type { OnboardingData } from '@/features/onboarding'
import type { Habit } from '@oneway/shared'
import './App.css'

function TodayView() {
  const { user } = useAuth()
  const { settings, refetch: refetchSettings } = useUserSettings(user?.id)
  const { habits, loading: habitsLoading, refetch: refetchHabits } = useHabits(user?.id)
  const { checkedIds, toggleHabit } = useTodayCheckIns(user?.id)
  const { create, update, remove } = useHabitActions()
  const { goals, create: createGoal, update: updateGoal, remove: removeGoal } = useGoals(user?.id)
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
    goal_id?: string
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
      // Goal link
      goal_id: data.goal_id,
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

  // Create habit from calendar drag
  const handleCreateHabitFromDrag = async (time: string, duration: number) => {
    if (!user) return
    await create({
      user_id: user.id,
      name: 'New habit',
      icon: '✨',
      scheduled_time: time,
      duration_minutes: duration,
      is_required: false,
      time_of_day: 'anytime',
      habit_type: 'do',
    })
    refetchHabits()
    // Open edit modal for the newly created habit
    // TODO: get the new habit ID and open edit modal
  }

  // Update habit time from calendar drag
  const handleUpdateHabitTime = async (habitId: string, newTime: string) => {
    await update(habitId, { scheduled_time: newTime })
    refetchHabits()
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
      return { mood: 'proud', message: `${greeting} All done!` }
    }
    if (progress >= 0.7) {
      return { mood: 'encouraging', message: `${greeting} Almost there!` }
    }
    if (progress >= 0.3) {
      return { mood: 'happy', message: `${greeting} Great progress!` }
    }
    if (hour >= 22 || hour < 5) {
      return { mood: 'sleepy', message: `${greeting} Time to rest...` }
    }
    if (totalCount === 0) {
      return { mood: 'thinking', message: `${greeting} Add a habit!` }
    }
    return { mood: 'encouraging', message: `${greeting} Let's go!` }
  }

  const mascotState = getMascotState()

  const northStar = settings?.north_star_goal ? {
    goal: settings.north_star_goal,
    icon: settings.north_star_icon || '🎯'
  } : null

  const [isScrolled, setIsScrolled] = useState(false)

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setIsScrolled(e.currentTarget.scrollTop > 10)
  }

  return (
    <div className="today-view">
      {/* Sticky hero section */}
      <div className={`today-view__sticky-hero ${isScrolled ? 'today-view__sticky-hero--scrolled' : ''}`}>
        <h1 className="today-view__title">Home</h1>
        
        <section className={`today-view__header ${showAiChat ? 'today-view__header--chat-open' : ''}`}>
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
            
            {/* North Star section */}
            {northStar && (
              <div className="today-view__section">
                <span className="today-view__section-label">North Star</span>
                <button 
                  className="today-view__north-star"
                  onClick={() => setShowNorthStarEdit(true)}
                >
                  <span className="today-view__north-star-text">{northStar.goal}</span>
                  <span className="today-view__north-star-edit">✏️</span>
                </button>
              </div>
            )}
            
            {/* Goals section */}
            {user && (
              <div className="today-view__section">
                <span className="today-view__section-label">Goals</span>
                <GoalsBar
                  goals={goals}
                  onCreateGoal={createGoal}
                  onUpdateGoal={updateGoal}
                  onDeleteGoal={removeGoal}
                  userId={user.id}
                  habits={habits}
                />
              </div>
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
            goals={goals}
            checkedIds={checkedIds}
            userSettings={settings ? {
              wake_time: settings.wake_time,
              sleep_time: settings.sleep_time
            } : undefined}
            onGoalUpdate={() => refetchSettings()}
            onCreateGoal={async (goal) => {
              const newGoal = await createGoal({
                user_id: user.id,
                name: goal.name,
                icon: goal.icon,
                progress: 0,
                target_date: goal.target_date
              })
              return newGoal
            }}
            onCreateHabits={async (habitsToCreate) => {
              for (const habit of habitsToCreate) {
                await create({
                  user_id: user.id,
                  name: habit.name,
                  icon: habit.icon,
                  scheduled_time: habit.scheduled_time,
                  duration_minutes: habit.duration_minutes || null,
                  habit_type: 'do',
                  is_required: false,
                  time_of_day: 'morning',
                  goal_id: habit.goal_id,
                })
              }
              refetchHabits()
            }}
            isOpen={showAiChat}
            onOpenChange={setShowAiChat}
            hideTrigger={true}
          />
        )}
        </section>
      </div>

      {/* Scrollable content area */}
      <div className="today-view__content" onScroll={handleScroll}>
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
              onCreateHabit={handleCreateHabitFromDrag}
              onUpdateHabitTime={handleUpdateHabitTime}
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
                goals={goals}
              />
            )}
          </>
        )}
      </div>

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
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('clarity-theme')
    return saved === 'dark'
  })

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light')
    localStorage.setItem('clarity-theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

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
        <div className="app-titlebar__actions">
          <button 
            className="app-titlebar__theme-toggle"
            onClick={() => setIsDarkMode(!isDarkMode)}
            title={isDarkMode ? 'Light mode' : 'Dark mode'}
          >
            {isDarkMode ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
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
