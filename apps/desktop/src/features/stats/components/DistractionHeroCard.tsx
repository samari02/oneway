import type { Period } from './PeriodSelector'
import './DistractionHeroCard.css'

interface DistractionHeroCardProps {
  distractionMinutes: number
  period: Period
}

// Calculate time reclaimed projection
function calculateYearlyProjection(minutesPerPeriod: number, period: Period): { hours: number; days: number } {
  let weeklyMinutes: number
  
  switch (period) {
    case 'today':
      weeklyMinutes = minutesPerPeriod * 7
      break
    case '7d':
      weeklyMinutes = minutesPerPeriod
      break
    case '30d':
      weeklyMinutes = minutesPerPeriod / 4.3 // ~4.3 weeks per month
      break
    case 'all':
      // For "all time", assume it's roughly 30 days of data
      weeklyMinutes = minutesPerPeriod / 4.3
      break
    default:
      weeklyMinutes = minutesPerPeriod * 7
  }
  
  const yearlyMinutes = weeklyMinutes * 52
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
    case '7d': return 'this week'
    case '30d': return 'this month'
    case 'all': return 'all time'
    default: return 'today'
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
