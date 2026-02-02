import { useState } from 'react'
import type { Period } from './PeriodSelector'
import './TopDistractionsCard.css'

interface DistractionSite {
  domain: string
  timeSpent: number // in minutes
  source: 'web' | 'app'
  bundleId?: string
}

interface TopDistractionsCardProps {
  sites: DistractionSite[]
  period: Period
  onBlock?: (domain: string, source: 'web' | 'app', bundleId?: string) => void
}

// Calculate yearly projection from period data
function calculateYearlyDays(minutesPerPeriod: number, period: Period): number {
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
      periodDays = 365
      break
    default:
      periodDays = 1
  }
  
  // Calculate daily average, then extrapolate to yearly
  const dailyAverage = minutesPerPeriod / periodDays
  const yearlyMinutes = dailyAverage * 365
  return Math.round(yearlyMinutes / 60 / 24)
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

function getPeriodSuffix(period: Period): string {
  switch (period) {
    case 'today': return '/day'
    case '7days': return '/week'
    case '30days': return '/month'
    case '90days': return '/3mo'
    case '180days': return '/6mo'
    case '365days': return '/year'
    case 'all': return ' total'
    default: return ''
  }
}

export function TopDistractionsCard({ sites, period, onBlock }: TopDistractionsCardProps) {
  const [blockedDomains, setBlockedDomains] = useState<Set<string>>(new Set())
  
  // Sort by time spent descending, take top 5
  const topDistractions = [...sites]
    .sort((a, b) => b.timeSpent - a.timeSpent)
    .slice(0, 5)
  
  // Calculate total time if all blocked
  const totalYearlyDays = topDistractions.reduce((sum, site) => {
    if (!blockedDomains.has(site.domain)) {
      return sum + calculateYearlyDays(site.timeSpent, period)
    }
    return sum
  }, 0)
  
  const handleBlock = (site: DistractionSite) => {
    setBlockedDomains(prev => new Set(prev).add(site.domain))
    onBlock?.(site.domain, site.source, site.bundleId)
  }
  
  if (topDistractions.length === 0) {
    return (
      <div className="top-distractions">
        <h3 className="top-distractions__title">Your Top Distractions</h3>
        <div className="top-distractions__empty">
          <span className="top-distractions__empty-icon">✨</span>
          <p>No distractions detected!</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="top-distractions">
      <h3 className="top-distractions__title">Your Top Distractions</h3>
      
      <div className="top-distractions__list">
        {topDistractions.map((site, index) => {
          const yearlyDays = calculateYearlyDays(site.timeSpent, period)
          const isBlocked = blockedDomains.has(site.domain)
          
          return (
            <div 
              key={site.domain} 
              className={`top-distractions__item ${isBlocked ? 'top-distractions__item--blocked' : ''}`}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="top-distractions__rank">{index + 1}</div>
              
              <div className="top-distractions__icon">
                {site.source === 'app' ? '📱' : '🌐'}
              </div>
              
              <div className="top-distractions__info">
                <span className="top-distractions__domain">{site.domain}</span>
                <span className="top-distractions__time">
                  {formatDuration(site.timeSpent)}{getPeriodSuffix(period)}
                </span>
              </div>
              
              <div className="top-distractions__projection">
                ≈ {yearlyDays} days/year
              </div>
              
              <button
                className={`top-distractions__block-btn ${isBlocked ? 'top-distractions__block-btn--blocked' : ''}`}
                onClick={() => handleBlock(site)}
                disabled={isBlocked}
              >
                {isBlocked ? '✓ Blocked' : 'Block'}
              </button>
            </div>
          )
        })}
      </div>
      
      {topDistractions.length > 0 && totalYearlyDays > 0 && (
        <div className="top-distractions__summary">
          <span className="top-distractions__summary-icon">💡</span>
          <span className="top-distractions__summary-text">
            Block {blockedDomains.size > 0 ? 'the rest' : `these ${topDistractions.length}`} = reclaim <strong>~{totalYearlyDays} days/year</strong>
          </span>
        </div>
      )}
    </div>
  )
}
