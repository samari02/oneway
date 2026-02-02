import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAppUsage, formatDuration } from '../../app-blocking/hooks/useAppUsage'
import type { Period } from './PeriodSelector'
import './AppsTab.css'

interface AppsTabProps {
  period: Period
}

// Map period to app usage period string (must match Rust backend)
function mapPeriodToAppUsage(period: Period): string {
  // Backend expects: "today" | "7days" | "30days" | "90days" | "all"
  switch (period) {
    case 'today': return 'today'
    case '7days': return '7days'
    case '30days': return '30days'
    case '90days': return '90days'
    case '180days': return '90days'  // Fallback to 90 days (not supported in backend)
    case '365days': return 'all'     // Fallback to all
    case 'all': return 'all'
    default: return 'today'
  }
}

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

// Get fallback emoji based on app name
function getAppEmoji(appName: string): string {
  const name = appName.toLowerCase()
  if (name.includes('chrome') || name.includes('safari') || name.includes('firefox')) return '🌐'
  if (name.includes('code') || name.includes('cursor') || name.includes('xcode')) return '💻'
  if (name.includes('slack') || name.includes('teams')) return '💼'
  if (name.includes('discord')) return '🎮'
  if (name.includes('spotify') || name.includes('music')) return '🎵'
  if (name.includes('mail') || name.includes('outlook')) return '📧'
  if (name.includes('zoom') || name.includes('meet')) return '📹'
  if (name.includes('notes') || name.includes('notion')) return '📝'
  if (name.includes('terminal') || name.includes('iterm')) return '⬛'
  if (name.includes('finder')) return '📁'
  return '📦'
}

export function AppsTab({ period }: AppsTabProps) {
  const { stats, loading, error, refetch } = useAppUsage(mapPeriodToAppUsage(period))
  const { icons, fetchIcon } = useAppIcons()
  
  // Fetch icons for all apps
  useEffect(() => {
    stats.apps.forEach(app => fetchIcon(app.bundle_id))
  }, [stats.apps, fetchIcon])
  
  if (loading) {
    return (
      <div className="apps-tab">
        <div className="apps-tab__loading">
          <div className="apps-tab__loading-spinner" />
          <p>Loading app usage...</p>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="apps-tab">
        <div className="apps-tab__error">
          <p>Failed to load app usage. Please try again.</p>
          <button onClick={refetch} className="apps-tab__retry-btn">
            Retry
          </button>
        </div>
      </div>
    )
  }
  
  if (stats.apps.length === 0) {
    return (
      <div className="apps-tab">
        <div className="apps-tab__empty">
          <div className="apps-tab__empty-icon">📱</div>
          <h3>No app usage tracked yet</h3>
          <p>Enable app tracking in Settings to see your app usage statistics</p>
        </div>
      </div>
    )
  }
  
  // Calculate category breakdown (simplified)
  const categorize = (appName: string): 'productive' | 'neutral' | 'distraction' => {
    const name = appName.toLowerCase()
    if (name.includes('code') || name.includes('cursor') || name.includes('xcode') || 
        name.includes('terminal') || name.includes('iterm')) return 'productive'
    if (name.includes('discord') || name.includes('spotify') || name.includes('music') ||
        name.includes('game')) return 'distraction'
    return 'neutral'
  }
  
  const categoryBreakdown = stats.apps.reduce((acc, app) => {
    const cat = categorize(app.app_name)
    acc[cat] = (acc[cat] || 0) + app.total_time_ms
    return acc
  }, {} as Record<string, number>)
  
  const totalMs = stats.total_time_ms || 1
  const productivePercent = Math.round((categoryBreakdown.productive || 0) / totalMs * 100)
  const neutralPercent = Math.round((categoryBreakdown.neutral || 0) / totalMs * 100)
  const distractionPercent = Math.round((categoryBreakdown.distraction || 0) / totalMs * 100)
  
  return (
    <div className="apps-tab">
      <div className="apps-tab__content">
        {/* Summary Card */}
        <section className="apps-tab__summary">
          <div className="apps-tab__summary-header">
            <h3>Total App Time</h3>
            <span className="apps-tab__summary-value">{formatDuration(stats.total_time_ms)}</span>
          </div>
          
          {/* Time Distribution Bar */}
          <div className="apps-tab__distribution">
            <div className="apps-tab__distribution-bar">
              <div 
                className="apps-tab__distribution-segment apps-tab__distribution-segment--productive"
                style={{ width: `${productivePercent}%` }}
                title={`Productive: ${productivePercent}%`}
              />
              <div 
                className="apps-tab__distribution-segment apps-tab__distribution-segment--neutral"
                style={{ width: `${neutralPercent}%` }}
                title={`Neutral: ${neutralPercent}%`}
              />
              <div 
                className="apps-tab__distribution-segment apps-tab__distribution-segment--distraction"
                style={{ width: `${distractionPercent}%` }}
                title={`Distraction: ${distractionPercent}%`}
              />
            </div>
            <div className="apps-tab__distribution-legend">
              <span className="apps-tab__legend-item">
                <span className="apps-tab__legend-dot apps-tab__legend-dot--productive" />
                Productive {productivePercent}%
              </span>
              <span className="apps-tab__legend-item">
                <span className="apps-tab__legend-dot apps-tab__legend-dot--neutral" />
                Neutral {neutralPercent}%
              </span>
              <span className="apps-tab__legend-item">
                <span className="apps-tab__legend-dot apps-tab__legend-dot--distraction" />
                Distraction {distractionPercent}%
              </span>
            </div>
          </div>
        </section>
        
        {/* App List */}
        <section className="apps-tab__section">
          <h3 className="apps-tab__section-title">
            Apps Used ({stats.apps.length})
          </h3>
          <div className="apps-tab__app-list">
            {stats.apps.map((app, index) => {
              const appIcon = icons[app.bundle_id]
              return (
                <div key={app.bundle_id} className="apps-tab__app-item">
                  <span className="apps-tab__app-rank">{index + 1}</span>
                  <span className="apps-tab__app-icon">
                    {appIcon ? (
                      <img src={appIcon} alt="" className="apps-tab__app-icon-img" />
                    ) : (
                      getAppEmoji(app.app_name)
                    )}
                  </span>
                  <div className="apps-tab__app-info">
                    <span className="apps-tab__app-name">{app.app_name}</span>
                    <div className="apps-tab__app-bar-container">
                      <div 
                        className="apps-tab__app-bar"
                        style={{ width: `${Math.min(app.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="apps-tab__app-time">{formatDuration(app.total_time_ms)}</span>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
