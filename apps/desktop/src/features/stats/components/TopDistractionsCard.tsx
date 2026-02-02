import { useState, useMemo } from 'react'
import type { Period } from './PeriodSelector'
import './TopDistractionsCard.css'

interface DistractionSite {
  domain: string
  timeSpent: number // in minutes
  source: 'web' | 'app'
  bundleId?: string
}

interface TopDistractionsCardProps {
  sites: DistractionSite[]  // Display data (based on selected period)
  period: Period
  // Projection data (based on ALL available data)
  projectionSites: DistractionSite[]
  projectionDays: number  // Actual days of data available
  onBlock?: (domain: string, source: 'web' | 'app', bundleId?: string) => void
}

// Calculate yearly projection from all-time data
function calculateYearlyDays(totalMinutes: number, totalDays: number): number {
  const dailyAverage = totalMinutes / Math.max(1, totalDays)
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

export function TopDistractionsCard({ sites, period, projectionSites, projectionDays, onBlock }: TopDistractionsCardProps) {
  const [blockedDomains, setBlockedDomains] = useState<Set<string>>(new Set())
  
  // Sort by time spent descending, take top 5 (display data from selected period)
  const topDistractions = [...sites]
    .sort((a, b) => b.timeSpent - a.timeSpent)
    .slice(0, 5)
  
  // Create a map of projection data by domain (all-time data for accurate yearly estimates)
  const projectionByDomain = useMemo(() => {
    const map = new Map<string, number>()
    for (const site of projectionSites) {
      map.set(site.domain, site.timeSpent)
    }
    return map
  }, [projectionSites])
  
  // Calculate total yearly days using ALL-TIME data (not period-based)
  const totalYearlyDays = topDistractions.reduce((sum, site) => {
    if (!blockedDomains.has(site.domain)) {
      const allTimeMinutes = projectionByDomain.get(site.domain) || site.timeSpent
      return sum + calculateYearlyDays(allTimeMinutes, projectionDays)
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
          // Use ALL-TIME data for yearly projection (stable, accurate)
          const allTimeMinutes = projectionByDomain.get(site.domain) || site.timeSpent
          const yearlyDays = calculateYearlyDays(allTimeMinutes, projectionDays)
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
