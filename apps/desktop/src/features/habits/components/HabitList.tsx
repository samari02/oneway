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

export function HabitList({ habits, checkedIds, onCheck, onUncheck, onEdit, onDelete }: HabitListProps) {
  // Sort habits by scheduled_time (nulls at end)
  const sortedHabits = [...habits].sort((a, b) => {
    if (!a.scheduled_time && !b.scheduled_time) return 0
    if (!a.scheduled_time) return 1
    if (!b.scheduled_time) return -1
    return a.scheduled_time.localeCompare(b.scheduled_time)
  })

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
          <div 
            key={habit.id} 
            className={`habit-list__timeline-item ${index === sortedHabits.length - 1 ? 'habit-list__timeline-item--last' : ''}`}
          >
            {/* Timeline connector */}
            <div className="habit-list__timeline-track">
              <div className={`habit-list__timeline-dot ${checkedIds.has(habit.id) ? 'habit-list__timeline-dot--done' : ''} ${habit.id === firstUncheckedId ? 'habit-list__timeline-dot--current' : ''}`} />
              {index < sortedHabits.length - 1 && (
                <div className={`habit-list__timeline-line ${checkedIds.has(habit.id) ? 'habit-list__timeline-line--done' : ''}`} />
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
        ))}
      </div>
    </div>
  )
}
