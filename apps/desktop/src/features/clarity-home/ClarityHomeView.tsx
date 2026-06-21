import { useAuth } from '@/features/auth'
import { useUserSettings } from '@/features/onboarding'
import { CurrentSessionCard } from './components/CurrentSessionCard'
import { FocusHelpersCard } from './components/FocusHelpersCard'
import { FooterBanner } from './components/FooterBanner'
import { HomeHeader } from './components/HomeHeader'
import { HomeInsightsCard } from './components/HomeInsightsCard'
import { MorningHomeView } from './components/MorningHomeView'
import { getSuccessFrameHint, getTodayDayPlan } from './hooks/useMorningFlow'
import { useMorningMode } from './hooks/useMorningMode'
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
  const { isMorningMode } = useMorningMode()
  const firstName = settings?.display_name?.split(' ')[0] || 'Sam'

  if (isMorningMode) {
    return <MorningHomeView firstName={firstName} />
  }

  const dayPlan = getTodayDayPlan()
  const intentionText = dayPlan?.intention ?? settings?.north_star_goal
  const intentionDescription = dayPlan
    ? getSuccessFrameHint(dayPlan.successFrame, dayPlan.intention)
    : undefined

  return (
    <div className="clarity-home">
      <div className="clarity-home__shell">
        <HomeHeader
          greeting={getGreeting()}
          firstName={firstName}
          intentionText={intentionText}
          intentionDescription={intentionDescription}
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
