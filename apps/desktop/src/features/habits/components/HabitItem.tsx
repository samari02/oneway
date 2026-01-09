import type { Habit } from '@oneway/shared'
import './HabitItem.css'

interface HabitItemProps {
  habit: Habit
  isChecked: boolean
  onToggle: () => void
}

export function HabitItem({ habit, isChecked, onToggle }: HabitItemProps) {
  return (
    <div className={`habit-item ${isChecked ? 'habit-item--checked' : ''}`}>
      <span className="habit-item__icon">{habit.icon || '✨'}</span>
      <span className="habit-item__name">{habit.name}</span>
      <button 
        className={`habit-item__check ${isChecked ? 'habit-item__check--checked' : ''}`}
        onClick={onToggle}
        aria-label={isChecked ? 'Uncheck habit' : 'Check habit'}
      >
        {isChecked ? '✓' : ''}
      </button>
    </div>
  )
}
