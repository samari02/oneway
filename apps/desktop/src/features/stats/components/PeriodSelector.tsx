import './PeriodSelector.css'

export type Period = 'today' | '7days' | '30days' | '90days'

interface PeriodSelectorProps {
  selected: Period
  onChange: (period: Period) => void
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7days', label: '7d' },
  { value: '30days', label: '30d' },
  { value: '90days', label: '90d' },
]

export function PeriodSelector({ selected, onChange }: PeriodSelectorProps) {
  return (
    <div className="period-selector">
      <span className="period-selector__label">Period:</span>
      <div className="period-selector__pills">
        {PERIODS.map((period) => (
          <button
            key={period.value}
            className={`period-selector__pill ${
              selected === period.value ? 'period-selector__pill--active' : ''
            }`}
            onClick={() => onChange(period.value)}
          >
            {period.label}
          </button>
        ))}
      </div>
    </div>
  )
}
