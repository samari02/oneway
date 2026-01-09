import './StreakCard.css'

interface StreakCardProps {
  currentStreak: number
  bestStreak: number
}

export function StreakCard({ currentStreak, bestStreak }: StreakCardProps) {
  // Generate streak dots (max 14 visible)
  const dotsToShow = Math.min(currentStreak, 14)
  const dots = Array.from({ length: 14 }, (_, i) => i < dotsToShow)

  return (
    <div className="streak-card">
      <div className="streak-card__main">
        <div className="streak-card__fire">🔥</div>
        <div className="streak-card__number">{currentStreak}</div>
        <div className="streak-card__label">
          {currentStreak === 1 ? 'day streak' : 'day streak'}
        </div>
      </div>

      <div className="streak-card__dots">
        {dots.map((filled, i) => (
          <span
            key={i}
            className={`streak-card__dot ${filled ? 'streak-card__dot--filled' : ''}`}
          />
        ))}
      </div>

      <div className="streak-card__best">
        <span className="streak-card__best-icon">🏆</span>
        <span className="streak-card__best-text">best: {bestStreak} days</span>
      </div>
    </div>
  )
}
