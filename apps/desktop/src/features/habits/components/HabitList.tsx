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

type ViewMode = 'list' | 'visual' | 'calendar'

// Calendar constants
const HOUR_HEIGHT = 50 // pixels per hour
const START_HOUR = 6 // 6am
const END_HOUR = 22 // 10pm

function getCurrentTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

// Convert time string to minutes from midnight
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function HabitList({ habits, checkedIds, onCheck, onUncheck, onEdit, onDelete, onMarkViolated }: HabitListProps) {
  const [currentTime, setCurrentTime] = useState(getCurrentTime)
  const [viewMode, setViewMode] = useState<ViewMode>('visual') // Timeline view by default

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

  return (
    <div className="habit-list">
      <div className="habit-list__section-header">
        <div className="habit-list__title-row">
          <h2 className="habit-list__section-title">Today's Focus</h2>
          <div className="habit-list__view-toggle">
            <button 
              className={`habit-list__view-btn ${viewMode === 'calendar' ? 'habit-list__view-btn--active' : ''}`}
              onClick={() => setViewMode('calendar')}
              title="Calendar view"
            >
              📅
            </button>
            <button 
              className={`habit-list__view-btn ${viewMode === 'visual' ? 'habit-list__view-btn--active' : ''}`}
              onClick={() => setViewMode('visual')}
              title="Timeline view"
            >
              ▤
            </button>
            <button 
              className={`habit-list__view-btn ${viewMode === 'list' ? 'habit-list__view-btn--active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              ☰
            </button>
          </div>
        </div>
        <div className="habit-list__progress">
          <div className="habit-list__progress-bar">
            <div 
              className="habit-list__progress-fill"
              style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
          <div className="habit-list__progress-text">
            <span>{completedCount}/{totalCount}</span>
            <span className="habit-list__progress-label">completed</span>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="habit-list__calendar">
          {/* Hour grid */}
          <div className="habit-list__calendar-grid">
            {/* Hour labels and lines */}
            {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => {
              const hour = START_HOUR + i
              return (
                <div 
                  key={hour} 
                  className="habit-list__calendar-hour"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                >
                  <span className="habit-list__calendar-hour-label">
                    {String(hour).padStart(2, '0')}:00
                  </span>
                  <div className="habit-list__calendar-hour-line" />
                </div>
              )
            })}

            {/* Now marker */}
            {(() => {
              const nowMinutes = timeToMinutes(currentTime)
              const startMinutes = START_HOUR * 60
              const endMinutes = END_HOUR * 60
              if (nowMinutes >= startMinutes && nowMinutes <= endMinutes) {
                const topPosition = ((nowMinutes - startMinutes) / 60) * HOUR_HEIGHT
                return (
                  <div 
                    className="habit-list__calendar-now"
                    style={{ top: `${topPosition}px` }}
                  >
                    <span className="habit-list__calendar-now-dot" />
                    <span className="habit-list__calendar-now-line" />
                    <span className="habit-list__calendar-now-time">{currentTime}</span>
                  </div>
                )
              }
              return null
            })()}

            {/* Habit blocks */}
            {doHabits.map(habit => {
              if (!habit.scheduled_time) return null
              
              const habitMinutes = timeToMinutes(habit.scheduled_time)
              const startMinutes = START_HOUR * 60
              const endMinutes = END_HOUR * 60
              
              // Skip if outside visible range
              if (habitMinutes < startMinutes || habitMinutes > endMinutes) return null
              
              const topPosition = ((habitMinutes - startMinutes) / 60) * HOUR_HEIGHT
              const duration = habit.duration_minutes || 30
              const height = (duration / 60) * HOUR_HEIGHT
              const isChecked = checkedIds.has(habit.id)
              
              return (
                <div
                  key={habit.id}
                  className={`habit-list__calendar-block ${isChecked ? 'habit-list__calendar-block--done' : ''}`}
                  style={{ 
                    top: `${topPosition}px`,
                    height: `${Math.max(height, 30)}px`
                  }}
                  onClick={() => isChecked ? onUncheck(habit.id) : onCheck(habit.id)}
                >
                  <span className="habit-list__calendar-block-icon">{habit.icon || '✨'}</span>
                  <span className="habit-list__calendar-block-name">{habit.name}</span>
                  {isChecked && <span className="habit-list__calendar-block-check">✓</span>}
                </div>
              )
            })}

            {/* Boundary blocks */}
            {boundaries.map(b => {
              if (!b.time_start || !b.time_end) return null
              
              const startMin = timeToMinutes(b.time_start)
              const endMin = timeToMinutes(b.time_end)
              const gridStart = START_HOUR * 60
              const gridEnd = END_HOUR * 60
              
              // Clamp to visible range
              const visibleStart = Math.max(startMin, gridStart)
              const visibleEnd = Math.min(endMin, gridEnd)
              
              if (visibleStart >= visibleEnd) return null
              
              const topPosition = ((visibleStart - gridStart) / 60) * HOUR_HEIGHT
              const height = ((visibleEnd - visibleStart) / 60) * HOUR_HEIGHT
              const isActive = activeBoundaries.some(ab => ab.id === b.id)
              
              return (
                <div
                  key={b.id}
                  className={`habit-list__calendar-boundary ${isActive ? 'habit-list__calendar-boundary--active' : ''}`}
                  style={{ 
                    top: `${topPosition}px`,
                    height: `${height}px`
                  }}
                >
                  <span className="habit-list__calendar-boundary-icon">{b.icon || '🛡️'}</span>
                  <span className="habit-list__calendar-boundary-name">{b.name}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Visual Timeline View */}
      {viewMode === 'visual' && (
        <div className="habit-list__visual">
          {/* Visual timeline for habits */}
          <div className="habit-list__visual-timeline">
            {doHabits.map(habit => {
              const startTime = habit.scheduled_time || '—'
              const duration = habit.duration_minutes
              const isChecked = checkedIds.has(habit.id)
              
              return (
                <div 
                  key={habit.id} 
                  className={`habit-list__visual-block ${isChecked ? 'habit-list__visual-block--done' : ''}`}
                  onClick={() => isChecked ? onUncheck(habit.id) : onCheck(habit.id)}
                >
                  <div className="habit-list__visual-time">{startTime}</div>
                  <div className="habit-list__visual-content">
                    <span className="habit-list__visual-icon">{habit.icon || '✨'}</span>
                    <span className="habit-list__visual-name">{habit.name}</span>
                  </div>
                  {duration && (
                    <span className="habit-list__visual-duration">{duration}m</span>
                  )}
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

          {/* Boundaries section */}
          {boundaries.length > 0 && (
            <div className="habit-list__boundaries-section">
              <div className="habit-list__boundaries-header">
                <span className="habit-list__boundaries-title">🛡️ Boundaries</span>
                {activeBoundaries.length > 0 && (
                  <span className="habit-list__boundaries-active-badge">
                    {activeBoundaries.length} active
                  </span>
                )}
              </div>
              <div className="habit-list__boundaries-list">
                {boundaries.map(b => {
                  const isActive = activeBoundaries.some(ab => ab.id === b.id)
                  const isPast = b.time_end && timeToMinutes(b.time_end) < currentMinutes
                  return (
                    <div 
                      key={b.id} 
                      className={`habit-list__boundary-item ${isActive ? 'habit-list__boundary-item--active' : ''} ${isPast ? 'habit-list__boundary-item--past' : ''}`}
                    >
                      <span className="habit-list__boundary-icon">{b.icon || '🚫'}</span>
                      <span className="habit-list__boundary-name">{b.name}</span>
                      <span className="habit-list__boundary-time">
                        {b.time_start} → {b.time_end}
                      </span>
                      {isActive && <span className="habit-list__boundary-status">⏳</span>}
                      {isPast && !isActive && <span className="habit-list__boundary-status">✓</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
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
