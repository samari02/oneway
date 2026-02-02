import './PeriodSelector.css'

export type Period = 'today' | '7days' | '30days' | '90days' | '180days' | '365days' | 'all'

interface PeriodSelectorProps {
  selected: Period
  onChange: (period: Period) => void
  availableDays?: number  // How many days of data we have
}

const PERIODS: { value: Period; label: string; days: number }[] = [
  { value: 'today', label: 'Today', days: 1 },
  { value: '7days', label: '7d', days: 7 },
  { value: '30days', label: '30d', days: 30 },
  { value: '90days', label: '90d', days: 90 },
  { value: '180days', label: '6m', days: 180 },
  { value: '365days', label: '1y', days: 365 },
  { value: 'all', label: 'All', days: Infinity },
]

export function PeriodSelector({ selected, onChange, availableDays }: PeriodSelectorProps) {
  return (
    <div className="period-selector">
      <span className="period-selector__label">Period:</span>
      <div className="period-selector__pills">
        {PERIODS.map((period) => {
          // Disable if we don't have enough data (but always allow 'all')
          const isDisabled = availableDays !== undefined && 
                            period.value !== 'all' && 
                            period.days > availableDays
          
          return (
            <button
              key={period.value}
              className={`period-selector__pill ${
                selected === period.value ? 'period-selector__pill--active' : ''
              } ${isDisabled ? 'period-selector__pill--disabled' : ''}`}
              onClick={() => !isDisabled && onChange(period.value)}
              disabled={isDisabled}
              title={isDisabled ? `Only ${availableDays} days of data available` : undefined}
            >
              {period.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
