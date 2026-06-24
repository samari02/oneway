type MorningStepBlockersProps = {
  options: string[]
  selected: string[]
  onToggle: (label: string) => void
  onContinue: () => void
}

export function MorningStepBlockers({
  options,
  selected,
  onToggle,
  onContinue,
}: MorningStepBlockersProps) {
  return (
    <div className="mf-blockers">
      <div className="mf-blockers__chips" role="group" aria-label="Distractions to block">
        {options.map((label) => {
          const active = selected.includes(label)
          return (
            <button
              key={label}
              type="button"
              className={`mf-blocker-chip${active ? ' mf-blocker-chip--active' : ''}`}
              aria-pressed={active}
              onClick={() => onToggle(label)}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div className="mf-shell__footer-actions">
        <button type="button" className="mf-btn mf-btn--primary mf-btn--wide" onClick={onContinue}>
          Protect this focus
        </button>
      </div>
    </div>
  )
}
