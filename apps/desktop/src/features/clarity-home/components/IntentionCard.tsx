import { MOCK_INTENTION } from '../mock-data'

type IntentionCardProps = {
  intentionText?: string | null
}

export function IntentionCard({ intentionText }: IntentionCardProps) {
  const text = intentionText?.trim() || MOCK_INTENTION.text
  const description = MOCK_INTENTION.description

  return (
    <article className="ch-glass-card ch-intention-card">
      <div className="ch-intention-card__head">
        <span className="ch-glass-card__eyebrow">Today&apos;s intention</span>
        <span className="ch-intention-card__star" aria-hidden>
          ✦
        </span>
      </div>
      <h2 className="ch-intention-card__title">{text}</h2>
      <p className="ch-intention-card__desc">{description}</p>
      <button type="button" className="ch-btn ch-btn--ghost ch-intention-card__edit">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        Edit intention
      </button>
    </article>
  )
}
