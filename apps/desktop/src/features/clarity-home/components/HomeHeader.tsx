import { FocusTrackCard } from './FocusTrackCard'
import { IntentionCard } from './IntentionCard'
import type { PlanItem } from '../hooks/useMorningFlow'

type HomeHeaderProps = {
  greeting: string
  firstName: string
  intentionText?: string | null
  intentionDescription?: string | null
  summaryFrame?: string | null
  secondaryItems?: PlanItem[]
}

export function HomeHeader({
  greeting,
  firstName,
  intentionText,
  intentionDescription,
  summaryFrame,
  secondaryItems,
}: HomeHeaderProps) {
  return (
    <header className="ch-home-hero">
      <div className="ch-home-hero__greeting">
        <h1 className="ch-home-hero__title">
          {greeting}, {firstName}
        </h1>
        <p className="ch-home-hero__subtitle">How was your day?</p>
      </div>

      <div className="ch-home-hero__intention">
        <IntentionCard
          intentionText={intentionText}
          intentionDescription={intentionDescription}
          summaryFrame={summaryFrame}
          secondaryItems={secondaryItems}
        />
      </div>

      <div className="ch-home-hero__focus-track">
        <FocusTrackCard />
      </div>
    </header>
  )
}
