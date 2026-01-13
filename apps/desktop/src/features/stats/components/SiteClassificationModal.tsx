import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import './SiteClassificationModal.css'

export type SiteCategory = 'productive' | 'neutral' | 'distraction'

export interface SiteClassification {
  domain: string
  visits: number
  category: SiteCategory | null // null = unclassified
}

interface SiteClassificationModalProps {
  isOpen: boolean
  onClose: () => void
  sites: SiteClassification[]
  onSave: (classifications: Record<string, SiteCategory>) => void
}

export function SiteClassificationModal({ 
  isOpen, 
  onClose, 
  sites,
  onSave 
}: SiteClassificationModalProps) {
  const [classifications, setClassifications] = useState<Record<string, SiteCategory | null>>({})
  const [loading, setLoading] = useState(true)
  
  // Load existing classifications from backend when modal opens
  useEffect(() => {
    if (!isOpen) return
    
    const loadExisting = async () => {
      setLoading(true)
      try {
        const existing = await invoke<Record<string, string>>('get_site_classifications')
        
        // Initialize with null for all sites, then override with existing classifications
        const initial: Record<string, SiteCategory | null> = {}
        sites.forEach(site => {
          const savedCategory = existing[site.domain]
          if (savedCategory === 'productive' || savedCategory === 'neutral' || savedCategory === 'distraction') {
            initial[site.domain] = savedCategory
          } else {
            initial[site.domain] = null // Not classified yet
          }
        })
        setClassifications(initial)
      } catch (e) {
        console.error('[Classification] Failed to load existing:', e)
        // Fallback: all null
        const initial: Record<string, SiteCategory | null> = {}
        sites.forEach(site => {
          initial[site.domain] = null
        })
        setClassifications(initial)
      } finally {
        setLoading(false)
      }
    }
    
    loadExisting()
  }, [isOpen, sites])

  if (!isOpen) return null

  const handleCategoryChange = (domain: string, category: SiteCategory) => {
    setClassifications(prev => ({
      ...prev,
      [domain]: prev[domain] === category ? null : category // Toggle off if same
    }))
  }

  const handleSave = () => {
    // Filter out null values
    const toSave: Record<string, SiteCategory> = {}
    Object.entries(classifications).forEach(([domain, category]) => {
      if (category) {
        toSave[domain] = category
      }
    })
    
    console.log('[Classification Modal] Current state:', classifications)
    console.log('[Classification Modal] Saving:', toSave)
    console.log('[Classification Modal] Count:', Object.keys(toSave).length)
    
    if (Object.keys(toSave).length === 0) {
      console.warn('[Classification Modal] Nothing to save!')
    }
    
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
                    />
                  </td>
                  <td className="site-classification-modal__td-cat">
                    <button
                      className={`site-classification-modal__radio ${
                        classifications[site.domain] === 'neutral' 
                          ? 'site-classification-modal__radio--active site-classification-modal__radio--neutral' 
                          : ''
                      }`}
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
      </div>
    </div>
  )
}
