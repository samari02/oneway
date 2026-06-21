import { Mascot } from '../../mascot'
import { MONK_MINIATURE_SRC } from '@/features/clarity-home/companion-avatars'
import { CardPeriodMenu } from './CardPeriodMenu'
import type { Period } from './PeriodSelector'
import './TimeDistributionCard.css'

interface TimeDistributionCardProps {
  productive: number
  neutral: number
  distraction: number
  totalMinutes?: number // Total time tracked in minutes
  topSite?: string // Top site visited
  period?: Period
  defaultPeriod: Period
  onPeriodChange?: (period: Period | null) => void
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  return `${hours}h ${mins}m`
}

function getContextualMessage(productive: number, neutral: number, distraction: number, topSite?: string): string {
  if (productive > 50) return "You're crushing it today!"
  if (distraction > 30) return "Need a quick reset break?"
  if (neutral > 70) return "Pretty balanced, let's stay focused"
  if (topSite) return `Most time on ${topSite}`
  return "Keep up the good work!"
}

export function TimeDistributionCard({ productive, neutral, distraction, totalMinutes = 0, topSite, period, defaultPeriod, onPeriodChange }: TimeDistributionCardProps) {
  // Calculate time for each category
  const productiveTime = Math.round((totalMinutes * productive) / 100)
  const neutralTime = Math.round((totalMinutes * neutral) / 100)
  const distractionTime = Math.round((totalMinutes * distraction) / 100)

  const categories = [
    { label: 'Productive', value: productive, className: 'productive', mood: 'happy' as const, time: productiveTime },
    { label: 'Neutral', value: neutral, className: 'neutral', mood: 'meh' as const, time: neutralTime },
    { label: 'Distraction', value: distraction, className: 'distraction', mood: 'worried' as const, time: distractionTime },
  ]

  const contextualMessage = getContextualMessage(productive, neutral, distraction, topSite)

  const getPeriodLabel = () => {
    if (!period || period === defaultPeriod) return null
    switch (period) {
      case 'today': return 'Today'
      case '7days': return '7d'
      case '30days': return '30d'
      case '90days': return '90d'
      case '180days': return '6m'
      case '365days': return '1y'
      case 'all': return 'All'
      default: return null
    }
  }

  return (
    <div className="time-distribution-card">
      {onPeriodChange && (
        <CardPeriodMenu
          currentPeriod={period}
          defaultPeriod={defaultPeriod}
          onPeriodChange={onPeriodChange}
        />
      )}
      <h3 className="time-distribution-card__title">
        Time Distribution
        {getPeriodLabel() && (
          <span className="time-distribution-card__period-badge"> ({getPeriodLabel()})</span>
        )}
      </h3>
      
      {/* Visual bar */}
      <div className="time-distribution-card__bar">
        {categories.map((cat) => (
          <div
            key={cat.className}
            className={`time-distribution-card__segment time-distribution-card__segment--${cat.className}`}
            style={{ width: `${cat.value}%` }}
          />
        ))}
      </div>

      {/* Legend with mascots */}
      <div className="time-distribution-card__legend">
        {categories.map((cat) => (
          <div key={cat.className} className="time-distribution-card__legend-item">
            <div className="time-distribution-card__legend-mascot">
              <Mascot mood="happy" size="small" showMessage={false} imageSrc={MONK_MINIATURE_SRC} />
            </div>
            <div className="time-distribution-card__legend-content">
              <span className="time-distribution-card__legend-label">{cat.label}</span>
              <span className={`time-distribution-card__legend-value time-distribution-card__legend-value--${cat.className}`}>
                {cat.value}%
              </span>
              {totalMinutes > 0 && (
                <span className="time-distribution-card__legend-time">
                  {formatMinutes(cat.time)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Contextual message */}
      <div className="time-distribution-card__message">
        {contextualMessage}
      </div>
    </div>
  )
}
