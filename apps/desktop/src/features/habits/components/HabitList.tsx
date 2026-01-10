import { useState, useEffect } from 'react'
import type { Habit } from '@oneway/shared'
import { HabitItem } from './HabitItem'
import './HabitList.css'

interface HabitListProps {
  habits: Habit[]
  checkedIds: Set<string>
  onCheck: (habitId: string) => void
  onUncheck: (habitId: string) => void
  onEdit?: (habit: Habit) => void
  onDelete?: (habitId: string) => void
  onMarkViolated?: (habitId: string) => void
}

type ViewMode = 'list' | 'visual'

function getCurrentTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

// Convert time string to minutes from midnight
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// Calculate block height based on duration (1 hour = 60px)
function durationToHeight(minutes: number): number {
  return Math.max(40, minutes) // Minimum 40px
}

export function HabitList({ habits, checkedIds, onCheck, onUncheck, onEdit, onDelete, onMarkViolated }: HabitListProps) {
  const [currentTime, setCurrentTime] = useState(getCurrentTime)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTime())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Get the display time for sorting (scheduled_time for habits, time_start for boundaries)
  const getDisplayTime = (habit: Habit) => {
    if (habit.habit_type === 'avoid') {
      return habit.time_start || null
    }
    return habit.scheduled_time || null
  }

  // Sort habits by scheduled_time/time_start (nulls at end)
  const sortedHabits = [...habits].sort((a, b) => {
    const timeA = getDisplayTime(a)
    const timeB = getDisplayTime(b)
    if (!timeA && !timeB) return 0
    if (!timeA) return 1
    if (!timeB) return -1
    return timeA.localeCompare(timeB)
  })

  // Find where to insert the "now" marker
  // -1 means all habits are before now (or have no time), show at end
  // Otherwise show before the first habit that's after current time
  const habitsWithTime = sortedHabits.filter(h => h.scheduled_time)
  let nowIndex = -1
  if (habitsWithTime.length > 0) {
    const firstAfterNow = sortedHabits.findIndex(h => 
      h.scheduled_time && h.scheduled_time > currentTime
    )
    nowIndex = firstAfterNow
  }

  // Find the first unchecked habit (current one)
  const firstUncheckedId = sortedHabits.find(h => !checkedIds.has(h.id))?.id

  // Count only habits that are in the current list
  const completedCount = habits.filter(h => checkedIds.has(h.id)).length
  const totalCount = habits.length

  if (habits.length === 0) {
    return (
      <div className="habit-list__empty">
        <span className="habit-list__empty-icon">🌱</span>
        <p>No habits yet</p>
        <p className="habit-list__empty-hint">Add your first habit to get started</p>
      </div>
    )
  }

  // Separate habits and boundaries
  const doHabits = sortedHabits.filter(h => h.habit_type !== 'avoid')
  const boundaries = habits.filter(h => h.habit_type === 'avoid')
  
  // Check which boundaries are currently active
  const currentMinutes = timeToMinutes(currentTime)
  const activeBoundaries = boundaries.filter(b => {
    if (!b.time_start || !b.time_end) return false
    const start = timeToMinutes(b.time_start)
    const end = timeToMinutes(b.time_end)
    return currentMinutes >= start && currentMinutes < end
  })

  // Get time range for visual timeline (from earliest habit to latest)
  const getTimeRange = () => {
    const times: number[] = []
    doHabits.forEach(h => {
      if (h.scheduled_time) times.push(timeToMinutes(h.scheduled_time))
    })
    if (times.length === 0) return { start: 6 * 60, end: 22 * 60 } // Default 6am-10pm
    const min = Math.min(...times)
    const max = Math.max(...times)
    // Add padding
    return { 
      start: Math.floor(min / 60) * 60, 
      end: Math.ceil((max + 60) / 60) * 60 
    }
  }

  return (
    <div className="habit-list">
      <div className="habit-list__section-header">
        <h2 className="habit-list__section-title">Today's Focus</h2>
        <div className="habit-list__header-actions">
          <div className="habit-list__view-toggle">
            <button 
              className={`habit-list__view-btn ${viewMode === 'list' ? 'habit-list__view-btn--active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              ☰
            </button>
            <button 
              className={`habit-list__view-btn ${viewMode === 'visual' ? 'habit-list__view-btn--active' : ''}`}
              onClick={() => setViewMode('visual')}
              title="Timeline view"
            >
              ▤
            </button>
          </div>
          <div className="habit-list__progress">
            <div className="habit-list__progress-text">
              <span>{completedCount}/{totalCount}</span>
              <span className="habit-list__progress-label">completed</span>
            </div>
            <div className="habit-list__progress-bar">
              <div 
                className="habit-list__progress-fill"
                style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Visual Timeline View */}
      {viewMode === 'visual' && (
        <div className="habit-list__visual">
          {/* Active boundaries banner */}
          {activeBoundaries.length > 0 && (
            <div className="habit-list__boundaries-banner">
              <span className="habit-list__boundaries-icon">🛡️</span>
              <span className="habit-list__boundaries-label">Active:</span>
              {activeBoundaries.map(b => (
                <span key={b.id} className="habit-list__boundary-tag">
                  {b.icon || '🚫'} {b.name}
                </span>
              ))}
            </div>
          )}

          {/* All boundaries summary */}
          {boundaries.length > 0 && (
            <div className="habit-list__boundaries-summary">
              {boundaries.map(b => (
                <div key={b.id} className="habit-list__boundary-row">
                  <span className="habit-list__boundary-time">
                    {b.time_start} → {b.time_end}
                  </span>
                  <div className="habit-list__boundary-bar">
                    <span className="habit-list__boundary-name">
                      {b.icon || '🚫'} {b.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Visual timeline for habits */}
          <div className="habit-list__visual-timeline">
            {doHabits.map(habit => {
              const startTime = habit.scheduled_time || '09:00'
              const duration = habit.duration_minutes || 30
              const height = durationToHeight(duration)
              const isChecked = checkedIds.has(habit.id)
              
              return (
                <div 
                  key={habit.id} 
                  className={`habit-list__visual-block ${isChecked ? 'habit-list__visual-block--done' : ''}`}
                  style={{ minHeight: `${height}px` }}
                  onClick={() => isChecked ? onUncheck(habit.id) : onCheck(habit.id)}
                >
                  <div className="habit-list__visual-time">{startTime}</div>
                  <div className="habit-list__visual-content">
                    <span className="habit-list__visual-icon">{habit.icon || '✨'}</span>
                    <span className="habit-list__visual-name">{habit.name}</span>
                    {duration && (
                      <span className="habit-list__visual-duration">{duration}min</span>
                    )}
                  </div>
                  {isChecked && <span className="habit-list__visual-check">✓</span>}
                </div>
              )
            })}
          </div>

          {/* Now marker */}
          <div className="habit-list__visual-now">
            <span className="habit-list__visual-now-dot" />
            <span className="habit-list__visual-now-label">Now {currentTime}</span>
          </div>
        </div>
      )}

      {/* List View (original) */}
      {viewMode === 'list' && (
      <div className="habit-list__timeline">
        {sortedHabits.map((habit, index) => (
          <div key={habit.id}>
            <div 
              className={`habit-list__timeline-item ${index === sortedHabits.length - 1 ? 'habit-list__timeline-item--last' : ''}`}
            >
              {/* Timeline connector */}
              <div className="habit-list__timeline-track">
                <div className={`habit-list__timeline-dot ${checkedIds.has(habit.id) ? 'habit-list__timeline-dot--done' : ''} ${habit.id === firstUncheckedId ? 'habit-list__timeline-dot--current' : ''}`} />
                {index < sortedHabits.length - 1 && (
                  <div className={`habit-list__timeline-line ${checkedIds.has(habit.id) ? 'habit-list__timeline-line--done' : ''}`}>
                    {/* Now marker on the line if next habit is after current time */}
                    {index + 1 === nowIndex && (
                      <>
                        <div className="habit-list__now-inline">
                          <div className="habit-list__now-dot" />
                        </div>
                        <span className="habit-list__now-time">{currentTime}</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Time label */}
              <div className="habit-list__timeline-time">
                {getDisplayTime(habit) || '—'}
              </div>

              {/* Habit card */}
              <div className="habit-list__timeline-content">
                <HabitItem
                  habit={habit}
                  isChecked={checkedIds.has(habit.id)}
                  isCurrent={habit.id === firstUncheckedId}
                  onToggle={() => {
                    if (checkedIds.has(habit.id)) {
                      onUncheck(habit.id)
                    } else {
                      onCheck(habit.id)
                    }
                  }}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onMarkViolated={onMarkViolated}
                />
              </div>
            </div>
          </div>
        ))}

        {/* Now marker at the end if all habits are before current time */}
        {nowIndex === -1 && sortedHabits.length > 0 && (
          <div className="habit-list__now-end">
            <div className="habit-list__now-end-track">
              <div className="habit-list__now-dot" />
            </div>
            <span className="habit-list__now-time">{currentTime}</span>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
