import { useAuth } from '@/features/auth'
import { useUserSettings } from '@/features/onboarding'
import { CurrentSessionCard } from './components/CurrentSessionCard'
import { FocusHelpersCard } from './components/FocusHelpersCard'
import { FooterBanner } from './components/FooterBanner'
import { HomeHeader } from './components/HomeHeader'
import { HomeInsightsCard } from './components/HomeInsightsCard'
import { ReflectionCard } from './components/ReflectionCard'
import { SupportBanner } from './components/SupportBanner'
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
  const firstName = settings?.display_name?.split(' ')[0] || 'friend'

  return (
    <div className="clarity-home">
      <HomeHeader
        greeting={getGreeting()}
        firstName={firstName}
        intentionText={settings?.north_star_goal}
      />

      <SupportBanner />

      <section className="ch-home__middle">
        <CurrentSessionCard />
        <FocusHelpersCard />
      </section>

      <section className="ch-home__bottom">
        <HomeInsightsCard userId={user?.id} />
        <ReflectionCard />
      </section>

      <FooterBanner />
    </div>
  )
}
