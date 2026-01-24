import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAppBlocking } from '../hooks/useAppBlocking'
import { useAppUsage, useRunningApps, formatDuration } from '../hooks/useAppUsage'
import './AppBlockingView.css'

// Common apps that users might want to block
const SUGGESTED_APPS = [
  { bundleId: 'com.spotify.client', name: 'Spotify', icon: '🎵' },
  { bundleId: 'com.apple.Safari', name: 'Safari', icon: '🧭' },
  { bundleId: 'com.google.Chrome', name: 'Chrome', icon: '🌐' },
  { bundleId: 'com.microsoft.VSCode', name: 'VS Code', icon: '💻' },
  { bundleId: 'com.todesktop.230313mzl4w4u92', name: 'Cursor', icon: '⚡' },
  { bundleId: 'com.apple.mail', name: 'Mail', icon: '📧' },
  { bundleId: 'com.apple.MobileSMS', name: 'Messages', icon: '💬' },
  { bundleId: 'com.tinyspeck.slackmacgap', name: 'Slack', icon: '💼' },
  { bundleId: 'us.zoom.xos', name: 'Zoom', icon: '📹' },
  { bundleId: 'com.hnc.Discord', name: 'Discord', icon: '🎮' },
  { bundleId: 'tv.twitch.studio', name: 'Twitch', icon: '🟣' },
  { bundleId: 'com.apple.TV', name: 'Apple TV', icon: '📺' },
]

// Icons
const ShieldIcon = () => (
  <svg className="app-blocking-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const PlayIcon = () => (
  <svg className="app-blocking-icon app-blocking-icon--small" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
)

const PauseIcon = () => (
  <svg className="app-blocking-icon app-blocking-icon--small" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
)

// Skeleton loader components
const SkeletonItem = () => (
  <div className="app-blocking-view__skeleton-item">
    <div className="app-blocking-view__skeleton-text" />
    <div className="app-blocking-view__skeleton-text app-blocking-view__skeleton-text--short" />
  </div>
)

const SkeletonCard = () => (
  <div className="app-blocking-view__skeleton-card">
    <div className="app-blocking-view__skeleton-icon" />
    <div className="app-blocking-view__skeleton-text" />
  </div>
)

// Hook to fetch and cache app icons
function useAppIcons() {
  const [icons, setIcons] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState<Set<string>>(new Set())

  const fetchIcon = useCallback(async (bundleId: string) => {
    // Already have it or loading
    if (bundleId in icons || loading.has(bundleId)) return
    
    // Mark as loading
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

  const getIcon = useCallback((bundleId: string): string | null => {
    return icons[bundleId] ?? null
  }, [icons])

  return { fetchIcon, getIcon, icons }
}

// App icon component with fallback
function AppIcon({ bundleId, fallbackEmoji, fetchIcon, getIcon }: { 
  bundleId: string
  fallbackEmoji: string
  fetchIcon: (id: string) => void
  getIcon: (id: string) => string | null
}) {
  const icon = getIcon(bundleId)
  
  // Fetch icon on mount
  useEffect(() => {
    fetchIcon(bundleId)
  }, [bundleId, fetchIcon])
  
  if (icon) {
    return <img src={icon} alt="" className="app-blocking-view__real-icon" />
  }
  
  return <span className="app-blocking-view__emoji-icon">{fallbackEmoji}</span>
}

export function AppBlockingView() {
  const { config, loading, isMonitoring, setBlockedApps, setBlockingEnabled } = useAppBlocking()
  const { stats } = useAppUsage('today')
  const [showRunningApps, setShowRunningApps] = useState(false)
  const { apps: runningApps, loading: runningAppsLoading, hasLoaded: runningAppsLoaded, refetch: refetchRunningApps } = useRunningApps(showRunningApps)
  const [showAddApp, setShowAddApp] = useState(false)
  const [customBundleId, setCustomBundleId] = useState('')
  const [activeTab, setActiveTab] = useState<'blocked' | 'usage'>('blocked')
  const { fetchIcon, getIcon } = useAppIcons()

  // Fetch icons for suggested apps on mount
  useEffect(() => {
    SUGGESTED_APPS.forEach(app => fetchIcon(app.bundleId))
  }, [fetchIcon])

  // Fetch icons for blocked apps
  useEffect(() => {
    config.blocked_bundle_ids.forEach(bundleId => fetchIcon(bundleId))
  }, [config.blocked_bundle_ids, fetchIcon])

  // Fetch icons for usage stats
  useEffect(() => {
    stats.apps.forEach(app => fetchIcon(app.bundle_id))
  }, [stats.apps, fetchIcon])

  const handleToggleApp = async (bundleId: string) => {
    const isBlocked = config.blocked_bundle_ids.includes(bundleId)
    const newList = isBlocked
      ? config.blocked_bundle_ids.filter(id => id !== bundleId)
      : [...config.blocked_bundle_ids, bundleId]
    await setBlockedApps(newList)
  }

  const handleAddCustomApp = async () => {
    if (customBundleId && !config.blocked_bundle_ids.includes(customBundleId)) {
      await setBlockedApps([...config.blocked_bundle_ids, customBundleId])
      setCustomBundleId('')
      setShowAddApp(false)
    }
  }

  const getAppName = (bundleId: string): string => {
    const suggested = SUGGESTED_APPS.find(a => a.bundleId === bundleId)
    if (suggested) return suggested.name
    
    const running = runningApps.find(([id]) => id === bundleId)
    if (running) return running[1]
    
    // Extract name from bundle ID
    const parts = bundleId.split('.')
    return parts[parts.length - 1] || bundleId
  }

  const getAppEmoji = (bundleId: string): string => {
    const suggested = SUGGESTED_APPS.find(a => a.bundleId === bundleId)
    if (suggested) return suggested.icon
    
    // Generic icons based on bundle ID patterns
    if (bundleId.includes('apple')) return '🍎'
    if (bundleId.includes('google')) return '🔵'
    if (bundleId.includes('microsoft')) return '🟦'
    if (bundleId.includes('terminal') || bundleId.includes('iterm')) return '⬛'
    if (bundleId.includes('finder')) return '📁'
    if (bundleId.includes('system')) return '⚙️'
    if (bundleId.includes('note')) return '📝'
    if (bundleId.includes('music') || bundleId.includes('audio')) return '🎵'
    if (bundleId.includes('video') || bundleId.includes('movie')) return '🎬'
    if (bundleId.includes('photo') || bundleId.includes('image')) return '🖼️'
    if (bundleId.includes('mail') || bundleId.includes('email')) return '📧'
    if (bundleId.includes('calendar')) return '📅'
    if (bundleId.includes('chat') || bundleId.includes('message')) return '💬'
    
    return '📦' // Default generic icon
  }

  // Don't block render for loading - show UI immediately

  return (
    <div className="app-blocking-view">
      <header className="app-blocking-view__header">
        <div className="app-blocking-view__title">
          <span className="app-blocking-view__icon"><ShieldIcon /></span>
          <h1>App Blocking</h1>
        </div>
      </header>

      <div className="app-blocking-view__scrollable">
        <div className="app-blocking-view__content">
          {/* Master Toggle */}
          <section className="app-blocking-view__master-toggle">
            <div className="app-blocking-view__toggle-info">
              <h2>App Blocking</h2>
              <p>
                {config.blocking_enabled
                  ? isMonitoring
                    ? 'Monitoring active — blocked apps will be closed automatically'
                    : 'Enabled but not monitoring'
                  : 'Enable to block distracting apps on your Mac'}
              </p>
            </div>
            <button
              className={`app-blocking-view__toggle-btn ${config.blocking_enabled ? 'app-blocking-view__toggle-btn--active' : ''}`}
              onClick={() => setBlockingEnabled(!config.blocking_enabled)}
            >
              {config.blocking_enabled ? <PauseIcon /> : <PlayIcon />}
              {config.blocking_enabled ? 'Active' : 'Disabled'}
            </button>
          </section>

          {/* Status Indicator */}
          {config.blocking_enabled && (
            <div className={`app-blocking-view__status ${isMonitoring ? 'app-blocking-view__status--active' : 'app-blocking-view__status--inactive'}`}>
              <span className="app-blocking-view__status-dot" />
              <span>
                {isMonitoring 
                  ? `Monitoring ${config.blocked_bundle_ids.length} blocked app${config.blocked_bundle_ids.length !== 1 ? 's' : ''}`
                  : 'Starting monitoring...'
                }
              </span>
            </div>
          )}

          {/* Tabs */}
          <div className="app-blocking-view__tabs">
            <button
              className={`app-blocking-view__tab ${activeTab === 'blocked' ? 'app-blocking-view__tab--active' : ''}`}
              onClick={() => setActiveTab('blocked')}
            >
              Blocked Apps ({config.blocked_bundle_ids.length})
            </button>
            <button
              className={`app-blocking-view__tab ${activeTab === 'usage' ? 'app-blocking-view__tab--active' : ''}`}
              onClick={() => setActiveTab('usage')}
            >
              Usage Today
            </button>
          </div>

          {/* Blocked Apps Tab */}
          {activeTab === 'blocked' && (
            <section className="app-blocking-view__section">
              {/* Currently Blocked */}
              {config.blocked_bundle_ids.length > 0 && (
                <div className="app-blocking-view__blocked-list">
                  <h3>Currently Blocked</h3>
                  <div className="app-blocking-view__app-grid">
                    {config.blocked_bundle_ids.map(bundleId => (
                      <div key={bundleId} className="app-blocking-view__app-item app-blocking-view__app-item--blocked">
                        <span className="app-blocking-view__app-icon">
                          <AppIcon 
                            bundleId={bundleId} 
                            fallbackEmoji={getAppEmoji(bundleId)} 
                            fetchIcon={fetchIcon}
                            getIcon={getIcon}
                          />
                        </span>
                        <span className="app-blocking-view__app-name">{getAppName(bundleId)}</span>
                        <button
                          className="app-blocking-view__app-remove"
                          onClick={() => handleToggleApp(bundleId)}
                          title="Unblock"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Apps */}
              <div className="app-blocking-view__suggested">
                <h3>Add Apps to Block</h3>
                <div className="app-blocking-view__app-grid">
                  {SUGGESTED_APPS
                    .filter(app => !config.blocked_bundle_ids.includes(app.bundleId))
                    .map(app => (
                      <button
                        key={app.bundleId}
                        className="app-blocking-view__app-item app-blocking-view__app-item--suggested"
                        onClick={() => handleToggleApp(app.bundleId)}
                      >
                        <span className="app-blocking-view__app-icon">
                          <AppIcon 
                            bundleId={app.bundleId} 
                            fallbackEmoji={app.icon} 
                            fetchIcon={fetchIcon}
                            getIcon={getIcon}
                          />
                        </span>
                        <span className="app-blocking-view__app-name">{app.name}</span>
                        <span className="app-blocking-view__app-add">+</span>
                      </button>
                    ))
                  }
                </div>
              </div>

              {/* Running Apps - Expandable to avoid lag */}
              <div className="app-blocking-view__running">
                <button 
                  className="app-blocking-view__running-toggle"
                  onClick={() => setShowRunningApps(!showRunningApps)}
                >
                  <div>
                    <h3>Currently Running</h3>
                    <p className="app-blocking-view__running-subtitle">
                      {showRunningApps ? 'Click to block' : 'Click to load running apps'}
                    </p>
                  </div>
                  <span className="app-blocking-view__running-arrow">
                    {showRunningApps ? '▼' : '▶'}
                  </span>
                </button>
                
                {showRunningApps && (
                  <>
                    {runningAppsLoading && !runningAppsLoaded ? (
                      // Skeleton loading
                      <div className="app-blocking-view__app-list">
                        <SkeletonItem />
                        <SkeletonItem />
                        <SkeletonItem />
                      </div>
                    ) : runningApps.filter(([bundleId]) => 
                        !config.blocked_bundle_ids.includes(bundleId)
                      ).length > 0 ? (
                      <div className="app-blocking-view__app-list">
                        {runningApps
                          .filter(([bundleId]) => 
                            !config.blocked_bundle_ids.includes(bundleId)
                          )
                      .map(([bundleId, name]) => (
                        <button
                          key={bundleId}
                          className="app-blocking-view__running-item"
                          onClick={() => handleToggleApp(bundleId)}
                        >
                          <span className="app-blocking-view__running-icon">
                            <AppIcon 
                              bundleId={bundleId} 
                              fallbackEmoji={getAppEmoji(bundleId)} 
                              fetchIcon={fetchIcon}
                              getIcon={getIcon}
                            />
                          </span>
                          <div className="app-blocking-view__running-info">
                            <span className="app-blocking-view__running-name">{name}</span>
                            <span className="app-blocking-view__running-id">{bundleId}</span>
                          </div>
                        </button>
                      ))
                        }
                        <button 
                          className="app-blocking-view__refresh-btn-inline"
                          onClick={refetchRunningApps}
                          disabled={runningAppsLoading}
                        >
                          {runningAppsLoading ? 'Loading...' : '↻ Refresh'}
                        </button>
                      </div>
                    ) : (
                      <p className="app-blocking-view__running-empty">No other apps detected</p>
                    )}
                  </>
                )}
              </div>

              {/* Custom App */}
              <div className="app-blocking-view__custom">
                {showAddApp ? (
                  <div className="app-blocking-view__custom-form">
                    <input
                      type="text"
                      placeholder="com.example.app"
                      value={customBundleId}
                      onChange={e => setCustomBundleId(e.target.value)}
                      className="app-blocking-view__custom-input"
                    />
                    <button 
                      className="app-blocking-view__custom-add"
                      onClick={handleAddCustomApp}
                      disabled={!customBundleId}
                    >
                      Add
                    </button>
                    <button 
                      className="app-blocking-view__custom-cancel"
                      onClick={() => {
                        setShowAddApp(false)
                        setCustomBundleId('')
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="app-blocking-view__custom-btn"
                    onClick={() => setShowAddApp(true)}
                  >
                    + Add custom app by Bundle ID
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Usage Tab */}
          {activeTab === 'usage' && (
            <section className="app-blocking-view__section">
              <div className="app-blocking-view__usage">
                <div className="app-blocking-view__usage-header">
                  <h3>App Usage Today</h3>
                  <span className="app-blocking-view__usage-total">
                    Total: {formatDuration(stats.total_time_ms)}
                  </span>
                </div>

                {stats.apps.length === 0 ? (
                  <div className="app-blocking-view__usage-empty">
                    <p>No app usage tracked yet.</p>
                    <p className="app-blocking-view__usage-hint">
                      Enable app blocking to start tracking usage.
                    </p>
                  </div>
                ) : (
                  <div className="app-blocking-view__usage-list">
                    {stats.apps.map(app => (
                      <div key={app.bundle_id} className="app-blocking-view__usage-item">
                        <span className="app-blocking-view__usage-icon">
                          <AppIcon 
                            bundleId={app.bundle_id} 
                            fallbackEmoji={getAppEmoji(app.bundle_id)} 
                            fetchIcon={fetchIcon}
                            getIcon={getIcon}
                          />
                        </span>
                        <div className="app-blocking-view__usage-content">
                          <div className="app-blocking-view__usage-info">
                            <span className="app-blocking-view__usage-name">{app.app_name}</span>
                            <span className="app-blocking-view__usage-time">
                              {formatDuration(app.total_time_ms)}
                            </span>
                          </div>
                          <div className="app-blocking-view__usage-bar-container">
                            <div 
                              className="app-blocking-view__usage-bar"
                              style={{ width: `${Math.min(app.percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                        {!config.blocked_bundle_ids.includes(app.bundle_id) && (
                          <button
                            className="app-blocking-view__usage-block"
                            onClick={() => handleToggleApp(app.bundle_id)}
                            title="Block this app"
                          >
                            Block
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
