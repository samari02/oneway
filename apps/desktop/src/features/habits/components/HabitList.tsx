import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
  onCreateHabit?: (time: string, duration: number, dayOffset?: number) => void
  onUpdateHabitTime?: (habitId: string, newTime: string) => void
}

type ViewMode = 'list' | 'visual' | 'calendar'
type CalendarMode = 'day' | 'week'

// Calendar constants
const HOUR_HEIGHT = 80 // pixels per hour (increased for better visibility)
const START_HOUR = 0 // midnight
const END_HOUR = 24 // midnight (full day)
const TOTAL_HOURS = END_HOUR - START_HOUR
const GRID_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT
const GRID_PADDING = 10 // Top padding so first hour is visible
const SNAP_MINUTES = 15 // Snap to 15-minute increments
const SNAP_HEIGHT = (SNAP_MINUTES / 60) * HOUR_HEIGHT // 15px per 15 minutes

function getCurrentTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

// Convert time string to minutes from midnight
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function HabitList({ habits, checkedIds, onCheck, onUncheck, onEdit, onDelete, onMarkViolated, onCreateHabit, onUpdateHabitTime }: HabitListProps) {
  const [currentTime, setCurrentTime] = useState(getCurrentTime)
  
  // Persist viewMode in localStorage to survive re-renders and re-mounts
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('clarity-habit-view-mode')
    return (saved as ViewMode) || 'visual'
  })
  
  // Calendar mode (day/week) - also persisted
  const [calendarMode, setCalendarMode] = useState<CalendarMode>(() => {
    const saved = localStorage.getItem('clarity-calendar-mode')
    return (saved as CalendarMode) || 'day'
  })
  
  // Save viewMode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('clarity-habit-view-mode', viewMode)
  }, [viewMode])
  
  // Save calendarMode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('clarity-calendar-mode', calendarMode)
  }, [calendarMode])
  
  // Week view helpers
  const getWeekDays = useMemo(() => {
    const today = new Date()
    const dayOfWeek = today.getDay() // 0 = Sunday
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7)) // Go to Monday
    
    const days = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday)
      date.setDate(monday.getDate() + i)
      days.push({
        date,
        dayName: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
        dayNumber: date.getDate(),
        isToday: date.toDateString() === today.toDateString(),
        dayOffset: i - ((dayOfWeek + 6) % 7) // Offset from today
      })
    }
    return days
  }, [])
  
  // Drag state for calendar
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ y: number; time: string } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ y: number; time: string } | null>(null)
  const [draggingHabit, setDraggingHabit] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [hasMoved, setHasMoved] = useState(false) // Track if mouse actually moved (to distinguish click from drag)
  
  // Optimistic position updates (to prevent flash back to old position)
  const [optimisticTimes, setOptimisticTimes] = useState<Record<string, string>>({})
  
  const calendarGridRef = useRef<HTMLDivElement>(null)
  const calendarScrollRef = useRef<HTMLDivElement>(null)
  const hoursColumnRef = useRef<HTMLDivElement>(null)

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTime())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Clear optimistic times when habits data is updated (real data arrived)
  useEffect(() => {
    setOptimisticTimes({})
  }, [habits])

  // Snap Y position to 15-minute grid (floor = snap to earlier time slot)
  const snapY = useCallback((y: number): number => {
    const snapped = Math.floor(y / SNAP_HEIGHT) * SNAP_HEIGHT
    return Math.max(0, Math.min(GRID_HEIGHT, snapped))
  }, [])

  // Convert Y position to time string (already snapped)
  const yToTime = useCallback((y: number): string => {
    const snappedY = snapY(y)
    const minutes = (snappedY / HOUR_HEIGHT) * 60 + START_HOUR * 60
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
  }, [snapY])

  // Handle mouse down on calendar grid (start drag to create)
  const handleGridMouseDown = useCallback((e: React.MouseEvent) => {
    if (!calendarGridRef.current) return
    // Ignore if clicking on a habit block
    if ((e.target as HTMLElement).closest('.habit-list__calendar-block')) return
    
    const rect = calendarGridRef.current.getBoundingClientRect()
    const rawY = e.clientY - rect.top
    const snappedY = snapY(rawY)
    const time = yToTime(snappedY)
    
    setIsDragging(true)
    setDragStart({ y: snappedY, time })
    setDragEnd({ y: snappedY, time })
  }, [yToTime, snapY])

  // Handle mouse move during drag
  const handleGridMouseMove = useCallback((e: React.MouseEvent) => {
    if (!calendarGridRef.current) return
    
    const rect = calendarGridRef.current.getBoundingClientRect()
    const rawY = Math.max(0, Math.min(GRID_HEIGHT, e.clientY - rect.top))
    const snappedY = snapY(rawY)
    const time = yToTime(snappedY)
    
    if (isDragging && dragStart) {
      setDragEnd({ y: snappedY, time })
    }
    
    // Activate habit drag only after mouse has moved enough (5px threshold)
    if (pendingDragRef.current && !draggingHabit) {
      const moveDistance = Math.abs(rawY - pendingDragRef.current.startY)
      if (moveDistance > 5) {
        setDraggingHabit(pendingDragRef.current.habitId)
        setDragOffset(pendingDragRef.current.offset)
        setHasMoved(true)
      }
    }
    
    if (draggingHabit) {
      const habitRawY = rawY - dragOffset
      const habitSnappedY = snapY(habitRawY)
      setDragEnd({ y: habitSnappedY, time: yToTime(habitSnappedY) })
      setHasMoved(true) // Mark that we actually moved (it's a real drag, not a click)
    }
  }, [isDragging, dragStart, draggingHabit, dragOffset, yToTime, snapY])

  // Handle mouse up (end drag)
  const handleGridMouseUp = useCallback(() => {
    if (isDragging && dragStart && dragEnd && onCreateHabit) {
      const startMinutes = timeToMinutes(dragStart.time)
      const endMinutes = timeToMinutes(dragEnd.time)
      const duration = Math.abs(endMinutes - startMinutes)
      
      if (duration >= 15) { // Minimum 15 minutes
        const startTime = startMinutes < endMinutes ? dragStart.time : dragEnd.time
        onCreateHabit(startTime, duration)
      }
    }
    
    // Only update time if mouse actually moved (real drag, not just a click)
    if (draggingHabit && dragEnd && onUpdateHabitTime && hasMoved) {
      // Store optimistic position BEFORE clearing drag state
      setOptimisticTimes(prev => ({ ...prev, [draggingHabit]: dragEnd.time }))
      onUpdateHabitTime(draggingHabit, dragEnd.time)
    }
    
    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
    setDraggingHabit(null)
    setHasMoved(false)
    pendingDragRef.current = null
  }, [isDragging, dragStart, dragEnd, draggingHabit, hasMoved, onCreateHabit, onUpdateHabitTime])

  // Store pending drag info (don't set draggingHabit until mouse actually moves)
  const pendingDragRef = useRef<{ habitId: string; offset: number; startY: number } | null>(null)
  
  // Handle habit drag start (just store info, don't change state yet)
  const handleHabitDragStart = useCallback((e: React.MouseEvent, habitId: string, habitTop: number) => {
    e.stopPropagation()
    if (!calendarGridRef.current) return
    
    const rect = calendarGridRef.current.getBoundingClientRect()
    const y = e.clientY - rect.top
    const offset = y - habitTop
    
    // Store pending drag info, but don't activate dragging yet
    pendingDragRef.current = { habitId, offset, startY: y }
  }, [])

  // Sync scroll between hours column and grid
  const handleCalendarScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (hoursColumnRef.current) {
      hoursColumnRef.current.scrollTop = e.currentTarget.scrollTop
    }
  }, [])

  // Auto-scroll to 7am when calendar view is shown
  useEffect(() => {
    if (viewMode === 'calendar' && calendarScrollRef.current) {
      const scrollTo7am = 7 * HOUR_HEIGHT // 7am position
      calendarScrollRef.current.scrollTop = scrollTo7am
      if (hoursColumnRef.current) {
        hoursColumnRef.current.scrollTop = scrollTo7am
      }
    }
  }, [viewMode])

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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </button>
            <button 
              className={`habit-list__view-btn ${viewMode === 'visual' ? 'habit-list__view-btn--active' : ''}`}
              onClick={() => setViewMode('visual')}
              title="Timeline view"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="15" y2="18"/>
              </svg>
            </button>
            <button 
              className={`habit-list__view-btn ${viewMode === 'list' ? 'habit-list__view-btn--active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <circle cx="4" cy="6" r="1" fill="currentColor"/>
                <circle cx="4" cy="12" r="1" fill="currentColor"/>
                <circle cx="4" cy="18" r="1" fill="currentColor"/>
              </svg>
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
        <div className="habit-list__calendar-container">
          {/* Day/Week Toggle */}
          <div className="habit-list__calendar-mode-toggle">
            <button 
              className={`habit-list__mode-btn ${calendarMode === 'day' ? 'habit-list__mode-btn--active' : ''}`}
              onClick={() => setCalendarMode('day')}
            >
              Day
            </button>
            <button 
              className={`habit-list__mode-btn ${calendarMode === 'week' ? 'habit-list__mode-btn--active' : ''}`}
              onClick={() => setCalendarMode('week')}
            >
              Week
            </button>
          </div>

          {/* Boundaries Timeline (Cold Turkey style) */}
          {boundaries.length > 0 && (
            <div className="habit-list__boundaries-timeline">
              <div className="habit-list__boundaries-timeline-header">
                <span className="habit-list__boundaries-timeline-title">Boundaries</span>
              </div>
              <div className="habit-list__boundaries-timeline-content">
                {/* Time axis */}
                <div className="habit-list__boundaries-timeline-axis">
                  {calendarMode === 'day' ? (
                    // Day view: hours on X axis
                    <>
                      {Array.from({ length: 13 }, (_, i) => {
                        const hour = i * 2
                        return (
                          <span key={hour} className="habit-list__timeline-hour">
                            {hour === 0 ? '12am' : hour === 12 ? '12pm' : hour < 12 ? `${hour}am` : `${hour - 12}pm`}
                          </span>
                        )
                      })}
                    </>
                  ) : (
                    // Week view: days on X axis
                    <>
                      <span className="habit-list__timeline-label-spacer" />
                      {getWeekDays.map(day => (
                        <span 
                          key={day.dayNumber} 
                          className={`habit-list__timeline-day ${day.isToday ? 'habit-list__timeline-day--today' : ''}`}
                        >
                          {day.dayName} {day.dayNumber}
                        </span>
                      ))}
                    </>
                  )}
                </div>
                
                {/* Boundary rows */}
                {boundaries.map(b => {
                  const startMin = b.time_start ? timeToMinutes(b.time_start) : 0
                  const endMin = b.time_end ? timeToMinutes(b.time_end) : 1440
                  const startPercent = (startMin / 1440) * 100
                  const widthPercent = ((endMin - startMin) / 1440) * 100
                  
                  return (
                    <div 
                      key={b.id} 
                      className="habit-list__boundaries-timeline-row"
                      onClick={() => onEdit?.(b)}
                    >
                      <span className="habit-list__boundaries-timeline-label">
                        {b.icon || '🛡️'} {b.name}
                      </span>
                      <div className="habit-list__boundaries-timeline-track">
                        {calendarMode === 'day' ? (
                          // Day view: single bar showing active hours
                          <div 
                            className="habit-list__boundaries-timeline-bar"
                            style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
                          />
                        ) : (
                          // Week view: show time range within each day cell
                          getWeekDays.map(day => (
                            <div 
                              key={day.dayNumber}
                              className="habit-list__boundaries-timeline-day-cell"
                            >
                              <div 
                                className="habit-list__boundaries-timeline-bar habit-list__boundaries-timeline-bar--day"
                                style={{ 
                                  left: `${startPercent}%`, 
                                  width: `${widthPercent}%` 
                                }}
                              />
                            </div>
                          ))
                        )}
                        {/* Now marker (day view only) */}
                        {calendarMode === 'day' && (
                          <div 
                            className="habit-list__boundaries-timeline-now"
                            style={{ left: `${(timeToMinutes(currentTime) / 1440) * 100}%` }}
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Day View Calendar */}
          {calendarMode === 'day' && (
          <div className="habit-list__calendar">
          {/* Hour labels column - syncs with scroll */}
          <div className="habit-list__calendar-hours" ref={hoursColumnRef}>
            <div className="habit-list__calendar-hours-inner" style={{ height: `${GRID_HEIGHT + GRID_PADDING * 2}px` }}>
              {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
                const hour = START_HOUR + i
                return (
                  <div 
                    key={hour} 
                    className="habit-list__calendar-hour-label"
                    style={{ top: `${GRID_PADDING + i * HOUR_HEIGHT}px` }}
                  >
                    {String(hour).padStart(2, '0')}:00
                  </div>
                )
              })}
            </div>
          </div>

          {/* Scrollable grid container */}
          <div 
            className="habit-list__calendar-scroll"
            ref={calendarScrollRef}
            onScroll={handleCalendarScroll}
          >
            {/* Main grid area */}
            <div 
              className={`habit-list__calendar-grid ${isDragging || draggingHabit ? 'habit-list__calendar-grid--dragging' : ''}`}
              ref={calendarGridRef}
              style={{ height: `${GRID_HEIGHT + GRID_PADDING * 2}px` }}
              onMouseDown={handleGridMouseDown}
              onMouseMove={handleGridMouseMove}
              onMouseUp={handleGridMouseUp}
              onMouseLeave={handleGridMouseUp}
            >
            {/* Hour lines */}
            {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
              <div 
                key={`hour-${i}`} 
                className="habit-list__calendar-hour-line"
                style={{ top: `${GRID_PADDING + i * HOUR_HEIGHT}px` }}
              />
            ))}

            {/* 15-minute gridlines (subtle) */}
            {Array.from({ length: TOTAL_HOURS * 4 }, (_, i) => {
              // Skip lines that overlap with hour lines (0, 4, 8, ...)
              if (i % 4 === 0) return null
              return (
                <div 
                  key={`quarter-${i}`} 
                  className="habit-list__calendar-quarter-line"
                  style={{ top: `${GRID_PADDING + i * SNAP_HEIGHT}px` }}
                />
              )
            })}

            {/* Now marker */}
            {(() => {
              const nowMinutes = timeToMinutes(currentTime)
              const startMinutes = START_HOUR * 60
              const endMinutes = END_HOUR * 60
              if (nowMinutes >= startMinutes && nowMinutes <= endMinutes) {
                const topPosition = GRID_PADDING + ((nowMinutes - startMinutes) / 60) * HOUR_HEIGHT
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

            {/* Drag preview (creating new habit) */}
            {isDragging && dragStart && dragEnd && (
              <div
                className="habit-list__calendar-drag-preview"
                style={{
                  top: `${GRID_PADDING + Math.min(dragStart.y, dragEnd.y)}px`,
                  height: `${Math.abs(dragEnd.y - dragStart.y)}px`
                }}
              >
                <span className="habit-list__calendar-drag-time">
                  {dragStart.y < dragEnd.y ? dragStart.time : dragEnd.time} → {dragStart.y < dragEnd.y ? dragEnd.time : dragStart.time}
                </span>
              </div>
            )}

            {/* Boundary and Habit blocks */}
            {(() => {
              // Calculate columns for overlapping boundaries
              const boundaryPositions: { id: string; start: number; end: number; column: number }[] = []
              
              boundaries.forEach(b => {
                if (!b.time_start || !b.time_end) return
                const displayStartTime = optimisticTimes[b.id] || b.time_start
                const start = timeToMinutes(displayStartTime)
                const end = timeToMinutes(b.time_end)
                
                // Find which column to place this boundary
                let column = 0
                while (boundaryPositions.some(bp => 
                  bp.column === column && 
                  !(end <= bp.start || start >= bp.end) // Check overlap
                )) {
                  column++
                }
                
                boundaryPositions.push({ id: b.id, start, end, column })
              })
              
              const maxColumns = boundaryPositions.length > 0 
                ? Math.max(...boundaryPositions.map(bp => bp.column + 1))
                : 0
              const pillWidth = 56
              const pillGap = 4
              const habitsLeftOffset = maxColumns > 0 
                ? 4 + maxColumns * (pillWidth + pillGap) + 4
                : 8
              
              return (
                <>
                  {/* Boundary pills */}
                  {boundaries.map(b => {
                    if (!b.time_start || !b.time_end) return null
                    
                    const displayStartTime = optimisticTimes[b.id] || b.time_start
                    const startMin = timeToMinutes(displayStartTime)
                    const endMin = timeToMinutes(b.time_end)
                    const duration = endMin - startMin
                    const gridStart = START_HOUR * 60
                    const gridEnd = END_HOUR * 60
                    
                    const visibleStart = Math.max(startMin, gridStart)
                    const visibleEnd = Math.min(startMin + duration, gridEnd)
                    
                    if (visibleStart >= visibleEnd) return null
                    
                    let topPosition = GRID_PADDING + ((visibleStart - gridStart) / 60) * HOUR_HEIGHT
                    const height = ((visibleEnd - visibleStart) / 60) * HOUR_HEIGHT
                    const isActive = activeBoundaries.some(ab => ab.id === b.id)
                    const isBeingDragged = draggingHabit === b.id
                    
                    // Get column for this boundary
                    const boundaryPos = boundaryPositions.find(bp => bp.id === b.id)
                    const column = boundaryPos?.column || 0
                    const leftOffset = 4 + column * (pillWidth + pillGap)
                    
                    // Use drag position if being dragged
                    if (isBeingDragged && dragEnd) {
                      topPosition = GRID_PADDING + dragEnd.y
                    }
                    
                    return (
                      <div
                        key={b.id}
                        className={`habit-list__calendar-boundary ${isActive ? 'habit-list__calendar-boundary--active' : ''} ${isBeingDragged ? 'habit-list__calendar-boundary--dragging' : ''}`}
                        style={{ 
                          top: `${topPosition}px`, 
                          height: `${Math.max(height, 60)}px`,
                          left: `${leftOffset}px`
                        }}
                        onClick={(e) => {
                          if (!isBeingDragged && !hasMoved && onEdit) {
                            e.stopPropagation()
                            onEdit(b)
                          }
                        }}
                        onMouseDown={(e) => handleHabitDragStart(e, b.id, topPosition)}
                      >
                        <span className="habit-list__calendar-boundary-icon">{b.icon || '🛡️'}</span>
                        <span className="habit-list__calendar-boundary-name">{b.name}</span>
                        <span className="habit-list__calendar-boundary-time">{b.time_start}–{b.time_end}</span>
                      </div>
                    )
                  })}
                  
                  {/* Habit blocks */}
                  {doHabits.map(habit => {
                    if (!habit.scheduled_time) return null
                    
                    const displayTime = optimisticTimes[habit.id] || habit.scheduled_time
                    const habitMinutes = timeToMinutes(displayTime)
                    const startMinutes = START_HOUR * 60
                    const endMinutes = END_HOUR * 60
                    
                    if (habitMinutes < startMinutes || habitMinutes > endMinutes) return null
                    
                    let topPosition = GRID_PADDING + ((habitMinutes - startMinutes) / 60) * HOUR_HEIGHT
                    const duration = habit.duration_minutes || 30
                    const height = (duration / 60) * HOUR_HEIGHT
                    const isChecked = checkedIds.has(habit.id)
                    const isBeingDragged = draggingHabit === habit.id
                    
                    if (isBeingDragged && dragEnd) {
                      topPosition = GRID_PADDING + dragEnd.y
                    }
                    
                    return (
                      <div
                        key={habit.id}
                        className={`habit-list__calendar-block ${isChecked ? 'habit-list__calendar-block--done' : ''} ${isBeingDragged ? 'habit-list__calendar-block--dragging' : ''}`}
                        style={{ 
                          top: `${topPosition}px`,
                          height: `${Math.max(height, 30)}px`,
                          left: `${habitsLeftOffset}px`
                        }}
                        onClick={(e) => {
                          if (!isBeingDragged && !hasMoved && onEdit) {
                            e.stopPropagation()
                            onEdit(habit)
                          }
                        }}
                        onMouseDown={(e) => handleHabitDragStart(e, habit.id, topPosition)}
                      >
                        <span 
                          className={`habit-list__calendar-block-checkbox ${isChecked ? 'habit-list__calendar-block-checkbox--checked' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            isChecked ? onUncheck(habit.id) : onCheck(habit.id)
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          {isChecked ? '✓' : ''}
                        </span>
                        <span className="habit-list__calendar-block-icon">{habit.icon || '✨'}</span>
                        <span className="habit-list__calendar-block-name">{habit.name}</span>
                        <span className="habit-list__calendar-block-time">{habit.scheduled_time}</span>
                      </div>
                    )
                  })}
                </>
              )
            })()}
            </div>
          </div>
        </div>
          )}

          {/* Week View Calendar */}
          {calendarMode === 'week' && (
            <div className="habit-list__week">
              {/* Week header */}
              <div className="habit-list__week-header">
                <div className="habit-list__week-hour-spacer" />
                {getWeekDays.map(day => (
                  <div 
                    key={day.dayNumber} 
                    className={`habit-list__week-day-header ${day.isToday ? 'habit-list__week-day-header--today' : ''}`}
                  >
                    <span className="habit-list__week-day-name">{day.dayName}</span>
                    <span className="habit-list__week-day-number">{day.dayNumber}</span>
                  </div>
                ))}
              </div>

              {/* Week grid */}
              <div className="habit-list__week-scroll">
                <div className="habit-list__week-grid">
                  {/* Hour labels */}
                  <div className="habit-list__week-hours">
                    {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
                      const hour = START_HOUR + i
                      return (
                        <div 
                          key={hour} 
                          className="habit-list__week-hour-label"
                          style={{ top: `${GRID_PADDING + i * HOUR_HEIGHT}px` }}
                        >
                          {String(hour).padStart(2, '0')}:00
                        </div>
                      )
                    })}
                  </div>

                  {/* Day columns */}
                  {getWeekDays.map((day, dayIndex) => (
                    <div 
                      key={day.dayNumber} 
                      className={`habit-list__week-day-column ${day.isToday ? 'habit-list__week-day-column--today' : ''}`}
                      style={{ height: `${GRID_HEIGHT + GRID_PADDING * 2}px` }}
                      onMouseDown={(e) => {
                        // Allow creating habits on any day
                        const rect = e.currentTarget.getBoundingClientRect()
                        const rawY = e.clientY - rect.top
                        const snappedY = snapY(rawY)
                        const time = yToTime(snappedY)
                        
                        setIsDragging(true)
                        setDragStart({ y: snappedY, time })
                        setDragEnd({ y: snappedY, time })
                        // Store day offset for habit creation
                        ;(window as unknown as Record<string, number>).__habitDayOffset = day.dayOffset
                      }}
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        const rawY = Math.max(0, Math.min(GRID_HEIGHT, e.clientY - rect.top))
                        const snappedY = snapY(rawY)
                        const time = yToTime(snappedY)
                        
                        if (isDragging) {
                          setDragEnd({ y: snappedY, time })
                        }
                        
                        // Activate habit drag only after mouse has moved enough
                        if (pendingDragRef.current && !draggingHabit) {
                          const moveDistance = Math.abs(rawY - pendingDragRef.current.startY)
                          if (moveDistance > 5) {
                            setDraggingHabit(pendingDragRef.current.habitId)
                            setDragOffset(pendingDragRef.current.offset)
                            setHasMoved(true)
                          }
                        }
                        
                        if (draggingHabit) {
                          const habitRawY = rawY - dragOffset
                          const habitSnappedY = snapY(habitRawY)
                          setDragEnd({ y: habitSnappedY, time: yToTime(habitSnappedY) })
                          setHasMoved(true)
                        }
                      }}
                      onMouseUp={() => {
                        if (isDragging && dragStart && dragEnd && onCreateHabit) {
                          const startMinutes = timeToMinutes(dragStart.time)
                          const endMinutes = timeToMinutes(dragEnd.time)
                          const duration = Math.abs(endMinutes - startMinutes)
                          
                          if (duration >= 15) {
                            const startTime = startMinutes < endMinutes ? dragStart.time : dragEnd.time
                            const dayOffset = (window as unknown as Record<string, number>).__habitDayOffset || 0
                            onCreateHabit(startTime, duration, dayOffset)
                          }
                        }
                        
                        if (draggingHabit && dragEnd && onUpdateHabitTime && hasMoved) {
                          setOptimisticTimes(prev => ({ ...prev, [draggingHabit]: dragEnd.time }))
                          onUpdateHabitTime(draggingHabit, dragEnd.time)
                        }
                        
                        setIsDragging(false)
                        setDragStart(null)
                        setDragEnd(null)
                        setDraggingHabit(null)
                        setHasMoved(false)
                        pendingDragRef.current = null
                      }}
                      onMouseLeave={() => {
                        // Clean up if mouse leaves column while dragging
                        if (isDragging || draggingHabit) {
                          setIsDragging(false)
                          setDragStart(null)
                          setDragEnd(null)
                          setDraggingHabit(null)
                          setHasMoved(false)
                          pendingDragRef.current = null
                        }
                      }}
                    >
                      {/* Hour lines */}
                      {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
                        <div 
                          key={`hour-${i}`} 
                          className="habit-list__week-hour-line"
                          style={{ top: `${GRID_PADDING + i * HOUR_HEIGHT}px` }}
                        />
                      ))}

                      {/* Now marker (only on today) */}
                      {day.isToday && (() => {
                        const nowMinutes = timeToMinutes(currentTime)
                        const topPosition = GRID_PADDING + ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT
                        return (
                          <div 
                            className="habit-list__week-now"
                            style={{ top: `${topPosition}px` }}
                          />
                        )
                      })()}

                      {/* Habits for this day (currently shows all habits on each day) */}
                      {/* TODO: Filter by day_of_week when we add that field */}
                      {doHabits.map(habit => {
                        if (!habit.scheduled_time) return null
                        
                        const displayTime = optimisticTimes[habit.id] || habit.scheduled_time
                        const habitMinutes = timeToMinutes(displayTime)
                        const startMinutes = START_HOUR * 60
                        const endMinutes = END_HOUR * 60
                        
                        if (habitMinutes < startMinutes || habitMinutes > endMinutes) return null
                        
                        let topPosition = GRID_PADDING + ((habitMinutes - startMinutes) / 60) * HOUR_HEIGHT
                        const duration = habit.duration_minutes || 30
                        const height = (duration / 60) * HOUR_HEIGHT
                        const isChecked = checkedIds.has(habit.id)
                        const isBeingDragged = draggingHabit === habit.id
                        
                        if (isBeingDragged && dragEnd) {
                          topPosition = GRID_PADDING + dragEnd.y
                        }
                        
                        return (
                          <div
                            key={habit.id}
                            className={`habit-list__week-block ${isChecked ? 'habit-list__week-block--done' : ''} ${isBeingDragged ? 'habit-list__week-block--dragging' : ''}`}
                            style={{ 
                              top: `${topPosition}px`,
                              height: `${Math.max(height, 24)}px`
                            }}
                            onClick={(e) => {
                              if (!isBeingDragged && !hasMoved && onEdit) {
                                e.stopPropagation()
                                onEdit(habit)
                              }
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              const rect = e.currentTarget.parentElement!.getBoundingClientRect()
                              const y = e.clientY - rect.top
                              const offset = y - topPosition
                              pendingDragRef.current = { habitId: habit.id, offset, startY: y }
                            }}
                          >
                            <span 
                              className={`habit-list__week-block-checkbox ${isChecked ? 'habit-list__week-block-checkbox--checked' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                isChecked ? onUncheck(habit.id) : onCheck(habit.id)
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              {isChecked ? '✓' : ''}
                            </span>
                            <span className="habit-list__week-block-icon">{habit.icon || '✨'}</span>
                            <span className="habit-list__week-block-name">{habit.name}</span>
                          </div>
                        )
                      })}

                      {/* Drag preview for this day */}
                      {isDragging && dragStart && dragEnd && (window as unknown as Record<string, number>).__habitDayOffset === day.dayOffset && (
                        <div
                          className="habit-list__week-drag-preview"
                          style={{
                            top: `${GRID_PADDING + Math.min(dragStart.y, dragEnd.y)}px`,
                            height: `${Math.abs(dragEnd.y - dragStart.y)}px`
                          }}
                        >
                          <span className="habit-list__week-drag-time">
                            {dragStart.y < dragEnd.y ? dragStart.time : dragEnd.time}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
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
                  onClick={() => onEdit?.(habit)} // Click on card = edit
                >
                  {/* Checkbox zone = toggle */}
                  <span 
                    className={`habit-list__visual-checkbox ${isChecked ? 'habit-list__visual-checkbox--checked' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      isChecked ? onUncheck(habit.id) : onCheck(habit.id)
                    }}
                  >
                    {isChecked ? '✓' : ''}
                  </span>
                  <div className="habit-list__visual-time">{startTime}</div>
                  <div className="habit-list__visual-content">
                    <span className="habit-list__visual-icon">{habit.icon || '✨'}</span>
                    <span className="habit-list__visual-name">{habit.name}</span>
                  </div>
                  {duration && (
                    <span className="habit-list__visual-duration">{duration}m</span>
                  )}
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
