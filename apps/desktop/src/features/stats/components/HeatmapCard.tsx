import { useState } from 'react'
import './HeatmapCard.css'

interface DayData {
  date: Date
  completionRate: number
  completed: number
  total: number
  isFuture: boolean
}

interface HeatmapCardProps {
  dailyStats: DayData[]
}

export function HeatmapCard({ dailyStats }: HeatmapCardProps) {
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })

  const handleMouseEnter = (day: DayData, event: React.MouseEvent) => {
    if (!day.isFuture) {
      setHoveredDay(day)
      const rect = (event.target as HTMLElement).getBoundingClientRect()
      setTooltipPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      })
    }
  }

  const handleMouseLeave = () => {
    setHoveredDay(null)
  }

  const getSquareClass = (day: DayData) => {
    if (day.isFuture) return 'heatmap-card__square--future'
    if (day.completionRate === 0) return 'heatmap-card__square--low'
    if (day.completionRate <= 33) return 'heatmap-card__square--low'
    if (day.completionRate <= 66) return 'heatmap-card__square--medium'
    return 'heatmap-card__square--high'
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const averageCompletion = dailyStats
    .filter(d => !d.isFuture)
    .reduce((acc, d) => acc + d.completionRate, 0) / 
    dailyStats.filter(d => !d.isFuture).length || 0

  return (
    <div className="heatmap-card">
      <div className="heatmap-card__header">
        <h3 className="heatmap-card__title">Activity History</h3>
      </div>

      <div className="heatmap-card__grid">
        {dailyStats.map((day, index) => (
          <div
            key={index}
            className={`heatmap-card__square ${getSquareClass(day)}`}
            onMouseEnter={(e) => handleMouseEnter(day, e)}
            onMouseLeave={handleMouseLeave}
          />
        ))}
      </div>

      <div className="heatmap-card__footer">
        <span className="heatmap-card__meta">
          {dailyStats.filter(d => !d.isFuture).length} days
        </span>
        <span className="heatmap-card__meta">•</span>
        <span className="heatmap-card__meta">
          {Math.round(averageCompletion)}% avg completion
        </span>
      </div>

      <div className="heatmap-card__legend">
        <span className="heatmap-card__legend-label">Less</span>
        <div className="heatmap-card__legend-square heatmap-card__square--low" />
        <div className="heatmap-card__legend-square heatmap-card__square--medium" />
        <div className="heatmap-card__legend-square heatmap-card__square--high" />
        <span className="heatmap-card__legend-label">More</span>
      </div>

      {hoveredDay && (
        <div 
          className="heatmap-card__tooltip"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
          }}
        >
          <div className="heatmap-card__tooltip-date">
            {formatDate(hoveredDay.date)}
          </div>
          <div className="heatmap-card__tooltip-stats">
            {hoveredDay.completed}/{hoveredDay.total} habits completed ({hoveredDay.completionRate}%)
          </div>
        </div>
      )}
    </div>
  )
}
