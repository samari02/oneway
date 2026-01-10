import { useState, useEffect, useRef, useMemo } from 'react'
import type { Habit } from '@oneway/shared'
import './HabitItem.css'

interface HabitItemProps {
  habit: Habit
  isChecked: boolean
  isCurrent?: boolean
  onToggle: () => void
  onEdit?: (habit: Habit) => void
  onDelete?: (habitId: string) => void
  onMarkViolated?: (habitId: string) => void  // For boundaries
}

type BoundaryStatus = 'pending' | 'active' | 'respected' | 'violated'

export function HabitItem({ habit, isChecked, isCurrent, onToggle, onEdit, onDelete, onMarkViolated }: HabitItemProps) {
  const [showActions, setShowActions] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Compute boundary status
  const boundaryStatus = useMemo<BoundaryStatus>(() => {
    if (habit.habit_type !== 'avoid') return 'pending'
    if (isChecked) return 'respected'  // Already marked as completed (respected)
    
    // Check if within active time window
    if (habit.time_start && habit.time_end) {
      const now = new Date()
      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      
      const [startH, startM] = habit.time_start.split(':').map(Number)
      const [endH, endM] = habit.time_end.split(':').map(Number)
      const startMinutes = startH * 60 + startM
      const endMinutes = endH * 60 + endM
      
      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        return 'active'
      } else if (currentMinutes >= endMinutes) {
        return 'respected'  // Period ended, auto-respected
      }
    }
    
    return 'pending'
  }, [habit, isChecked])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showActions) return

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowActions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showActions])

  const formatDuration = (minutes?: number) => {
    if (!minutes) return null
    if (minutes < 60) return `${minutes}min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins ? `${hours}h${mins}` : `${hours}h`
  }

  const formatTimeRange = () => {
    if (!habit.time_start || !habit.time_end) return null
    return `${habit.time_start} → ${habit.time_end}`
  }

  const handleContentClick = (e: React.MouseEvent) => {
    // If clicking on actions menu, don't toggle
    if ((e.target as HTMLElement).closest('.habit-item__actions')) return
    // Boundaries can't be manually toggled (except to mark as violated)
    if (habit.habit_type === 'avoid') return
    onToggle()
  }

  const handleMarkViolated = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setShowActions(false)
    onMarkViolated?.(habit.id)
  }
  
  const isBoundary = habit.habit_type === 'avoid'

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setShowActions(false)
    // Small delay to ensure dropdown closes before modal opens
    setTimeout(() => {
      onEdit?.(habit)
    }, 10)
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setShowActions(false)
    
    // Direct delete (Tauri doesn't support window.confirm well)
    // TODO: Add custom confirmation dialog later
    if (onDelete) {
      try {
        await onDelete(habit.id)
      } catch (err) {
        console.error('Failed to delete habit:', err)
      }
    }
  }

  // Get boundary status icon
  const getBoundaryStatusIcon = () => {
    switch (boundaryStatus) {
      case 'active': return '⏳'
      case 'respected': return '✓'
      case 'violated': return '✗'
      default: return ''
    }
  }

  return (
    <div 
      className={`habit-item ${isChecked ? 'habit-item--checked' : ''} ${isCurrent ? 'habit-item--current' : ''} ${showActions ? 'habit-item--menu-open' : ''} ${isBoundary ? 'habit-item--boundary' : ''} ${isBoundary && boundaryStatus === 'active' ? 'habit-item--boundary-active' : ''} ${isBoundary && boundaryStatus === 'violated' ? 'habit-item--boundary-violated' : ''}`}
      onClick={handleContentClick}
    >
      {/* Check button for habits, Status indicator for boundaries */}
      {isBoundary ? (
        <div className={`habit-item__boundary-status habit-item__boundary-status--${boundaryStatus}`}>
          {getBoundaryStatusIcon()}
        </div>
      ) : (
        <button 
          className={`habit-item__check ${isChecked ? 'habit-item__check--checked' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          aria-label={isChecked ? 'Uncheck habit' : 'Check habit'}
        >
          {isChecked ? '✓' : ''}
        </button>
      )}

      <div className="habit-item__content">
        <div className="habit-item__header">
          <span className="habit-item__icon">{habit.icon || (isBoundary ? '🛡️' : '✨')}</span>
          <span className="habit-item__name">{habit.name}</span>
          {habit.is_required && !isBoundary && (
            <span className="habit-item__badge habit-item__badge--required">Required</span>
          )}
        </div>
        
        <div className="habit-item__details">
          {/* Time range for boundaries */}
          {isBoundary && formatTimeRange() && (
            <span className="habit-item__time-range">
              {formatTimeRange()}
            </span>
          )}
          {/* Duration for habits */}
          {!isBoundary && habit.duration_minutes && (
            <span className="habit-item__duration">
              ⏱ {formatDuration(habit.duration_minutes)}
            </span>
          )}
          {habit.description && (
            <span className="habit-item__description">{habit.description}</span>
          )}
          {/* Status text for boundaries */}
          {isBoundary && boundaryStatus === 'active' && (
            <span className="habit-item__status-text">In progress...</span>
          )}
        </div>
      </div>

      {/* Actions Menu */}
      <div className="habit-item__actions" ref={dropdownRef}>
        <button 
          className={`habit-item__menu-btn ${showActions ? 'habit-item__menu-btn--active' : ''}`}
          onClick={(e) => { e.stopPropagation(); setShowActions(!showActions) }}
          aria-label="Actions"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2"/>
            <circle cx="12" cy="12" r="2"/>
            <circle cx="12" cy="19" r="2"/>
          </svg>
        </button>
        
        {showActions && (
          <div className="habit-item__dropdown">
            {/* Mark as violated (only for boundaries that are active or pending) */}
            {isBoundary && (boundaryStatus === 'active' || boundaryStatus === 'pending') && (
              <button onClick={handleMarkViolated} className="habit-item__dropdown-danger">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                I didn't hold
              </button>
            )}
            <button onClick={handleEdit}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit
            </button>
            <button onClick={handleDelete} className="habit-item__dropdown-danger">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
