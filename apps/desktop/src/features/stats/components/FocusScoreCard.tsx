import { MiniMascot, type MiniMascotMood } from './MiniMascot'
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

  const getMascotMood = (): MiniMascotMood => {
    if (score >= 70) return 'happy'
    if (score >= 40) return 'focused'
    return 'worried'
  }

  const getPeriodLabel = () => {
    if (!period || period === defaultPeriod) return null
    switch (period) {
      case 'today': return 'Today'
      case '7days': return '7d'
      case '30days': return '30d'
      case '90days': return '90d'
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
        <MiniMascot mood={getMascotMood()} size={48} />
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
          Based on productive vs distracting sites
        </div>
      </div>
    </div>
  )
}
