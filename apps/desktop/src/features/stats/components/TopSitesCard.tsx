import { useState } from 'react'
import type { SiteVisit } from '../hooks/useBrowsingStats'
import './TopSitesCard.css'

interface TopSitesCardProps {
  sites: SiteVisit[]
}

export function TopSitesCard({ sites }: TopSitesCardProps) {
  const [showAll, setShowAll] = useState(false)
  
  const displayedSites = showAll ? sites : sites.slice(0, 5)
  const maxVisits = Math.max(...sites.map(s => s.visits))

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
      <div className="top-sites-card__header">
        <h3 className="top-sites-card__title">Top Sites</h3>
        {sites.length > 5 && (
          <button 
            className="top-sites-card__toggle"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Show less' : `View all (${sites.length})`}
          </button>
        )}
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
