export type YesterdayGoal = {
  id: string
  text: string
  completed: boolean
}

export type CarriedForwardGoal = {
  text: string
  /** User already chose carry forward during evening reflection */
  alreadyCarried?: boolean
}

type YesterdayCardProps = {
  goals: YesterdayGoal[]
}

export function YesterdayCard({ goals }: YesterdayCardProps) {
  if (goals.length === 0) return null

  return (
    <div className="mf-context-card">
      <h3 className="mf-context-card__label">Yesterday</h3>
      <ul className="mf-context-card__list">
        {goals.map((goal) => (
          <li
            key={goal.id}
            className={`mf-context-card__item${goal.completed ? ' mf-context-card__item--done' : ''}`}
          >
            <span className="mf-context-card__status" aria-hidden>
              {goal.completed ? '✓' : '○'}
            </span>
            <span className="mf-context-card__text">{goal.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

type CarriedOverCardProps = {
  goal: CarriedForwardGoal
  onCarryForward: () => void
  onLetGo: () => void
}

export function CarriedOverCard({ goal, onCarryForward, onLetGo }: CarriedOverCardProps) {
  return (
    <div className="mf-context-card mf-context-card--carried">
      <h3 className="mf-context-card__label">Carried over</h3>
      <p className="mf-context-card__prompt">Shall we continue with this today?</p>
      <p className="mf-context-card__goal">&ldquo;{goal.text}&rdquo;</p>
      <div className="mf-context-card__actions">
        <button type="button" className="mf-btn mf-btn--ghost mf-btn--sm" onClick={onLetGo}>
          Let it go
        </button>
        <button type="button" className="mf-btn mf-btn--primary mf-btn--sm" onClick={onCarryForward}>
          Carry forward
        </button>
      </div>
    </div>
  )
}

export function CarriedForwardChip({ text, onRemove }: { text: string; onRemove: () => void }) {
  return (
    <span className="mf-carried-chip">
      {text}
      <button type="button" className="mf-carried-chip__remove" onClick={onRemove} aria-label="Remove carried goal">
        ×
      </button>
    </span>
  )
}

/** Mock yesterday summary when no prior plan exists in the DB */
export const MOCK_YESTERDAY_GOALS: YesterdayGoal[] = [
  { id: 'y-1', text: 'Review onboarding flow', completed: true },
  { id: 'y-2', text: 'Ship landing page copy', completed: false },
]

export const MOCK_CARRIED_GOAL: CarriedForwardGoal = {
  text: 'Ship landing page copy',
}
