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

// Day of week labels (Mon-Sun)
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface WeekData {
  days: { date: string; score: number }[]
  monthLabel?: string // "Jan", "Feb", etc. - shown at first week of month
}

export function BrowsingHeatmapCard({ dailyScores, period, defaultPeriod, onPeriodChange }: BrowsingHeatmapCardProps) {
  const getScoreLevel = (score: number): number => {
    if (score >= 70) return 3 // green
    if (score >= 40) return 2 // yellow
    if (score > 0) return 1  // red
    return 0 // no data
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString + 'T12:00:00') // Avoid timezone issues
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getDayName = (dateString: string): string => {
    const date = new Date(dateString + 'T12:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }

  const getMonthName = (dateString: string): string => {
    const date = new Date(dateString + 'T12:00:00')
    return date.toLocaleDateString('en-US', { month: 'short' })
  }

  // Build a map of date -> score for quick lookup
  const scoreMap = new Map<string, number>()
  dailyScores.forEach(day => {
    scoreMap.set(day.date, day.score)
  })

  // Find the date range from data
  const today = new Date()
  today.setHours(12, 0, 0, 0) // Normalize to noon to avoid timezone issues
  
  // Sort daily scores by date to find range
  const sortedDates = dailyScores
    .map(d => d.date)
    .sort((a, b) => a.localeCompare(b))
  
  // If no data, show last 4 weeks
  const oldestDate = sortedDates.length > 0 
    ? new Date(sortedDates[0] + 'T12:00:00')
    : new Date(today.getTime() - 27 * 24 * 60 * 60 * 1000) // 4 weeks ago
  
  // Start from oldest date, aligned to Monday
  const startDate = new Date(oldestDate)
  const dayOfWeek = startDate.getDay() // 0 = Sunday
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  startDate.setDate(startDate.getDate() - daysToMonday)
  
  // Calculate number of weeks needed
  const msPerDay = 24 * 60 * 60 * 1000
  const daysDiff = Math.ceil((today.getTime() - startDate.getTime()) / msPerDay)
  const numWeeks = Math.ceil(daysDiff / 7) + 1
  
  // Build week columns
  const weeks: WeekData[] = []
  let lastMonth = ''
  
  for (let week = 0; week < numWeeks; week++) {
    const weekData: { date: string; score: number }[] = []
    let weekMonthLabel: string | undefined = undefined
    
    for (let day = 0; day < 7; day++) {
      const currentDate = new Date(startDate)
      currentDate.setDate(startDate.getDate() + week * 7 + day)
      const dateStr = currentDate.toISOString().split('T')[0]
      const score = scoreMap.get(dateStr) ?? 0
      
      // Check if this is first day of a new month (for label)
      if (day === 0) {
        const monthName = getMonthName(dateStr)
        if (monthName !== lastMonth) {
          weekMonthLabel = monthName
          lastMonth = monthName
        }
      }
      
      // Mark future dates
      if (currentDate > today) {
        weekData.push({ date: dateStr, score: -1 }) // -1 = future
      } else {
        weekData.push({ date: dateStr, score })
      }
    }
    weeks.push({ days: weekData, monthLabel: weekMonthLabel })
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

      {/* Month labels row */}
      <div className="browsing-heatmap-card__month-row">
        <div className="browsing-heatmap-card__month-spacer" /> {/* Space for day labels */}
        <div className="browsing-heatmap-card__months">
          {weeks.map((week, i) => (
            <div key={i} className="browsing-heatmap-card__month-cell">
              {week.monthLabel && (
                <span className="browsing-heatmap-card__month-label">{week.monthLabel}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="browsing-heatmap-card__grid">
        {/* Day labels (rows) */}
        <div className="browsing-heatmap-card__day-labels">
          {DAY_LABELS.map((day, i) => (
            <span key={day} className={i % 2 === 1 ? 'browsing-heatmap-card__day-label--hidden' : ''}>
              {day}
            </span>
          ))}
        </div>

        {/* Week columns */}
        <div className="browsing-heatmap-card__weeks">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="browsing-heatmap-card__week">
              {week.days.map((day) => (
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
