import { Mascot, type MascotMood } from '../../mascot'
import { CardPeriodMenu } from './CardPeriodMenu'
import type { Period } from './PeriodSelector'
import './FocusScoreCard.css'

interface FocusScoreCardProps {
  score: number
  trend: 'up' | 'down' | 'stable'
  period?: Period
  defaultPeriod: Period
  onPeriodChange?: (period: Period | null) => void
}

export function FocusScoreCard({ score, trend, period, defaultPeriod, onPeriodChange }: FocusScoreCardProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return '↑'
      case 'down': return '↓'
      default: return '→'
    }
  }

  const getTrendLabel = () => {
    switch (trend) {
      case 'up': return 'Improving'
      case 'down': return 'Declining'
      default: return 'Stable'
    }
  }

  const getScoreColor = () => {
    if (score >= 70) return 'good'
    if (score >= 40) return 'medium'
    return 'low'
  }

  const getMascotMood = (): MascotMood => {
    if (score >= 80) return 'proud'
    if (score >= 60) return 'happy'
    if (score >= 40) return 'encouraging'
    return 'thinking'
  }

  const getMascotMessage = () => {
    if (score >= 80) return "Incredible focus! You're crushing it!"
    if (score >= 60) return "Good balance! A few less distractions and you'll be golden"
    if (score >= 40) return "Room for improvement! Try blocking some distracting sites"
    return "Let's work on reducing those distractions together"
  }

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
    <div className="focus-score-card">
      {onPeriodChange && (
        <CardPeriodMenu
          currentPeriod={period}
          defaultPeriod={defaultPeriod}
          onPeriodChange={onPeriodChange}
        />
      )}
      <div className="focus-score-card__mascot">
        <Mascot mood={getMascotMood()} size="small" showMessage={false} />
      </div>
      <div className="focus-score-card__content">
        <div className={`focus-score-card__score focus-score-card__score--${getScoreColor()}`}>
          {score}
        </div>
        <div className="focus-score-card__label">
          Focus Score
          {getPeriodLabel() && (
            <span className="focus-score-card__period-badge">({getPeriodLabel()})</span>
          )}
        </div>
        <div className={`focus-score-card__trend focus-score-card__trend--${trend}`}>
          <span className="focus-score-card__trend-icon">{getTrendIcon()}</span>
          <span className="focus-score-card__trend-label">{getTrendLabel()}</span>
        </div>
        <div className="focus-score-card__explanation">
          {getMascotMessage()}
        </div>
      </div>
    </div>
  )
}
