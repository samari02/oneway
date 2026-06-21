import { FocusTrackCard } from './FocusTrackCard'
import { HeroMascot } from './HeroMascot'
import { IntentionCard } from './IntentionCard'

type HomeHeaderProps = {
  greeting: string
  firstName: string
  intentionText?: string | null
  intentionDescription?: string | null
}

export function HomeHeader({
  greeting,
  firstName,
  intentionText,
  intentionDescription,
}: HomeHeaderProps) {
  return (
    <header className="ch-home-hero">
      <div className="ch-home-hero__greeting">
        <h1 className="ch-home-hero__title">
          {greeting}, {firstName}
        </h1>
        <p className="ch-home-hero__subtitle">How was your day?</p>
      </div>

      <div className="ch-home-hero__mascot">
        <HeroMascot />
      </div>

      <div className="ch-home-hero__intention">
        <IntentionCard
          intentionText={intentionText}
          intentionDescription={intentionDescription}
        />
      </div>

      <div className="ch-home-hero__focus-track">
        <FocusTrackCard />
      </div>
    </header>
  )
}
