import { useState, useEffect, useRef } from 'react'
import { useBoundaries } from '../hooks/useBoundaries'
import { useBoundaryActions } from '../hooks/useBoundaryActions'
import { useExtensionStatus } from '../hooks/useExtensionStatus'
import { AddBoundaryModal } from './AddBoundaryModal'
import { EditBoundaryModal } from './EditBoundaryModal'
import { IncognitoSetupModal } from './IncognitoSetupModal'
import { ProtectionAlert } from './ProtectionAlert'
import type { Boundary } from '@oneway/shared'
import './BoundariesView.css'

// Custom SVG Icons
const CheckIcon = () => (
  <svg className="boundaries-icon boundaries-icon--check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const WarningIcon = () => (
  <svg className="boundaries-icon boundaries-icon--warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

const AlertIcon = () => (
  <svg className="boundaries-icon boundaries-icon--alert" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

const ShieldIcon = () => (
  <svg className="boundaries-icon boundaries-icon--shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const InfoIcon = () => (
  <svg className="boundaries-icon boundaries-icon--info" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
)

// Search engines with SafeSearch enforced
const SAFESEARCH_ENGINES = [
  'Google',
  'Bing', 
  'DuckDuckGo',
  'Yahoo',
  'Ecosia',
  'Qwant',
  'Brave Search',
  'YouTube',
]

// What Search Filter catches
const SEARCH_FILTER_INFO = [
  'Explicit search terms',
  'Suspicious keyword combinations',
  'Evasion patterns (misspellings, symbols)',
  'Behavioral patterns (frantic searching)',
]

interface BoundariesViewProps {
  userId: string
}

export function BoundariesView({ userId }: BoundariesViewProps) {
  const { boundaries, stats, loading, refetch, optimisticRemove, optimisticToggle } = useBoundaries(userId)
  const { remove, toggle } = useBoundaryActions()
  const { status: extensionStatus } = useExtensionStatus()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingBoundary, setEditingBoundary] = useState<Boundary | null>(null)
  const [showIncognitoSetup, setShowIncognitoSetup] = useState(false)
  const [showSafeSearchInfo, setShowSafeSearchInfo] = useState(false)
  const [showSearchFilterInfo, setShowSearchFilterInfo] = useState(false)
  
  const safeSearchRef = useRef<HTMLDivElement>(null)
  const searchFilterRef = useRef<HTMLDivElement>(null)
  
  // Close popups when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (safeSearchRef.current && !safeSearchRef.current.contains(e.target as Node)) {
        setShowSafeSearchInfo(false)
      }
      if (searchFilterRef.current && !searchFilterRef.current.contains(e.target as Node)) {
        setShowSearchFilterInfo(false)
      }
    }
    
    if (showSafeSearchInfo || showSearchFilterInfo) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSafeSearchInfo, showSearchFilterInfo])

  const activeBoundaries = boundaries.filter(b => b.is_active)
  const inactiveBoundaries = boundaries.filter(b => !b.is_active)

  // Check if a boundary is currently active based on schedule
  const isCurrentlyActive = (boundary: Boundary): boolean => {
    if (!boundary.is_active) return false
    if (boundary.schedule === 'always') return true

    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const currentTime = currentHour * 60 + currentMinute
    const currentDay = now.getDay() // 0 = Sunday

    if (boundary.schedule === 'weekdays' && (currentDay === 0 || currentDay === 6)) {
      return false
    }
    if (boundary.schedule === 'weekends' && currentDay !== 0 && currentDay !== 6) {
      return false
    }

    if (boundary.schedule === 'scheduled' && boundary.time_start && boundary.time_end) {
      const [startH, startM] = boundary.time_start.split(':').map(Number)
      const [endH, endM] = boundary.time_end.split(':').map(Number)
      const startTime = startH * 60 + startM
      const endTime = endH * 60 + endM

      if (startTime <= endTime) {
        return currentTime >= startTime && currentTime <= endTime
      } else {
        // Overnight boundary (e.g., 22:00 → 06:00)
        return currentTime >= startTime || currentTime <= endTime
      }
    }

    return true
  }

  const handleDelete = async (id: string) => {
    optimisticRemove(id)
    try {
      await remove(id)
    } catch {
      refetch(true)
    }
  }

  const handleToggle = async (boundary: Boundary) => {
    const newState = !boundary.is_active
    optimisticToggle(boundary.id, newState)
    try {
      await toggle(boundary.id, newState)
    } catch {
      refetch(true)
    }
  }

  const getStatsForBoundary = (boundaryId: string) => {
    return stats.find(s => s.boundary_id === boundaryId)
  }

  const formatSchedule = (boundary: Boundary): string => {
    if (boundary.schedule === 'always') return 'Always'
    if (boundary.schedule === 'weekdays') return 'Weekdays'
    if (boundary.schedule === 'weekends') return 'Weekends'
    if (boundary.time_start && boundary.time_end) {
      return `${boundary.time_start} → ${boundary.time_end}`
    }
    return 'Scheduled'
  }

  // Calculate total stats
  const totalBlocks = stats.reduce((sum, s) => sum + s.blocks_today, 0)

  // Calculate System Health percentage (4 checks)
  const systemHealthChecks = [
    extensionStatus?.alertLevel === 'ok',  // Extension connected
    extensionStatus?.incognitoEnabled,      // Incognito protected
    true,                                    // SafeSearch (always on)
    true,                                    // Search Filter (always on)
  ]
  const healthyChecks = systemHealthChecks.filter(Boolean).length
  const systemHealthPercent = Math.round((healthyChecks / 4) * 100)

  if (loading) {
    return (
      <div className="boundaries-view">
        <header className="boundaries-view__header">
          <div className="boundaries-view__title">
            <span className="boundaries-view__icon"><ShieldIcon /></span>
            <h1>Boundaries</h1>
          </div>
        </header>
        <div className="boundaries-view__scrollable">
          <div className="boundaries-view__content">
            <div className="boundaries-view__loading">Loading boundaries...</div>
          </div>
        </div>
      </div>
    )
  }

  // Helper to get icon based on alert level
  const getAlertIcon = (level: string | undefined) => {
    switch (level) {
      case 'ok': return <CheckIcon />
      case 'warning': return <WarningIcon />
      case 'critical': return <AlertIcon />
      default: return <AlertIcon />
    }
  }

  // Format time since last heartbeat
  const getHeartbeatStatus = () => {
    if (!extensionStatus?.lastHeartbeat) return 'Never'
    
    const elapsed = Date.now() - extensionStatus.lastHeartbeat
    const seconds = Math.floor(elapsed / 1000)
    
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  return (
    <div className="boundaries-view">
      {/* Sticky Header */}
      <header className="boundaries-view__header">
        <div className="boundaries-view__title">
          <span className="boundaries-view__icon"><ShieldIcon /></span>
          <h1>Boundaries</h1>
        </div>
      </header>

      {/* Scrollable content */}
      <div className="boundaries-view__scrollable">
        <div className="boundaries-view__content">
          {/* Protection Alert Banner */}
          <ProtectionAlert status={extensionStatus} />

          {/* System Health Section */}
          <section className="boundaries-view__system-health">
        <div className="boundaries-view__health-header">
          <h2 className="boundaries-view__section-title">System Health</h2>
          <div className="boundaries-view__health-gauge">
            <span className="boundaries-view__health-percent">{systemHealthPercent}%</span>
            <div className="boundaries-view__health-bar-container">
              <div 
                className={`boundaries-view__health-bar ${
                  systemHealthPercent === 100 ? 'boundaries-view__health-bar--full' : 
                  systemHealthPercent >= 75 ? 'boundaries-view__health-bar--good' : 
                  'boundaries-view__health-bar--warning'
                }`}
                style={{ width: `${systemHealthPercent}%` }}
              />
            </div>
          </div>
        </div>
        <div className="boundaries-view__protection-grid">
          {/* Extension Connection */}
          <div className={`boundaries-view__protection-item boundaries-view__protection-item--${extensionStatus?.alertLevel || 'critical'}`}>
            <span className="boundaries-view__protection-icon">
              {getAlertIcon(extensionStatus?.alertLevel)}
            </span>
            <div className="boundaries-view__protection-info">
              <span className="boundaries-view__protection-label">Extension</span>
              <span className="boundaries-view__protection-value">
                {extensionStatus?.alertLevel === 'ok' 
                  ? 'Connected' 
                  : extensionStatus?.alertLevel === 'warning'
                    ? 'Unstable'
                    : 'Not connected'
                }
              </span>
              {extensionStatus?.lastHeartbeat && extensionStatus.alertLevel === 'ok' && (
                <span className="boundaries-view__protection-detail">
                  Heartbeat: {getHeartbeatStatus()}
                </span>
              )}
            </div>
          </div>

          {/* Incognito Mode */}
          <div className={`boundaries-view__protection-item ${extensionStatus?.incognitoEnabled ? 'boundaries-view__protection-item--ok' : 'boundaries-view__protection-item--warning'}`}>
            <span className="boundaries-view__protection-icon">
              {extensionStatus?.incognitoEnabled ? <CheckIcon /> : <WarningIcon />}
            </span>
            <div className="boundaries-view__protection-info">
              <span className="boundaries-view__protection-label">Incognito</span>
              <span className="boundaries-view__protection-value">
                {extensionStatus?.incognitoEnabled ? 'Protected' : 'Not enabled'}
              </span>
              <span className="boundaries-view__protection-detail">
                {extensionStatus?.incognitoEnabled 
                  ? 'Extension active in private browsing'
                  : 'Private browsing is not protected'
                }
              </span>
            </div>
            {!extensionStatus?.incognitoEnabled && (
              <button 
                className="boundaries-view__protection-action"
                onClick={() => setShowIncognitoSetup(true)}
              >
                Enable
              </button>
            )}
          </div>

          {/* SafeSearch */}
          <div ref={safeSearchRef} className="boundaries-view__protection-item boundaries-view__protection-item--ok">
            <span className="boundaries-view__protection-icon"><CheckIcon /></span>
            <div className="boundaries-view__protection-info">
              <span className="boundaries-view__protection-label">SafeSearch</span>
              <span className="boundaries-view__protection-value">Enforced</span>
              <span className="boundaries-view__protection-detail">{SAFESEARCH_ENGINES.length} search engines</span>
            </div>
            <button 
              className="boundaries-view__info-btn"
              onClick={() => setShowSafeSearchInfo(!showSafeSearchInfo)}
              title="View covered search engines"
            >
              <InfoIcon />
            </button>
            {showSafeSearchInfo && (
              <div className="boundaries-view__info-popup">
                <div className="boundaries-view__info-popup-header">
                  SafeSearch enforced on:
                </div>
                <ul className="boundaries-view__info-popup-list">
                  {SAFESEARCH_ENGINES.map(engine => (
                    <li key={engine}>{engine}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Search Filter */}
          <div ref={searchFilterRef} className="boundaries-view__protection-item boundaries-view__protection-item--ok">
            <span className="boundaries-view__protection-icon"><CheckIcon /></span>
            <div className="boundaries-view__protection-info">
              <span className="boundaries-view__protection-label">Search Filter</span>
              <span className="boundaries-view__protection-value">Active</span>
              <span className="boundaries-view__protection-detail">
                {extensionStatus?.blockedSearchesToday && extensionStatus.blockedSearchesToday > 0
                  ? `${extensionStatus.blockedSearchesToday} blocked today`
                  : 'Intelligent filtering'
                }
              </span>
            </div>
            <button 
              className="boundaries-view__info-btn"
              onClick={() => setShowSearchFilterInfo(!showSearchFilterInfo)}
              title="View filter details"
            >
              <InfoIcon />
            </button>
            {showSearchFilterInfo && (
              <div className="boundaries-view__info-popup">
                <div className="boundaries-view__info-popup-header">
                  Detects and blocks:
                </div>
                <ul className="boundaries-view__info-popup-list">
                  {SEARCH_FILTER_INFO.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <p className="boundaries-view__health-note">
          These protections work automatically in the background.
        </p>
      </section>

      {/* My Rules Section */}
      <section className="boundaries-view__my-rules">
        <div className="boundaries-view__rules-header">
          <div>
            <h2 className="boundaries-view__section-title">My Rules</h2>
            <p className="boundaries-view__rules-subtitle">
              {activeBoundaries.length} active rule{activeBoundaries.length !== 1 ? 's' : ''}
              {totalBlocks > 0 && ` • ${totalBlocks} block${totalBlocks !== 1 ? 's' : ''} today`}
            </p>
          </div>
          <button 
            className="boundaries-view__add-btn"
            onClick={() => setShowAddModal(true)}
          >
            + Add Rule
          </button>
        </div>

      {/* Active Boundaries */}
      {activeBoundaries.length > 0 && (
        <div className="boundaries-view__rules-section">
          <h3 className="boundaries-view__rules-section-title">
            Active ({activeBoundaries.filter(isCurrentlyActive).length})
          </h3>
          <div className="boundaries-view__list">
            {activeBoundaries.map(boundary => {
              const boundaryStats = getStatsForBoundary(boundary.id)
              const isActive = isCurrentlyActive(boundary)
              
              return (
                <div 
                  key={boundary.id} 
                  className={`boundaries-view__item ${isActive ? 'boundaries-view__item--active' : ''}`}
                >
                  <div className="boundaries-view__item-main">
                    <div className="boundaries-view__item-header">
                      <span className={`boundaries-view__mode-badge boundaries-view__mode-badge--${boundary.mode}`}>
                        {boundary.mode === 'block' ? '🚫' : '👁️'}
                      </span>
                      <span className="boundaries-view__item-name">{boundary.name}</span>
                      {isActive && <span className="boundaries-view__active-dot" />}
                    </div>
                    <div className="boundaries-view__item-patterns">
                      {boundary.patterns.join(', ')}
                    </div>
                    {boundary.reason && (
                      <div className="boundaries-view__item-reason">"{boundary.reason}"</div>
                    )}
                  </div>
                  <div className="boundaries-view__item-meta">
                    <span className="boundaries-view__item-schedule">
                      {formatSchedule(boundary)}
                    </span>
                    {boundaryStats && boundaryStats.blocks_today > 0 && (
                      <span className="boundaries-view__item-blocks">
                        {boundaryStats.blocks_today} today
                      </span>
                    )}
                  </div>
                  <div className="boundaries-view__item-actions">
                    <button
                      className="boundaries-view__action-btn"
                      onClick={() => setEditingBoundary(boundary)}
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      className="boundaries-view__action-btn"
                      onClick={() => handleToggle(boundary)}
                      title="Disable"
                    >
                      ⏸️
                    </button>
                    <button
                      className="boundaries-view__action-btn boundaries-view__action-btn--delete"
                      onClick={() => handleDelete(boundary.id)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Inactive Boundaries */}
      {inactiveBoundaries.length > 0 && (
        <div className="boundaries-view__rules-section">
          <h3 className="boundaries-view__rules-section-title boundaries-view__rules-section-title--muted">
            Paused ({inactiveBoundaries.length})
          </h3>
          <div className="boundaries-view__list">
            {inactiveBoundaries.map(boundary => (
              <div 
                key={boundary.id} 
                className="boundaries-view__item boundaries-view__item--inactive"
              >
                <div className="boundaries-view__item-main">
                  <div className="boundaries-view__item-header">
                    <span className="boundaries-view__mode-badge boundaries-view__mode-badge--inactive">
                      {boundary.mode === 'block' ? '🚫' : '👁️'}
                    </span>
                    <span className="boundaries-view__item-name">{boundary.name}</span>
                  </div>
                  <div className="boundaries-view__item-patterns">
                    {boundary.patterns.join(', ')}
                  </div>
                </div>
                <div className="boundaries-view__item-actions">
                  <button
                    className="boundaries-view__action-btn"
                    onClick={() => handleToggle(boundary)}
                    title="Enable"
                  >
                    ▶️
                  </button>
                  <button
                    className="boundaries-view__action-btn boundaries-view__action-btn--delete"
                    onClick={() => handleDelete(boundary.id)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State for Rules */}
      {boundaries.length === 0 && (
        <div className="boundaries-view__empty-rules">
          <p>No rules yet. Add your first rule to start blocking distracting sites.</p>
        </div>
      )}
      </section>

        </div>
      </div>

      {/* Modals - outside scrollable content */}
      {showAddModal && (
        <AddBoundaryModal
          userId={userId}
          onSave={() => {
            setShowAddModal(false)
            refetch(true)
          }}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      {editingBoundary && (
        <EditBoundaryModal
          boundary={editingBoundary}
          onSave={() => {
            setEditingBoundary(null)
            refetch(true)
          }}
          onCancel={() => setEditingBoundary(null)}
        />
      )}

      {showIncognitoSetup && (
        <IncognitoSetupModal onClose={() => setShowIncognitoSetup(false)} />
      )}
    </div>
  )
}
