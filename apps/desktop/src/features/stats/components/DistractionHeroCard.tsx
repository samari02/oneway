import { useState } from 'react'
import { Mascot } from '../../mascot'
import { MONK_MINIATURE_SRC } from '@/features/clarity-home/companion-avatars'
import type { Period } from './PeriodSelector'
import './DistractionHeroCard.css'

interface DistractionHeroCardProps {
  distractionMinutes: number  // For display (based on selected period)
  period: Period
  // Projection data (based on ALL available data, for accurate yearly estimates)
  projectionMinutes: number
  projectionDays: number  // Actual days of data available
}

// Calculate yearly projection from all-time data
function calculateYearlyProjection(totalMinutes: number, totalDays: number): { hours: number; days: number; dailyAvg: number } {
  // Use actual data span for accurate daily average
  const dailyAverage = totalMinutes / Math.max(1, totalDays)
  const yearlyMinutes = dailyAverage * 365
  const yearlyHours = Math.round(yearlyMinutes / 60)
  const yearlyDays = Math.round(yearlyMinutes / 60 / 24)
  
  return { hours: yearlyHours, days: yearlyDays, dailyAvg: Math.round(dailyAverage) }
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) {
    return `${hours}h`
  }
  return `${hours}h ${mins}m`
}

function getPeriodLabel(period: Period): string {
  switch (period) {
    case 'today': return 'today'
    case '7days': return 'this week'
    case '30days': return 'this month'
    case '90days': return 'last 3 months'
    case '180days': return 'last 6 months'
    case '365days': return 'this year'
    case 'all': return 'all time'
    default: return ''
  }
}

export function DistractionHeroCard({ 
  distractionMinutes, 
  period,
  projectionMinutes,
  projectionDays
}: DistractionHeroCardProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  
  // Use ALL available data for stable, accurate yearly projection
  const projection = calculateYearlyProjection(projectionMinutes, projectionDays)
  const hasData = projectionDays > 0 && projectionMinutes > 0
  const hasSignificantTime = projectionMinutes >= 5
  
  return (
    <div className="distraction-hero">
      <div className="distraction-hero__mascot">
        <Mascot mood="thinking" size="large" showMessage={false} imageSrc={MONK_MINIATURE_SRC} />
      </div>
      
      <h2 className="distraction-hero__title">Time Lost to Distractions</h2>
      
      <div className="distraction-hero__value">
        <span className="distraction-hero__time">{formatDuration(distractionMinutes)}</span>
        <span className="distraction-hero__period">{getPeriodLabel(period)}</span>
      </div>
      
      {hasData && hasSignificantTime && (
        <div className="distraction-hero__projection">
          <span className="distraction-hero__projection-icon">📅</span>
          <span className="distraction-hero__projection-text">
            That's <strong>~{projection.days} days</strong> per year you could reclaim
          </span>
          <span 
            className="distraction-hero__info"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            ⓘ
            {showTooltip && (
              <div className="distraction-hero__tooltip">
                <div className="distraction-hero__tooltip-row">
                  <span>Based on</span>
                  <strong>{projectionDays} days of data</strong>
                </div>
                <div className="distraction-hero__tooltip-row">
                  <span>Daily average</span>
                  <strong>{projection.dailyAvg} min</strong>
                </div>
              </div>
            )}
          </span>
        </div>
      )}
      
      {hasData && !hasSignificantTime && (
        <div className="distraction-hero__projection distraction-hero__projection--good">
          <span className="distraction-hero__projection-icon">✨</span>
          <span className="distraction-hero__projection-text">
            Great focus! Minimal distractions detected.
          </span>
        </div>
      )}
    </div>
  )
}
