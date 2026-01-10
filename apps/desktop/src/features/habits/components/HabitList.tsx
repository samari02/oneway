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
}

function getCurrentTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export function HabitList({ habits, checkedIds, onCheck, onUncheck, onEdit, onDelete }: HabitListProps) {
  const [currentTime, setCurrentTime] = useState(getCurrentTime)

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTime())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Sort habits by scheduled_time (nulls at end)
  const sortedHabits = [...habits].sort((a, b) => {
    if (!a.scheduled_time && !b.scheduled_time) return 0
    if (!a.scheduled_time) return 1
    if (!b.scheduled_time) return -1
    return a.scheduled_time.localeCompare(b.scheduled_time)
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

  return (
    <div className="habit-list">
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
                      <div className="habit-list__now-inline">
                        <div className="habit-list__now-dot" />
                        <span className="habit-list__now-time">{currentTime}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Time label */}
              <div className="habit-list__timeline-time">
                {habit.scheduled_time || '—'}
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
                />
              </div>
            </div>
          </div>
        ))}

        {/* Now marker at the end if all habits are before current time */}
        {nowIndex === -1 && sortedHabits.length > 0 && (
          <div className="habit-list__now-end">
            <div className="habit-list__now-dot" />
            <span className="habit-list__now-time">{currentTime}</span>
          </div>
        )}
      </div>
    </div>
  )
}
