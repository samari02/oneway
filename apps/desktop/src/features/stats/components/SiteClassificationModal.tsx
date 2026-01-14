import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import './SiteClassificationModal.css'

export type SiteCategory = 'productive' | 'neutral' | 'distraction'

export interface SiteClassification {
  domain: string
  visits: number
  category: SiteCategory | null // null = unclassified
}

// Backend response type for browsing stats
interface BrowsingStatsResponse {
  topSites: Array<{
    domain: string
    visits: number
    timeSpent: number
    category: string
  }>
}

interface SiteClassificationModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (classifications: Record<string, SiteCategory>) => void
}

export function SiteClassificationModal({ 
  isOpen, 
  onClose, 
  onSave 
}: SiteClassificationModalProps) {
  const [sites, setSites] = useState<SiteClassification[]>([])
  const [classifications, setClassifications] = useState<Record<string, SiteCategory | null>>({})
  const [loading, setLoading] = useState(true)
  
  // Map backend category to frontend category
  const mapBackendCategory = (category: string): SiteCategory => {
    switch (category) {
      case 'productive':
      case 'work':
      case 'dev':
      case 'productivity':
        return 'productive'
      case 'distraction':
      case 'social_media':
      case 'video':
      case 'entertainment':
      case 'news':
      case 'shopping':
        return 'distraction'
      default:
        return 'neutral'
    }
  }

  // Fetch ALL sites and existing classifications when modal opens
  useEffect(() => {
    if (!isOpen) return
    
    const loadData = async () => {
      setLoading(true)
      try {
        // Fetch ALL sites (no period filter) and existing classifications in parallel
        const [statsResponse, userOverrides] = await Promise.all([
          invoke<BrowsingStatsResponse>('get_browsing_stats', { periodDays: null }),
          invoke<Record<string, string>>('get_site_classifications')
        ])
        
        // Build sites list from all-time data
        const allSites: SiteClassification[] = statsResponse.topSites.map(site => ({
          domain: site.domain,
          visits: site.visits,
          category: null
        }))
        
        setSites(allSites)
        
        // Initialize classifications: user override > automatic classification
        const initial: Record<string, SiteCategory | null> = {}
        
        statsResponse.topSites.forEach(site => {
          // Check if user has manually overridden this site
          const userOverride = userOverrides[site.domain]
          if (userOverride === 'productive' || userOverride === 'neutral' || userOverride === 'distraction') {
            // Use user's manual classification
            initial[site.domain] = userOverride
          } else {
            // Use automatic classification from backend
            initial[site.domain] = mapBackendCategory(site.category)
          }
        })
        setClassifications(initial)
      } catch (e) {
        console.error('[Classification Modal] Failed to load data:', e)
        setSites([])
        setClassifications({})
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [isOpen])

  if (!isOpen) return null

  const handleCategoryChange = (domain: string, category: SiteCategory) => {
    setClassifications(prev => ({
      ...prev,
      [domain]: prev[domain] === category ? null : category // Toggle off if same
    }))
  }

  const handleSave = () => {
    // Save all classifications (both auto and manual adjustments)
    const toSave: Record<string, SiteCategory> = {}
    Object.entries(classifications).forEach(([domain, category]) => {
      if (category) {
        toSave[domain] = category
      }
    })
    
    onSave(toSave)
    onClose()
  }

  // Calculate progress
  const totalVisits = sites.reduce((sum, s) => sum + s.visits, 0)
  const classifiedVisits = sites
    .filter(s => classifications[s.domain])
    .reduce((sum, s) => sum + s.visits, 0)
  const progressPercent = totalVisits > 0 
    ? Math.round((classifiedVisits / totalVisits) * 100) 
    : 0

  // Sort by visits descending
  const sortedSites = [...sites].sort((a, b) => b.visits - a.visits)

  return (
    <div className="site-classification-modal__overlay" onClick={onClose}>
      <div className="site-classification-modal" onClick={e => e.stopPropagation()}>
        <div className="site-classification-modal__header">
          <h2 className="site-classification-modal__title">Site Classification</h2>
          <button className="site-classification-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        {loading ? (
          <div className="site-classification-modal__loading">
            <p>Loading sites...</p>
          </div>
        ) : sites.length === 0 ? (
          <div className="site-classification-modal__empty">
            <p>No browsing data available yet.</p>
          </div>
        ) : (
          <>
        <div className="site-classification-modal__intro">
          <p>Classify your top sites to improve focus accuracy</p>
          
          <div className="site-classification-modal__progress">
            <span className="site-classification-modal__progress-text">
              {progressPercent}% of browsing classified
            </span>
            <div className="site-classification-modal__progress-bar">
              <div 
                className="site-classification-modal__progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="site-classification-modal__table-wrapper">
          <table className="site-classification-modal__table">
            <thead>
              <tr>
                <th className="site-classification-modal__th-site">Site</th>
                <th className="site-classification-modal__th-visits">Visits</th>
                <th className="site-classification-modal__th-cat site-classification-modal__th-productive">
                  <span className="site-classification-modal__label site-classification-modal__label--productive">
                    🎯 Focus
                  </span>
                </th>
                <th className="site-classification-modal__th-cat site-classification-modal__th-neutral">
                  <span className="site-classification-modal__label site-classification-modal__label--neutral">
                    ⚪ Neutral
                  </span>
                </th>
                <th className="site-classification-modal__th-cat site-classification-modal__th-distraction">
                  <span className="site-classification-modal__label site-classification-modal__label--distraction">
                    🔥 Distraction
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedSites.map(site => (
                <tr key={site.domain} className="site-classification-modal__row">
                  <td className="site-classification-modal__td-site">
                    {site.domain}
                  </td>
                  <td className="site-classification-modal__td-visits">
                    {site.visits}
                  </td>
                  <td className="site-classification-modal__td-cat">
                    <button
                      className={`site-classification-modal__radio ${
                        classifications[site.domain] === 'productive' 
                          ? 'site-classification-modal__radio--active site-classification-modal__radio--productive' 
                          : ''
                      }`}
                      onClick={() => handleCategoryChange(site.domain, 'productive')}
                      style={classifications[site.domain] === 'productive' ? { background: '#5BB5A0' } : {}}
                    />
                  </td>
                  <td className="site-classification-modal__td-cat">
                    <button
                      className={`site-classification-modal__radio ${
                        classifications[site.domain] === 'neutral' 
                          ? 'site-classification-modal__radio--active site-classification-modal__radio--neutral' 
                          : ''
                      }`}
                      style={classifications[site.domain] === 'neutral' ? { background: '#8E99A8' } : {}}
                      onClick={() => handleCategoryChange(site.domain, 'neutral')}
                    />
                  </td>
                  <td className="site-classification-modal__td-cat">
                    <button
                      className={`site-classification-modal__radio ${
                        classifications[site.domain] === 'distraction' 
                          ? 'site-classification-modal__radio--active site-classification-modal__radio--distraction' 
                          : ''
                      }`}
                      onClick={() => handleCategoryChange(site.domain, 'distraction')}
                      style={classifications[site.domain] === 'distraction' ? { background: '#E74C3C' } : {}}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="site-classification-modal__footer">
          <button 
            className="site-classification-modal__btn site-classification-modal__btn--cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className="site-classification-modal__btn site-classification-modal__btn--save"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
          </>
        )}
      </div>
    </div>
  )
}
