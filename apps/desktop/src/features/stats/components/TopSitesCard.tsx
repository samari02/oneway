import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { CustomBlockingRule } from '@oneway/shared'
import { domainMatchesActiveBlockingRules } from '../../boundaries/api/customBlockingRules'
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
  /** Called after local visits/blocks for a web domain are deleted (refresh stats upstream). */
  onSiteDataDeleted?: () => void
  /** Adds a custom URL/search rule (Boundaries → Blocking). Web-only. */
  onAddDomainToBlockList?: (domain: string) => Promise<void>
  /** Active custom rules (for “Blocked” badge on web rows). */
  blockingRules?: CustomBlockingRule[]
  /** Card heading (default: Top Sites). */
  title?: string
  /** Adds an “All” option to the display limit menu. */
  allowShowAll?: boolean
}

type DisplayLimit = 10 | 20 | 30 | 'all'
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

export function TopSitesCard({ sites, period, defaultPeriod, onPeriodChange, onClassificationSave, showSourceFilter = false, onSiteDataDeleted, onAddDomainToBlockList, blockingRules, title = 'Top Sites', allowShowAll = false }: TopSitesCardProps) {
  const [displayLimit, setDisplayLimit] = useState<DisplayLimit>(allowShowAll ? 'all' : 10)
  const [deletingDomain, setDeletingDomain] = useState<string | null>(null)
  const [addingToBlockDomain, setAddingToBlockDomain] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [isLimitMenuOpen, setIsLimitMenuOpen] = useState(false)
  const [isClassificationModalOpen, setIsClassificationModalOpen] = useState(false)
  const [reclassifyDropdownOpen, setReclassifyDropdownOpen] = useState<string | null>(null)
  const [webActionsOpen, setWebActionsOpen] = useState<string | null>(null)
  const limitMenuRef = useRef<HTMLDivElement>(null)
  const reclassifyRef = useRef<HTMLDivElement>(null)
  const webActionsRef = useRef<HTMLDivElement>(null)
  
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
  
  const displayedSites = displayLimit === 'all' ? filteredSites : filteredSites.slice(0, displayLimit)
  const maxVisits = Math.max(...displayedSites.map(s => s.visits), 1) // Ensure at least 1 to avoid division by 0

  const isWebDomainOnBlockList = useMemo(
    () => (domain: string) => domainMatchesActiveBlockingRules(domain, blockingRules ?? []),
    [blockingRules]
  )

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (limitMenuRef.current && !limitMenuRef.current.contains(event.target as Node)) {
        setIsLimitMenuOpen(false)
      }
      if (reclassifyRef.current && !reclassifyRef.current.contains(event.target as Node)) {
        setReclassifyDropdownOpen(null)
      }
      if (webActionsRef.current && !webActionsRef.current.contains(event.target as Node)) {
        setWebActionsOpen(null)
      }
    }

    if (isLimitMenuOpen || reclassifyDropdownOpen || webActionsOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isLimitMenuOpen, reclassifyDropdownOpen, webActionsOpen])

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

  const handleDeleteWebSite = async (domain: string) => {
    if (!confirm(`Remove all visits and block history stored locally for “${domain}”? This cannot be undone.`)) {
      return
    }
    setDeletingDomain(domain)
    setWebActionsOpen(null)
    try {
      await invoke<unknown>('delete_browsing_data_for_domain', { domain })
      onSiteDataDeleted?.()
    } catch (e) {
      console.error('[TopSitesCard] delete_browsing_data_for_domain:', e)
      alert(`Could not delete: ${e}`)
    } finally {
      setDeletingDomain(null)
    }
  }

  const handleAddToBlockList = async (domain: string) => {
    if (!onAddDomainToBlockList) return
    setAddingToBlockDomain(domain)
    try {
      await onAddDomainToBlockList(domain)
      setWebActionsOpen(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not add to block list')
    } finally {
      setAddingToBlockDomain(null)
    }
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
          <span className="top-sites-card__limit-text">
            {displayLimit === 'all' ? 'All' : `Top ${displayLimit}`}
          </span>
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
            {allowShowAll && (
              <button
                className={`top-sites-card__limit-item ${
                  displayLimit === 'all' ? 'top-sites-card__limit-item--active' : ''
                }`}
                onClick={() => {
                  setDisplayLimit('all')
                  setIsLimitMenuOpen(false)
                }}
              >
                All ({filteredSites.length})
                {displayLimit === 'all' && <span className="top-sites-card__limit-check">✓</span>}
              </button>
            )}
          </div>
        )}
      </div>
      
      <div className="top-sites-card__header">
        <h3 className="top-sites-card__title">{title}</h3>
        
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
          const onBlockList =
            site.source === 'web' && isWebDomainOnBlockList(site.domain)
          return (
          <div 
            key={`${site.source}-${site.domain}`} 
            className={`top-sites-card__item${onBlockList ? ' top-sites-card__item--on-blocklist' : ''}`}
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
                <div className="top-sites-card__domain-line">
                  <span className="top-sites-card__domain">{site.domain}</span>
                  {onBlockList && (
                    <span className="top-sites-card__blocked-badge" title="Matches your block list">
                      Blocked
                    </span>
                  )}
                </div>
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
            {site.source === 'web' && (
              <div
                className="top-sites-card__web-actions"
                ref={webActionsOpen === site.domain ? webActionsRef : undefined}
              >
                <button
                  type="button"
                  className="top-sites-card__actions-trigger"
                  aria-expanded={webActionsOpen === site.domain}
                  aria-haspopup="menu"
                  title="Site actions"
                  onClick={(e) => {
                    e.stopPropagation()
                    setWebActionsOpen(webActionsOpen === site.domain ? null : site.domain)
                  }}
                >
                  ⋯
                </button>
                {webActionsOpen === site.domain && (
                  <div className="top-sites-card__actions-dropdown" role="menu">
                    {onAddDomainToBlockList && (
                      <button
                        type="button"
                        role="menuitem"
                        className="top-sites-card__actions-item"
                        disabled={onBlockList || addingToBlockDomain === site.domain}
                        onClick={() => void handleAddToBlockList(site.domain)}
                      >
                        {addingToBlockDomain === site.domain
                          ? 'Adding…'
                          : onBlockList
                            ? 'Already on block list'
                            : 'Add to block list'}
                      </button>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      className="top-sites-card__actions-item top-sites-card__actions-item--danger"
                      disabled={deletingDomain === site.domain}
                      onClick={() => void handleDeleteWebSite(site.domain)}
                    >
                      {deletingDomain === site.domain ? 'Deleting…' : 'Delete stored data'}
                    </button>
                  </div>
                )}
              </div>
            )}
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
