import type { Period } from './PeriodSelector'
import './DistractionHeroCard.css'

interface DistractionHeroCardProps {
  distractionMinutes: number
  period: Period
}

// Calculate time reclaimed projection
function calculateYearlyProjection(minutesPerPeriod: number, period: Period): { hours: number; days: number } {
  // Get number of days in the period
  let periodDays: number
  
  switch (period) {
    case 'today':
      periodDays = 1
      break
    case '7days':
      periodDays = 7
      break
    case '30days':
      periodDays = 30
      break
    case '90days':
      periodDays = 90
      break
    case '180days':
      periodDays = 180
      break
    case '365days':
      periodDays = 365
      break
    case 'all':
      // Assume ~365 days for "all time"
      periodDays = 365
      break
    default:
      periodDays = 1
  }
  
  // Calculate daily average, then extrapolate to yearly
  const dailyAverage = minutesPerPeriod / periodDays
  const yearlyMinutes = dailyAverage * 365
  const yearlyHours = Math.round(yearlyMinutes / 60)
  const yearlyDays = Math.round(yearlyMinutes / 60 / 24)
  
  return { hours: yearlyHours, days: yearlyDays }
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

// Mini mascot looking at watch
function WatchingMascot() {
  return (
    <div className="watching-mascot">
      <div className="watching-mascot__blob">
        {/* Sprout */}
        <div className="watching-mascot__sprout">
          <div className="watching-mascot__sprout-stem" />
          <div className="watching-mascot__sprout-leaf watching-mascot__sprout-leaf--left" />
          <div className="watching-mascot__sprout-leaf watching-mascot__sprout-leaf--right" />
        </div>
        
        {/* Face */}
        <div className="watching-mascot__face">
          <div className="watching-mascot__cheek watching-mascot__cheek--left" />
          <div className="watching-mascot__cheek watching-mascot__cheek--right" />
          <div className="watching-mascot__eye watching-mascot__eye--left" />
          <div className="watching-mascot__eye watching-mascot__eye--right" />
          <div className="watching-mascot__mouth" />
        </div>
        
        {/* Watch on arm */}
        <div className="watching-mascot__arm">
          <div className="watching-mascot__watch">
            <div className="watching-mascot__watch-face" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function DistractionHeroCard({ 
  distractionMinutes, 
  period
}: DistractionHeroCardProps) {
  const projection = calculateYearlyProjection(distractionMinutes, period)
  const hasSignificantTime = distractionMinutes >= 5
  
  return (
    <div className="distraction-hero">
      <WatchingMascot />
      
      <h2 className="distraction-hero__title">Time Lost to Distractions</h2>
      
      <div className="distraction-hero__value">
        <span className="distraction-hero__time">{formatDuration(distractionMinutes)}</span>
        <span className="distraction-hero__period">{getPeriodLabel(period)}</span>
      </div>
      
      {hasSignificantTime && (
        <div className="distraction-hero__projection">
          <span className="distraction-hero__projection-icon">📅</span>
          <span className="distraction-hero__projection-text">
            That's <strong>~{projection.days} days</strong> per year you could reclaim
          </span>
        </div>
      )}
      
      {!hasSignificantTime && (
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
