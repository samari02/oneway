import { useState } from 'react'
import { useBoundaries } from '../hooks/useBoundaries'
import { useBoundaryActions } from '../hooks/useBoundaryActions'
import { AddBoundaryModal } from './AddBoundaryModal'
import { EditBoundaryModal } from './EditBoundaryModal'
import type { Boundary } from '@oneway/shared'
import './BoundariesView.css'

interface BoundariesViewProps {
  userId: string
}

export function BoundariesView({ userId }: BoundariesViewProps) {
  const { boundaries, stats, loading, refetch, optimisticRemove, optimisticToggle } = useBoundaries(userId)
  const { remove, toggle } = useBoundaryActions()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingBoundary, setEditingBoundary] = useState<Boundary | null>(null)

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
  const totalBypasses = stats.reduce((sum, s) => sum + s.bypasses_this_week, 0)
  const avgRespectRate = stats.length > 0
    ? Math.round(stats.reduce((sum, s) => sum + s.respect_rate, 0) / stats.length)
    : 100

  if (loading) {
    return (
      <div className="boundaries-view">
        <div className="boundaries-view__loading">Loading boundaries...</div>
      </div>
    )
  }

  return (
    <div className="boundaries-view">
      <header className="boundaries-view__header">
        <div className="boundaries-view__title">
          <span className="boundaries-view__icon">🛡️</span>
          <h1>Boundaries</h1>
        </div>
        <button 
          className="boundaries-view__add-btn"
          onClick={() => setShowAddModal(true)}
        >
          + Add Rule
        </button>
      </header>

      {/* Quick Stats */}
      <div className="boundaries-view__stats">
        <div className="boundaries-view__stat-card">
          <span className="boundaries-view__stat-value">{totalBlocks}</span>
          <span className="boundaries-view__stat-label">blocks today</span>
        </div>
        <div className="boundaries-view__stat-card">
          <span className="boundaries-view__stat-value">{totalBypasses}</span>
          <span className="boundaries-view__stat-label">bypasses this week</span>
        </div>
        <div className="boundaries-view__stat-card">
          <span className="boundaries-view__stat-value">{avgRespectRate}%</span>
          <span className="boundaries-view__stat-label">respect rate</span>
        </div>
      </div>

      {/* Active Boundaries */}
      {activeBoundaries.length > 0 && (
        <section className="boundaries-view__section">
          <h2 className="boundaries-view__section-title">
            Active Now ({activeBoundaries.filter(isCurrentlyActive).length})
          </h2>
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
        </section>
      )}

      {/* Inactive Boundaries */}
      {inactiveBoundaries.length > 0 && (
        <section className="boundaries-view__section">
          <h2 className="boundaries-view__section-title boundaries-view__section-title--muted">
            Paused ({inactiveBoundaries.length})
          </h2>
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
        </section>
      )}

      {/* Empty State */}
      {boundaries.length === 0 && (
        <div className="boundaries-view__empty">
          <span className="boundaries-view__empty-icon">🛡️</span>
          <h3>No boundaries yet</h3>
          <p>Create rules to block distracting sites and stay focused.</p>
          <button 
            className="boundaries-view__add-btn"
            onClick={() => setShowAddModal(true)}
          >
            + Add your first boundary
          </button>
        </div>
      )}

      {/* Modals */}
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
    </div>
  )
}
