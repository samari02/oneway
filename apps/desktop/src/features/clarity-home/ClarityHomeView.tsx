import { useEffect, useRef } from 'react'
import { useAuth } from '@/features/auth'
import { useUserSettings } from '@/features/onboarding'
import { CurrentSessionCard } from './components/CurrentSessionCard'
import { FocusHelpersCard } from './components/FocusHelpersCard'
import { FooterBanner } from './components/FooterBanner'
import { HomeHeader } from './components/HomeHeader'
import { HomeInsightsCard } from './components/HomeInsightsCard'
import { MorningHomeView } from './components/MorningHomeView'
import { getTodayDayPlan } from './hooks/useMorningFlow'
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
  const { isMorningMode, setIsMorningMode } = useMorningMode()
  const firstName = settings?.display_name?.split(' ')[0] || 'Sam'
  const showMorningFlow = isMorningMode
  const skippedMorningOnLoad = useRef(false)

  // Skip morning flow only on initial load when today's plan already exists.
  useEffect(() => {
    if (skippedMorningOnLoad.current) return
    skippedMorningOnLoad.current = true
    if (getTodayDayPlan() !== null && isMorningMode) {
      setIsMorningMode(false)
    }
  }, [isMorningMode, setIsMorningMode])

  if (showMorningFlow) {
    return <MorningHomeView firstName={firstName} />
  }

  return (
    <div className="clarity-home">
      <div className="clarity-home__shell">
        <HomeHeader
          greeting={getGreeting()}
          firstName={firstName}
          intentionText={settings?.north_star_goal}
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
