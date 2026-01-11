import type { DailyFocusScore } from '../hooks/useBrowsingStats'
import './BrowsingHeatmapCard.css'

interface BrowsingHeatmapCardProps {
  dailyScores: DailyFocusScore[]
}

export function BrowsingHeatmapCard({ dailyScores }: BrowsingHeatmapCardProps) {
  const getScoreLevel = (score: number): number => {
    if (score >= 70) return 3 // green
    if (score >= 40) return 2 // yellow
    if (score > 0) return 1  // red
    return 0 // no data
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getDayName = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }

  // Group by weeks for display
  const weeks: DailyFocusScore[][] = []
  let currentWeek: DailyFocusScore[] = []
  
  dailyScores.forEach((day, index) => {
    currentWeek.push(day)
    if (currentWeek.length === 7 || index === dailyScores.length - 1) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  })

  return (
    <div className="browsing-heatmap-card">
      <div className="browsing-heatmap-card__header">
        <h3 className="browsing-heatmap-card__title">Focus Activity</h3>
        <span className="browsing-heatmap-card__period">Last 30 days</span>
      </div>

      <div className="browsing-heatmap-card__grid">
        {/* Day labels */}
        <div className="browsing-heatmap-card__day-labels">
          <span>Mon</span>
          <span>Wed</span>
          <span>Fri</span>
          <span>Sun</span>
        </div>

        {/* Heatmap squares */}
        <div className="browsing-heatmap-card__squares">
          {dailyScores.map((day) => (
            <div
              key={day.date}
              className={`browsing-heatmap-card__square browsing-heatmap-card__square--level-${getScoreLevel(day.score)}`}
              title={`${formatDate(day.date)}: ${day.score}%`}
            >
              <div className="browsing-heatmap-card__tooltip">
                <span className="browsing-heatmap-card__tooltip-day">{getDayName(day.date)}</span>
                <span className="browsing-heatmap-card__tooltip-date">{formatDate(day.date)}</span>
                <span className="browsing-heatmap-card__tooltip-score">{day.score}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="browsing-heatmap-card__legend">
        <span className="browsing-heatmap-card__legend-label">Less focused</span>
        <div className="browsing-heatmap-card__legend-squares">
          <div className="browsing-heatmap-card__square browsing-heatmap-card__square--level-0" />
          <div className="browsing-heatmap-card__square browsing-heatmap-card__square--level-1" />
          <div className="browsing-heatmap-card__square browsing-heatmap-card__square--level-2" />
          <div className="browsing-heatmap-card__square browsing-heatmap-card__square--level-3" />
        </div>
        <span className="browsing-heatmap-card__legend-label">More focused</span>
      </div>
    </div>
  )
}
