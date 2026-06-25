type HomeBlockersInlineProps = {
  options: string[]
  selected: string[]
  onToggle: (label: string) => void
}

export function HomeBlockersInline({ options, selected, onToggle }: HomeBlockersInlineProps) {
  return (
    <div className="uh-blockers" role="group" aria-label="Distractions to block">
      <p className="uh-blockers__label">What usually gets in the way?</p>
      <div className="uh-blockers__chips">
        {options.map((label) => {
          const active = selected.includes(label)
          return (
            <button
              key={label}
              type="button"
              className={`uh-blocker-chip${active ? ' uh-blocker-chip--active' : ''}`}
              aria-pressed={active}
              onClick={() => onToggle(label)}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
