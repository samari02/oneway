import type { DailyFocusScore } from '../hooks/useBrowsingStats'
import { CardPeriodMenu } from './CardPeriodMenu'
import type { Period } from './PeriodSelector'
import './BrowsingHeatmapCard.css'

interface BrowsingHeatmapCardProps {
  dailyScores: DailyFocusScore[]
  period?: Period
  defaultPeriod: Period
  onPeriodChange?: (period: Period | null) => void
}

// Day of week: 0 = Sunday, 1 = Monday, etc.
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function BrowsingHeatmapCard({ dailyScores, period, defaultPeriod, onPeriodChange }: BrowsingHeatmapCardProps) {
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

  // Build a map of date -> score for quick lookup
  const scoreMap = new Map<string, number>()
  dailyScores.forEach(day => {
    scoreMap.set(day.date, day.score)
  })

  // Generate grid: 7 rows (Mon-Sun) x N columns (weeks)
  // Start from today and go back
  const today = new Date()
  const numWeeks = Math.ceil(dailyScores.length / 7) || 4
  
  // Build weeks array (each week is a column)
  const weeks: { date: string; score: number }[][] = []
  
  // Find the start of the period (go back numWeeks * 7 days from today)
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - (numWeeks * 7 - 1))
  
  // Adjust to start on Monday
  const dayOfWeek = startDate.getDay() // 0 = Sunday
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  startDate.setDate(startDate.getDate() - daysToMonday)
  
  // Build week columns
  for (let week = 0; week < numWeeks; week++) {
    const weekData: { date: string; score: number }[] = []
    for (let day = 0; day < 7; day++) {
      const currentDate = new Date(startDate)
      currentDate.setDate(startDate.getDate() + week * 7 + day)
      const dateStr = currentDate.toISOString().split('T')[0]
      const score = scoreMap.get(dateStr) ?? 0
      
      // Don't show future dates
      if (currentDate > today) {
        weekData.push({ date: dateStr, score: -1 }) // -1 = future
      } else {
        weekData.push({ date: dateStr, score })
      }
    }
    weeks.push(weekData)
  }

  return (
    <div className="browsing-heatmap-card">
      {onPeriodChange && (
        <CardPeriodMenu
          currentPeriod={period}
          defaultPeriod={defaultPeriod}
          onPeriodChange={onPeriodChange}
        />
      )}
      <div className="browsing-heatmap-card__header">
        <h3 className="browsing-heatmap-card__title">focus activity</h3>
      </div>

      <div className="browsing-heatmap-card__grid">
        {/* Day labels (rows) */}
        <div className="browsing-heatmap-card__day-labels">
          {DAY_LABELS.map((day, i) => (
            <span key={day} className={i % 2 === 0 ? '' : 'browsing-heatmap-card__day-label--hidden'}>
              {day}
            </span>
          ))}
        </div>

        {/* Week columns */}
        <div className="browsing-heatmap-card__weeks">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="browsing-heatmap-card__week">
              {week.map((day, dayIndex) => (
                <div
                  key={day.date}
                  className={`browsing-heatmap-card__square ${
                    day.score === -1 
                      ? 'browsing-heatmap-card__square--future' 
                      : `browsing-heatmap-card__square--level-${getScoreLevel(day.score)}`
                  }`}
                >
                  {day.score >= 0 && (
                    <div className="browsing-heatmap-card__tooltip">
                      <span className="browsing-heatmap-card__tooltip-day">{getDayName(day.date)}</span>
                      <span className="browsing-heatmap-card__tooltip-date">{formatDate(day.date)}</span>
                      <span className="browsing-heatmap-card__tooltip-score">{day.score}%</span>
                    </div>
                  )}
                </div>
              ))}
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
