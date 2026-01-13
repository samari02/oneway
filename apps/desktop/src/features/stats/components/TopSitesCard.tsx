import { useState, useRef, useEffect } from 'react'
import type { SiteVisit } from '../hooks/useBrowsingStats'
import { CardPeriodMenu } from './CardPeriodMenu'
import type { Period } from './PeriodSelector'
import { SiteClassificationModal, type SiteClassification, type SiteCategory } from './SiteClassificationModal'
import './TopSitesCard.css'

interface TopSitesCardProps {
  sites: SiteVisit[]
  period?: Period
  defaultPeriod: Period
  onPeriodChange?: (period: Period | null) => void
  onClassificationSave?: (classifications: Record<string, SiteCategory>) => void
}

type DisplayLimit = 10 | 20 | 30
type CategoryFilter = 'all' | 'productive' | 'neutral' | 'distraction'

export function TopSitesCard({ sites, period, defaultPeriod, onPeriodChange, onClassificationSave }: TopSitesCardProps) {
  const [displayLimit, setDisplayLimit] = useState<DisplayLimit>(10)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [isLimitMenuOpen, setIsLimitMenuOpen] = useState(false)
  const [isClassificationModalOpen, setIsClassificationModalOpen] = useState(false)
  const limitMenuRef = useRef<HTMLDivElement>(null)
  
  // Filter by category first, then slice by limit
  const filteredSites = categoryFilter === 'all' 
    ? sites 
    : sites.filter(s => s.category === categoryFilter)
  
  const displayedSites = filteredSites.slice(0, displayLimit)
  const maxVisits = Math.max(...displayedSites.map(s => s.visits), 1) // Ensure at least 1 to avoid division by 0
  
  console.log('[TopSitesCard] Total:', sites.length, 'Filtered:', filteredSites.length, 'Category:', categoryFilter, 'Limit:', displayLimit)

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

  // Category indicator dot color class
  const getCategoryClass = (category: SiteVisit['category']) => {
    switch (category) {
      case 'productive': return 'top-sites-card__dot--productive'
      case 'distraction': return 'top-sites-card__dot--distraction'
      default: return 'top-sites-card__dot--neutral'
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
      
      {/* Limit selector - positioned absolute like period menu */}
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
      
      <div className="top-sites-card__header">
        <h3 className="top-sites-card__title">Top Sites</h3>
        
        {/* Category filter pills */}
        <div className="top-sites-card__filters">
          {(['all', 'productive', 'neutral', 'distraction'] as CategoryFilter[]).map((cat) => (
            <button
              key={cat}
              className={`top-sites-card__filter-pill ${
                categoryFilter === cat ? 'top-sites-card__filter-pill--active' : ''
              } top-sites-card__filter-pill--${cat}`}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat !== 'all' && <span className={`top-sites-card__filter-dot top-sites-card__filter-dot--${cat}`} />}
              {cat === 'all' ? 'all' : cat === 'productive' ? 'focus' : cat}
            </button>
          ))}
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
                <span className={`top-sites-card__dot ${getCategoryClass(site.category)}`} />
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

      {/* Improve classification button */}
      <button
        className="top-sites-card__classify-btn"
        onClick={() => setIsClassificationModalOpen(true)}
      >
        <span className="top-sites-card__classify-icon">★</span>
        Improve classification
      </button>

      {/* Classification modal */}
      <SiteClassificationModal
        isOpen={isClassificationModalOpen}
        onClose={() => setIsClassificationModalOpen(false)}
        sites={sites.map((s): SiteClassification => ({
          domain: s.domain,
          visits: s.visits,
          category: s.category === 'productive' || s.category === 'distraction' ? s.category : 'neutral'
        }))}
        onSave={(classifications) => {
          console.log('[TopSitesCard] Classifications saved:', classifications)
          onClassificationSave?.(classifications)
        }}
      />
    </div>
  )
}
