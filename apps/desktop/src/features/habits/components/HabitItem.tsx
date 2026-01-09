import type { Habit } from '@oneway/shared'
import './HabitItem.css'

interface HabitItemProps {
  habit: Habit
  isChecked: boolean
  onToggle: () => void
  onEdit?: () => void
}

export function HabitItem({ habit, isChecked, onToggle, onEdit }: HabitItemProps) {
  const formatDuration = (minutes?: number) => {
    if (!minutes) return null
    if (minutes < 60) return `${minutes}min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins ? `${hours}h${mins}` : `${hours}h`
  }

  return (
    <div className={`habit-item ${isChecked ? 'habit-item--checked' : ''}`}>
      <button 
        className={`habit-item__check ${isChecked ? 'habit-item__check--checked' : ''}`}
        onClick={onToggle}
        aria-label={isChecked ? 'Uncheck habit' : 'Check habit'}
      >
        {isChecked ? '✓' : ''}
      </button>

      <div className="habit-item__content" onClick={onEdit}>
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
    </div>
  )
}
