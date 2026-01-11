import { MiniMascot, type MiniMascotMood } from './MiniMascot'
import './FocusScoreCard.css'

interface FocusScoreCardProps {
  score: number
  trend: 'up' | 'down' | 'stable'
}

export function FocusScoreCard({ score, trend }: FocusScoreCardProps) {
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

  return (
    <div className="focus-score-card">
      <div className="focus-score-card__mascot">
        <MiniMascot mood={getMascotMood()} size={48} />
      </div>
      <div className="focus-score-card__content">
        <div className={`focus-score-card__score focus-score-card__score--${getScoreColor()}`}>
          {score}
        </div>
        <div className="focus-score-card__label">Focus Score</div>
        <div className={`focus-score-card__trend focus-score-card__trend--${trend}`}>
          <span className="focus-score-card__trend-icon">{getTrendIcon()}</span>
          <span className="focus-score-card__trend-label">{getTrendLabel()}</span>
        </div>
      </div>
    </div>
  )
}
