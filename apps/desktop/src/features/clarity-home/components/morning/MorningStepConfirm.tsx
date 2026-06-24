import type { PlanItem } from '../../hooks/useMorningFlow'

type MorningStepConfirmProps = {
  items: PlanItem[]
  priorityItemId?: string
  durationMinutes: number
  blockers: string[]
  onStart: () => void
}

export function MorningStepConfirm({
  items,
  priorityItemId,
  durationMinutes,
  blockers,
  onStart,
}: MorningStepConfirmProps) {
  const priority = priorityItemId
    ? items.find((item) => item.id === priorityItemId)
    : items.find((item) => item.kind === 'goal') ?? items[0]
  const goalText = priority?.text ?? 'Your focus'
  const blockerSummary = blockers.length > 0 ? blockers.join(', ') : 'None selected'

  return (
    <div className="mf-confirm">
      <div className="mf-confirm__summary" aria-label="Focus session summary">
        <p className="mf-confirm__line">
          <span className="mf-confirm__goal">{goalText}</span>
          <span className="mf-confirm__sep" aria-hidden>
            ·
          </span>
          <span className="mf-confirm__duration">{durationMinutes} min</span>
          <span className="mf-confirm__sep" aria-hidden>
            ·
          </span>
          <span className="mf-confirm__blockers">{blockerSummary}</span>
        </p>
      </div>

      <div className="mf-shell__footer-actions">
        <button type="button" className="mf-btn mf-btn--primary mf-btn--wide" onClick={onStart}>
          Start Focus Session
        </button>
      </div>
    </div>
  )
}
