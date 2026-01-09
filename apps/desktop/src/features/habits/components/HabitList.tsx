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

      <div className="habit-list__items">
        {habits.map(habit => (
          <HabitItem
            key={habit.id}
            habit={habit}
            isChecked={checkedIds.has(habit.id)}
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
        ))}
      </div>
    </div>
  )
}
