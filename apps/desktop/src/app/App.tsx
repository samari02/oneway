import { useState } from 'react'
import { useAuth, LoginForm } from '@/features/auth'
import { useHabits, useTodayCheckIns, useHabitActions, HabitList, AddHabitForm } from '@/features/habits'
import { OnboardingFlow, useOnboardingStatus, saveOnboardingData } from '@/features/onboarding'
import type { OnboardingData } from '@/features/onboarding'
import './App.css'

function Dashboard() {
  const { user, signOut } = useAuth()
  const { habits, loading: habitsLoading, refetch: refetchHabits } = useHabits(user?.id)
  const { checkedIds, refetch: refetchCheckIns } = useTodayCheckIns(user?.id)
  const { check, uncheck, create } = useHabitActions()
  const [showAddForm, setShowAddForm] = useState(false)

  const handleCheck = async (habitId: string) => {
    if (!user) return
    await check(habitId, user.id)
    refetchCheckIns()
  }

  const handleUncheck = async (habitId: string) => {
    await uncheck(habitId)
    refetchCheckIns()
  }

  const handleAddHabit = async (name: string, icon: string) => {
    if (!user) return
    await create({ user_id: user.id, name, icon })
    setShowAddForm(false)
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

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div className="dashboard__brand">
          <span className="dashboard__mascot">{allDone ? '✨' : '💧'}</span>
          <h1 className="dashboard__title">Clarity</h1>
        </div>
        <button onClick={signOut} className="dashboard__logout">
          Logout
        </button>
      </header>

      <main className="dashboard__main">
        <section className="dashboard__today">
          <h2>Today</h2>
          <p className="dashboard__date">{today}</p>
          {allDone && (
            <p className="dashboard__congrats">🎉 All done! Great job!</p>
          )}
        </section>

        {habitsLoading ? (
          <div className="dashboard__loader">Loading...</div>
        ) : (
          <>
            <HabitList
              habits={habits}
              checkedIds={checkedIds}
              onCheck={handleCheck}
              onUncheck={handleUncheck}
            />

            {showAddForm ? (
              <AddHabitForm
                onAdd={handleAddHabit}
                onCancel={() => setShowAddForm(false)}
              />
            ) : (
              <button 
                className="dashboard__add-button"
                onClick={() => setShowAddForm(true)}
              >
                + Add Habit
              </button>
            )}
          </>
        )}
      </main>

      <footer className="dashboard__footer">
        <p>{user?.email}</p>
      </footer>
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
