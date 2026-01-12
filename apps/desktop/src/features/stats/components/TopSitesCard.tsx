import { useState, useRef, useEffect } from 'react'
import type { SiteVisit } from '../hooks/useBrowsingStats'
import { CardPeriodMenu } from './CardPeriodMenu'
import type { Period } from './PeriodSelector'
import './TopSitesCard.css'

interface TopSitesCardProps {
  sites: SiteVisit[]
  period?: Period
  defaultPeriod: Period
  onPeriodChange?: (period: Period | null) => void
}

type DisplayLimit = 10 | 20 | 30

export function TopSitesCard({ sites, period, defaultPeriod, onPeriodChange }: TopSitesCardProps) {
  const [displayLimit, setDisplayLimit] = useState<DisplayLimit>(10)
  const [isLimitMenuOpen, setIsLimitMenuOpen] = useState(false)
  const limitMenuRef = useRef<HTMLDivElement>(null)
  
  const displayedSites = sites.slice(0, displayLimit)
  const maxVisits = Math.max(...sites.map(s => s.visits))

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (limitMenuRef.current && !limitMenuRef.current.contains(event.target as Node)) {
        setIsLimitMenuOpen(false)
      }
    }

    if (isLimitMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isLimitMenuOpen])

  const getCategoryEmoji = (category: SiteVisit['category']) => {
    switch (category) {
      case 'productive': return '✨'
      case 'distraction': return '🔥'
      default: return '🌙'
    }
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  return (
    <div className="top-sites-card">
      {onPeriodChange && (
        <CardPeriodMenu
          currentPeriod={period}
          defaultPeriod={defaultPeriod}
          onPeriodChange={onPeriodChange}
        />
      )}
      <div className="top-sites-card__header">
        <h3 className="top-sites-card__title">Top Sites</h3>
        
        {/* Limit selector */}
        <div className="top-sites-card__limit-menu" ref={limitMenuRef}>
          <button
            className="top-sites-card__limit-trigger"
            onClick={() => setIsLimitMenuOpen(!isLimitMenuOpen)}
          >
            <span className="top-sites-card__limit-text">Top {displayLimit}</span>
            <span className="top-sites-card__limit-icon">▼</span>
          </button>

          {isLimitMenuOpen && (
            <div className="top-sites-card__limit-dropdown">
              <div className="top-sites-card__limit-header">Display</div>
              {[10, 20, 30].map((limit) => (
                <button
                  key={limit}
                  className={`top-sites-card__limit-item ${
                    displayLimit === limit ? 'top-sites-card__limit-item--active' : ''
                  }`}
                  onClick={() => {
                    setDisplayLimit(limit as DisplayLimit)
                    setIsLimitMenuOpen(false)
                  }}
                >
                  Top {limit}
                  {displayLimit === limit && <span className="top-sites-card__limit-check">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="top-sites-card__list">
        {displayedSites.map((site, index) => (
          <div 
            key={site.domain} 
            className="top-sites-card__item"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="top-sites-card__rank">{index + 1}</div>
            
            <div className="top-sites-card__info">
              <div className="top-sites-card__domain-row">
                <span className="top-sites-card__category-emoji">
                  {getCategoryEmoji(site.category)}
                </span>
                <span className="top-sites-card__domain">{site.domain}</span>
              </div>
              
              <div className="top-sites-card__bar-container">
                <div 
                  className={`top-sites-card__bar top-sites-card__bar--${site.category}`}
                  style={{ width: `${(site.visits / maxVisits) * 100}%` }}
                />
              </div>
            </div>

            <div className="top-sites-card__stats">
              <span className="top-sites-card__visits">{site.visits}</span>
              <span className="top-sites-card__time">{formatTime(site.timeSpent)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
