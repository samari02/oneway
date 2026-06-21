import { MOCK_INTENTION } from '../mock-data'
import type { PlanItem } from '../hooks/useMorningFlow'

type IntentionCardProps = {
  intentionText?: string | null
  intentionDescription?: string | null
  summaryFrame?: string | null
  secondaryItems?: PlanItem[]
}

const KIND_LABELS: Record<PlanItem['kind'], string> = {
  goal: 'Goal',
  task: 'Task',
  routine: 'Routine',
}

export function IntentionCard({
  intentionText,
  intentionDescription,
  summaryFrame,
  secondaryItems = [],
}: IntentionCardProps) {
  const text = intentionText?.trim() || MOCK_INTENTION.text
  const description =
    summaryFrame?.trim() || intentionDescription?.trim() || MOCK_INTENTION.description

  return (
    <article className="ch-glass-card ch-intention-card">
      <div className="ch-intention-card__head">
        <span className="ch-glass-card__eyebrow">Today&apos;s focus</span>
        <span className="ch-intention-card__star" aria-hidden>
          ✦
        </span>
      </div>
      <h2 className="ch-intention-card__title">{text}</h2>
      <p className="ch-intention-card__desc">{description}</p>

      {secondaryItems.length > 0 && (
        <div className="ch-intention-card__others" aria-label="Also on your mind today">
          {secondaryItems.map((item) => (
            <span key={item.id} className="ch-intention-card__pill" title={KIND_LABELS[item.kind]}>
              {item.text}
            </span>
          ))}
        </div>
      )}

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
