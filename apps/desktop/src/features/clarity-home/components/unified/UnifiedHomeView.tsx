import { useState } from 'react'
import type { DailyPlan } from '@oneway/shared'
import { useAmbientMusicPlayer } from '../../hooks/useAmbientMusicPlayer'
import { DefaultHomeDashboard } from './DefaultHomeDashboard'
import { PlanMyDayView } from '../plan-my-day/PlanMyDayView'
import './UnifiedHome.css'

type TimeOfDay = 'morning' | 'daytime' | 'evening'

type UnifiedHomeViewProps = {
  firstName: string
  userId: string | undefined
  dayState: string
  todayPlan: DailyPlan | null
  onRefetch: () => Promise<void>
  initialIntention?: string
}

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 18) return 'daytime'
  return 'evening'
}

function getGreeting(firstName: string, time: TimeOfDay): string {
  switch (time) {
    case 'morning':
      return `Good morning, ${firstName}.`
    case 'daytime':
      return `Good afternoon, ${firstName}.`
    case 'evening':
      return `Good evening, ${firstName}.`
  }
}

function getSubtitle(time: TimeOfDay): string {
  switch (time) {
    case 'morning':
      return "Start your day with intention."
    case 'daytime':
      return "Let's continue making progress."
    case 'evening':
      return 'Wind down and reflect on today.'
  }
}

export function UnifiedHomeView({
  firstName,
  todayPlan,
}: UnifiedHomeViewProps) {
  const [showPlanMyDay, setShowPlanMyDay] = useState(false)

  const timeOfDay = getTimeOfDay()
  const isMorningHours = timeOfDay === 'morning'

  useAmbientMusicPlayer({ enabled: isMorningHours })

  const greeting = getGreeting(firstName, timeOfDay)
  const subtitle = getSubtitle(timeOfDay)

  if (showPlanMyDay) {
    return (
      <div className="unified-home">
        <div className="unified-home__bg" aria-hidden />
        <div className="unified-home__shell unified-home__shell--dashboard">
          <PlanMyDayView onClose={() => setShowPlanMyDay(false)} />
        </div>
      </div>
    )
  }

  return (
    <div className="unified-home">
      <div className="unified-home__bg" aria-hidden />
      <div className="unified-home__shell unified-home__shell--dashboard">
        <DefaultHomeDashboard
          greeting={greeting}
          subtitle={subtitle}
          todayPlan={todayPlan}
          timeOfDay={timeOfDay}
          isBusy={false}
          isResetting={false}
          onContinueFocus={() => undefined}
          onPlanMyDay={() => setShowPlanMyDay(true)}
        />
      </div>
    </div>
  )
}
