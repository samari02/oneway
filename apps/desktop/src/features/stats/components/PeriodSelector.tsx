import './PeriodSelector.css'

export type Period = 'today' | '7days' | '30days' | '90days' | '180days' | '365days' | 'all'

interface PeriodSelectorProps {
  selected: Period
  onChange: (period: Period) => void
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7days', label: '7d' },
  { value: '30days', label: '30d' },
  { value: '90days', label: '90d' },
  { value: '180days', label: '6m' },
  { value: '365days', label: '1y' },
  { value: 'all', label: 'All' },
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
