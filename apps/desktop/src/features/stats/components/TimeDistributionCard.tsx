import { MiniMascot } from './MiniMascot'
import './TimeDistributionCard.css'

interface TimeDistributionCardProps {
  productive: number
  neutral: number
  distraction: number
}

export function TimeDistributionCard({ productive, neutral, distraction }: TimeDistributionCardProps) {
  const categories = [
    { label: 'Productive', value: productive, className: 'productive', mood: 'happy' as const },
    { label: 'Neutral', value: neutral, className: 'neutral', mood: 'meh' as const },
    { label: 'Distraction', value: distraction, className: 'distraction', mood: 'worried' as const },
  ]

  return (
    <div className="time-distribution-card">
      <h3 className="time-distribution-card__title">Time Distribution</h3>
      
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
              <MiniMascot mood={cat.mood} size={28} />
            </div>
            <div className="time-distribution-card__legend-content">
              <span className="time-distribution-card__legend-label">{cat.label}</span>
              <span className={`time-distribution-card__legend-value time-distribution-card__legend-value--${cat.className}`}>
                {cat.value}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
