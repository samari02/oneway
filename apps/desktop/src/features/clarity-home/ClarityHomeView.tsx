import { useAuth } from '@/features/auth'
import { useUserSettings } from '@/features/onboarding'
import { CurrentSessionCard } from './components/CurrentSessionCard'
import { EveningReflectionView } from './components/EveningReflectionView'
import { FocusHelpersCard } from './components/FocusHelpersCard'
import { FooterBanner } from './components/FooterBanner'
import { HomeHeader } from './components/HomeHeader'
import { HomeInsightsCard } from './components/HomeInsightsCard'
import { MorningHomeView } from './components/MorningHomeView'
import {
  getSecondaryItems,
  getSuccessFrameHint,
  getTodayDayPlan,
} from './hooks/useMorningFlow'
import { useDayState } from './hooks/useDayState'
import './ClarityHome.css'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function ClarityHomeView() {
  const { user } = useAuth()
  const { settings } = useUserSettings(user?.id)
  const { dayState, isLoading, refetch } = useDayState({
    userId: user?.id,
    eveningReflectionTime: settings?.evening_reflection_time ?? '18:00',
  })
  const firstName = settings?.display_name?.split(' ')[0] || 'Sam'

  if (isLoading) {
    return (
      <div className="clarity-home">
        <div className="clarity-home__shell" />
      </div>
    )
  }

  if (dayState === 'morning') {
    return <MorningHomeView firstName={firstName} onFlowComplete={() => void refetch()} />
  }

  if (dayState === 'evening') {
    return <EveningReflectionView />
  }

  // dayState === 'active' or 'focus' — show normal home content
  // (Phase 2 will add a dedicated focus session view for 'focus')
  const dayPlan = getTodayDayPlan()
  const intentionText = dayPlan?.intention ?? settings?.north_star_goal
  const intentionDescription = dayPlan
    ? getSuccessFrameHint(dayPlan.successFrame, dayPlan.intention)
    : undefined
  const summaryFrame = dayPlan?.summaryFrame
  const secondaryItems = dayPlan ? getSecondaryItems(dayPlan) : []

  return (
    <div className="clarity-home">
      <div className="clarity-home__shell">
        <HomeHeader
          greeting={getGreeting()}
          firstName={firstName}
          intentionText={intentionText}
          intentionDescription={intentionDescription}
          summaryFrame={summaryFrame}
          secondaryItems={secondaryItems}
        />

        <section className="ch-home__widgets">
          <CurrentSessionCard />
          <HomeInsightsCard userId={user?.id} />
          <FocusHelpersCard />
        </section>

        <FooterBanner />
      </div>
    </div>
  )
}
