import { useState, useRef, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { SiteVisit } from '../hooks/useBrowsingStats'
import { CardPeriodMenu } from './CardPeriodMenu'
import type { Period } from './PeriodSelector'
import { SiteClassificationModal, type SiteCategory } from './SiteClassificationModal'
import './TopSitesCard.css'

interface TopSitesCardProps {
  sites: SiteVisit[]
  period?: Period
  defaultPeriod: Period
  onPeriodChange?: (period: Period | null) => void
  onClassificationSave?: (classifications: Record<string, SiteCategory>) => void
  showSourceFilter?: boolean // Show All/Web/Apps filter
}

type DisplayLimit = 10 | 20 | 30
type CategoryFilter = 'all' | 'productive' | 'neutral' | 'distraction'
type SourceFilter = 'all' | 'web' | 'app'

// Hook to fetch and cache app icons
function useAppIcons() {
  const [icons, setIcons] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState<Set<string>>(new Set())

  const fetchIcon = useCallback(async (bundleId: string) => {
    if (bundleId in icons || loading.has(bundleId)) return
    
    setLoading(prev => new Set(prev).add(bundleId))
    
    try {
      const iconData = await invoke<string | null>('get_app_icon', { bundleId })
      setIcons(prev => ({ ...prev, [bundleId]: iconData }))
    } catch {
      setIcons(prev => ({ ...prev, [bundleId]: null }))
    } finally {
      setLoading(prev => {
        const next = new Set(prev)
        next.delete(bundleId)
        return next
      })
    }
  }, [icons, loading])

  return { icons, fetchIcon }
}

export function TopSitesCard({ sites, period, defaultPeriod, onPeriodChange, onClassificationSave, showSourceFilter = false }: TopSitesCardProps) {
  const [displayLimit, setDisplayLimit] = useState<DisplayLimit>(10)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [isLimitMenuOpen, setIsLimitMenuOpen] = useState(false)
  const [isClassificationModalOpen, setIsClassificationModalOpen] = useState(false)
  const [reclassifyDropdownOpen, setReclassifyDropdownOpen] = useState<string | null>(null)
  const limitMenuRef = useRef<HTMLDivElement>(null)
  const reclassifyRef = useRef<HTMLDivElement>(null)
  
  // App icons
  const { icons, fetchIcon } = useAppIcons()
  
  // Fetch icons for all apps
  useEffect(() => {
    sites.filter(s => s.source === 'app' && s.bundleId).forEach(s => fetchIcon(s.bundleId!))
  }, [sites, fetchIcon])
  
  // Filter by source, then by category, then slice by limit
  const filteredBySource = sourceFilter === 'all' 
    ? sites 
    : sites.filter(s => s.source === sourceFilter)
  
  const filteredSites = categoryFilter === 'all' 
    ? filteredBySource 
    : filteredBySource.filter(s => s.category === categoryFilter)
  
  const displayedSites = filteredSites.slice(0, displayLimit)
  const maxVisits = Math.max(...displayedSites.map(s => s.visits), 1) // Ensure at least 1 to avoid division by 0

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (limitMenuRef.current && !limitMenuRef.current.contains(event.target as Node)) {
        setIsLimitMenuOpen(false)
      }
      if (reclassifyRef.current && !reclassifyRef.current.contains(event.target as Node)) {
        setReclassifyDropdownOpen(null)
      }
    }

    if (isLimitMenuOpen || reclassifyDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isLimitMenuOpen, reclassifyDropdownOpen])

  // Handle reclassify from inline dropdown
  const handleInlineReclassify = (domain: string, newCategory: SiteCategory) => {
    setReclassifyDropdownOpen(null)
    onClassificationSave?.({ [domain]: newCategory })
  }

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
        
        <div className="top-sites-card__filters-row">
          {/* Source filter (All/Web/Apps) */}
          {showSourceFilter && (
            <div className="top-sites-card__source-filter">
              {(['all', 'web', 'app'] as SourceFilter[]).map((src) => (
                <button
                  key={src}
                  className={`top-sites-card__source-btn ${
                    sourceFilter === src ? 'top-sites-card__source-btn--active' : ''
                  }`}
                  onClick={() => setSourceFilter(src)}
                >
                  {src === 'all' ? 'All' : src === 'web' ? 'Web' : 'Apps'}
                </button>
              ))}
            </div>
          )}
          
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
      </div>

      <div className="top-sites-card__list">
        {displayedSites.length === 0 && (
          <div className="top-sites-card__empty">
            No {sourceFilter === 'web' ? 'websites' : sourceFilter === 'app' ? 'apps' : 'sites'} tracked yet
          </div>
        )}
        {displayedSites.map((site, index) => {
          const appIcon = site.bundleId ? icons[site.bundleId] : null
          return (
          <div 
            key={`${site.source}-${site.domain}`} 
            className="top-sites-card__item"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="top-sites-card__rank">{index + 1}</div>
            
            {/* App/Site Icon */}
            <div className="top-sites-card__icon">
              {site.source === 'app' && appIcon ? (
                <img src={appIcon} alt="" className="top-sites-card__app-icon" />
              ) : site.source === 'app' ? (
                <span className="top-sites-card__emoji">📱</span>
              ) : (
                <span className="top-sites-card__emoji">🌐</span>
              )}
            </div>
            
            <div className="top-sites-card__info">
              <div className="top-sites-card__domain-row">
                <div 
                  className="top-sites-card__dot-wrapper"
                  ref={reclassifyDropdownOpen === site.domain ? reclassifyRef : null}
                >
                  <button
                    className={`top-sites-card__dot top-sites-card__dot--clickable ${getCategoryClass(site.category)}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setReclassifyDropdownOpen(reclassifyDropdownOpen === site.domain ? null : site.domain)
                    }}
                    title="Reclassify"
                  />
                  <span className="top-sites-card__reclassify-hint">reclassify</span>
                  
                  {reclassifyDropdownOpen === site.domain && (
                    <div className="top-sites-card__reclassify-dropdown">
                      <button
                        className={`top-sites-card__reclassify-option ${site.category === 'productive' ? 'top-sites-card__reclassify-option--active' : ''}`}
                        onClick={() => handleInlineReclassify(site.domain, 'productive')}
                      >
                        <span className="top-sites-card__dot top-sites-card__dot--productive" />
                        Focus
                      </button>
                      <button
                        className={`top-sites-card__reclassify-option ${site.category === 'neutral' ? 'top-sites-card__reclassify-option--active' : ''}`}
                        onClick={() => handleInlineReclassify(site.domain, 'neutral')}
                      >
                        <span className="top-sites-card__dot top-sites-card__dot--neutral" />
                        Neutral
                      </button>
                      <button
                        className={`top-sites-card__reclassify-option ${site.category === 'distraction' ? 'top-sites-card__reclassify-option--active' : ''}`}
                        onClick={() => handleInlineReclassify(site.domain, 'distraction')}
                      >
                        <span className="top-sites-card__dot top-sites-card__dot--distraction" />
                        Distraction
                      </button>
                    </div>
                  )}
                </div>
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
        )})}
      </div>

      {/* Improve classification button */}
      <button
        className="top-sites-card__classify-btn"
        onClick={() => setIsClassificationModalOpen(true)}
      >
        <span className="top-sites-card__classify-icon">★</span>
        Improve classification
      </button>

      {/* Classification modal - fetches its own data (all sites, all time) */}
      <SiteClassificationModal
        isOpen={isClassificationModalOpen}
        onClose={() => setIsClassificationModalOpen(false)}
        onSave={(classifications) => {
          console.log('[TopSitesCard] Classifications saved:', classifications)
          onClassificationSave?.(classifications)
        }}
      />
    </div>
  )
}
