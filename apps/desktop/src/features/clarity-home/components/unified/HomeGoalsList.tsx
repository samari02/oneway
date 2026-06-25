const PRIORITY_LABELS = ['High', 'Medium', 'Low'] as const

function getPriorityLabel(index: number, isPriority: boolean): string {
  if (isPriority) return 'High'
  return PRIORITY_LABELS[Math.min(index + 1, PRIORITY_LABELS.length - 1)] ?? 'Low'
}

function getDurationStub(isPriority: boolean): string {
  return isPriority ? '2–3 hours' : '1 hour'
}

export type HomeGoalItem = {
  id: string
  title: string
  done: boolean
  isPriority?: boolean
  fromYesterday?: boolean
}

type HomeGoalsListProps = {
  goals: HomeGoalItem[]
  mode: 'toggle' | 'select-priority' | 'readonly'
  selectedPriorityId?: string
  onToggle?: (id: string) => void
  onSelectPriority?: (id: string) => void
}

export function HomeGoalsList({
  goals,
  mode,
  selectedPriorityId,
  onToggle,
  onSelectPriority,
}: HomeGoalsListProps) {
  if (goals.length === 0) return null

  return (
    <section className="uh-focus-card" aria-label="Today's Focus">
      <header className="uh-focus-card__header">
        <div className="uh-focus-card__heading">
          <h2 className="uh-focus-card__title">Today&apos;s Focus</h2>
          <p className="uh-focus-card__subtitle">Your plan for a meaningful day.</p>
        </div>
      </header>

      <ul className="uh-goals">
        {goals.map((goal, index) => {
          const isPriority =
            goal.isPriority || (mode === 'select-priority' && selectedPriorityId === goal.id)
          const isSelectable = mode === 'select-priority'
          const isToggle = mode === 'toggle'
          const priorityLabel = getPriorityLabel(index, isPriority)

          const handleClick = () => {
            if (isToggle) onToggle?.(goal.id)
            if (isSelectable) onSelectPriority?.(goal.id)
          }

          return (
            <li
              key={goal.id}
              className={`uh-goals__item${goal.done ? ' uh-goals__item--done' : ''}${isPriority ? ' uh-goals__item--priority' : ''}${isSelectable ? ' uh-goals__item--selectable' : ''}`}
            >
              <span className="uh-goals__handle" aria-hidden>
                ⋮⋮
              </span>
              <button
                type="button"
                className="uh-goals__row"
                onClick={handleClick}
                disabled={mode === 'readonly'}
                aria-pressed={isSelectable ? selectedPriorityId === goal.id : goal.done}
              >
                <span
                  className={`uh-goals__check${isPriority ? ' uh-goals__check--priority' : ''}`}
                  aria-hidden
                >
                  {goal.done ? '✓' : isPriority ? '★' : ''}
                </span>
                <span className="uh-goals__body">
                  <span className="uh-goals__title-row">
                    <span className="uh-goals__title">{goal.title}</span>
                    <span
                      className={`uh-goals__priority uh-goals__priority--${priorityLabel.toLowerCase()}`}
                    >
                      {priorityLabel}
                    </span>
                  </span>
                  <span className="uh-goals__meta">
                    <span className="uh-goals__duration">{getDurationStub(isPriority)}</span>
                    <span className="uh-goals__category">Deep work</span>
                    {goal.fromYesterday && (
                      <span className="uh-goals__badge">from yesterday</span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
