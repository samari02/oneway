import { useState, useEffect, useRef } from 'react'
import type { Habit } from '@oneway/shared'
import './HabitItem.css'

interface HabitItemProps {
  habit: Habit
  isChecked: boolean
  onToggle: () => void
  onEdit?: (habit: Habit) => void
  onDelete?: (habitId: string) => void
}

export function HabitItem({ habit, isChecked, onToggle, onEdit, onDelete }: HabitItemProps) {
  const [showActions, setShowActions] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  const handleContentClick = (e: React.MouseEvent) => {
    // If clicking on actions menu, don't toggle
    if ((e.target as HTMLElement).closest('.habit-item__actions')) return
    onToggle()
  }

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
    
    // Use window.confirm with a small delay to let dropdown close
    setTimeout(async () => {
      const confirmed = window.confirm(`Delete "${habit.name}"?`)
      if (confirmed && onDelete) {
        try {
          await onDelete(habit.id)
        } catch (err) {
          console.error('Failed to delete habit:', err)
        }
      }
    }, 50)
  }

  return (
    <div 
      className={`habit-item ${isChecked ? 'habit-item--checked' : ''} ${showActions ? 'habit-item--menu-open' : ''}`}
      onClick={handleContentClick}
    >
      <button 
        className={`habit-item__check ${isChecked ? 'habit-item__check--checked' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        aria-label={isChecked ? 'Uncheck habit' : 'Check habit'}
      >
        {isChecked ? '✓' : ''}
      </button>

      <div className="habit-item__content">
        <div className="habit-item__header">
          <span className="habit-item__icon">{habit.icon || '✨'}</span>
          <span className="habit-item__name">{habit.name}</span>
          {habit.is_required && (
            <span className="habit-item__badge habit-item__badge--required">Required</span>
          )}
        </div>
        
        {(habit.description || habit.duration_minutes) && (
          <div className="habit-item__details">
            {habit.duration_minutes && (
              <span className="habit-item__duration">
                ⏱ {formatDuration(habit.duration_minutes)}
              </span>
            )}
            {habit.description && (
              <span className="habit-item__description">{habit.description}</span>
            )}
          </div>
        )}
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
