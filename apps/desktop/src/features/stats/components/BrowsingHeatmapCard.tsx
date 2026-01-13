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

// Get number of days for period
function getPeriodDays(period: Period): number {
  switch (period) {
    case 'today': return 7 // Show at least 1 week
    case '7days': return 7
    case '30days': return 30
    case '90days': return 90
    default: return 30
  }
}

export function BrowsingHeatmapCard({ dailyScores, period, defaultPeriod, onPeriodChange }: BrowsingHeatmapCardProps) {
  const effectivePeriod = period || defaultPeriod
  const periodDays = getPeriodDays(effectivePeriod)
  
  const getScoreLevel = (score: number): number => {
    if (score >= 70) return 3 // green
    if (score >= 40) return 2 // yellow
    if (score > 0) return 1  // red
    return 0 // no data
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString + 'T12:00:00')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getDayName = (dateString: string): string => {
    const date = new Date(dateString + 'T12:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }

  // Build a map of date -> score for quick lookup
  const scoreMap = new Map<string, number>()
  dailyScores.forEach(day => {
    scoreMap.set(day.date, day.score)
  })

  // Generate exactly periodDays days, ending at today
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  
  const days: { date: string; score: number; dayOfWeek: number }[] = []
  
  for (let i = periodDays - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const score = scoreMap.get(dateStr) ?? 0
    const dayOfWeek = date.getDay() // 0 = Sunday
    days.push({ date: dateStr, score, dayOfWeek })
  }

  // Group into weeks (each week is Mon-Sun)
  // A week column contains 7 cells, some may be empty at start/end
  const numWeeks = Math.ceil(periodDays / 7) + 1
  const weeks: { date: string; score: number; isEmpty?: boolean }[][] = []
  
  // Start from first day, figure out which week column it belongs to
  let dayIndex = 0
  
  for (let week = 0; week < numWeeks && dayIndex < days.length; week++) {
    const weekDays: { date: string; score: number; isEmpty?: boolean }[] = []
    
    // For first week, add empty cells before the first day
    if (week === 0) {
      const firstDayOfWeek = days[0].dayOfWeek
      // Convert: Sunday=0 -> 6, Monday=1 -> 0, etc.
      const mondayBasedDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1
      for (let i = 0; i < mondayBasedDay; i++) {
        weekDays.push({ date: '', score: -1, isEmpty: true })
      }
    }
    
    // Add actual days
    while (weekDays.length < 7 && dayIndex < days.length) {
      const day = days[dayIndex]
      weekDays.push({ date: day.date, score: day.score })
      dayIndex++
    }
    
    // Pad end of last week if needed
    while (weekDays.length < 7) {
      weekDays.push({ date: '', score: -1, isEmpty: true })
    }
    
    weeks.push(weekDays)
  }

  // Generate month labels
  const monthLabels: (string | null)[] = weeks.map((week, i) => {
    // Find first non-empty day in this week
    const firstDay = week.find(d => !d.isEmpty && d.date)
    if (!firstDay || !firstDay.date) return null
    
    const date = new Date(firstDay.date + 'T12:00:00')
    const monthName = date.toLocaleDateString('en-US', { month: 'short' })
    
    // Only show if it's the first week or a new month
    if (i === 0) return monthName
    
    const prevWeek = weeks[i - 1]
    const prevFirstDay = prevWeek.find(d => !d.isEmpty && d.date)
    if (!prevFirstDay || !prevFirstDay.date) return monthName
    
    const prevDate = new Date(prevFirstDay.date + 'T12:00:00')
    const prevMonth = prevDate.toLocaleDateString('en-US', { month: 'short' })
    
    return monthName !== prevMonth ? monthName : null
  })

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
        <div className="browsing-heatmap-card__month-spacer" />
        <div className="browsing-heatmap-card__months">
          {monthLabels.map((label, i) => (
            <div key={i} className="browsing-heatmap-card__month-cell">
              {label && <span className="browsing-heatmap-card__month-label">{label}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="browsing-heatmap-card__grid">
        {/* Day labels (rows) - Mon, Wed, Fri, Sun */}
        <div className="browsing-heatmap-card__day-labels">
          <span>Mon</span>
          <span className="browsing-heatmap-card__day-label--hidden">Tue</span>
          <span>Wed</span>
          <span className="browsing-heatmap-card__day-label--hidden">Thu</span>
          <span>Fri</span>
          <span className="browsing-heatmap-card__day-label--hidden">Sat</span>
          <span>Sun</span>
        </div>

        {/* Week columns */}
        <div className="browsing-heatmap-card__weeks">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="browsing-heatmap-card__week">
              {week.map((day, dayIndex) => (
                <div
                  key={`${weekIndex}-${dayIndex}`}
                  className={`browsing-heatmap-card__square ${
                    day.isEmpty 
                      ? 'browsing-heatmap-card__square--empty' 
                      : `browsing-heatmap-card__square--level-${getScoreLevel(day.score)}`
                  }`}
                >
                  {!day.isEmpty && day.date && (
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
