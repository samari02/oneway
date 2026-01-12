import { useState, useRef, useEffect } from 'react'
import type { Period } from './PeriodSelector'
import './CardPeriodMenu.css'

interface CardPeriodMenuProps {
  currentPeriod?: Period
  onPeriodChange: (period: Period | null) => void
  defaultPeriod: Period
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7days', label: 'Last 7 days' },
  { value: '30days', label: 'Last 30 days' },
  { value: '90days', label: 'Last 90 days' },
]

export function CardPeriodMenu({ currentPeriod, onPeriodChange, defaultPeriod }: CardPeriodMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const activePeriod = currentPeriod || defaultPeriod
  
  const getPeriodLabel = (period: Period): string => {
    switch (period) {
      case 'today': return 'Today'
      case '7days': return '7D'
      case '30days': return '30D'
      case '90days': return '90D'
      default: return 'All'
    }
  }

  return (
    <div className="card-period-menu" ref={menuRef}>
      <button
        className="card-period-menu__trigger"
        onClick={() => setIsOpen(!isOpen)}
        title="Change period"
      >
        <span className="card-period-menu__trigger-text">{getPeriodLabel(activePeriod)}</span>
        <span className="card-period-menu__trigger-icon">▼</span>
      </button>

      {isOpen && (
        <div className="card-period-menu__dropdown">
          <div className="card-period-menu__header">
            Period
          </div>
          {PERIODS.map((period) => (
            <button
              key={period.value}
              className={`card-period-menu__item ${
                activePeriod === period.value ? 'card-period-menu__item--active' : ''
              }`}
              onClick={() => {
                onPeriodChange(period.value)
                setIsOpen(false)
              }}
            >
              {period.label}
              {activePeriod === period.value && <span className="card-period-menu__check">✓</span>}
            </button>
          ))}
          
          {currentPeriod && currentPeriod !== defaultPeriod && (
            <>
              <div className="card-period-menu__divider" />
              <button
                className="card-period-menu__item card-period-menu__item--reset"
                onClick={() => {
                  onPeriodChange(null)
                  setIsOpen(false)
                }}
              >
                Reset to default
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
