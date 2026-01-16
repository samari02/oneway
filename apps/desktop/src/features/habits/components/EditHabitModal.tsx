import { useState } from 'react'
import type { Habit } from '@oneway/shared'
import { EmojiPicker } from './EmojiPicker'
import './EditHabitModal.css'

// Helper to calculate end time from start + duration
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(':').map(Number)
  const totalMinutes = h * 60 + m + durationMinutes
  const endH = Math.floor(totalMinutes / 60) % 24
  const endM = totalMinutes % 60
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
}

// Helper to calculate duration from start and end times
function calculateDuration(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const startMinutes = sh * 60 + sm
  let endMinutes = eh * 60 + em
  // Handle overnight (end time is next day)
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60
  }
  return endMinutes - startMinutes
}

interface EditHabitModalProps {
  habit: Habit
  onSave: (updates: Partial<Habit>) => void
  onDelete?: (habitId: string) => void
  onCancel: () => void
}

export function EditHabitModal({ habit, onSave, onDelete, onCancel }: EditHabitModalProps) {
  const [name, setName] = useState(habit.name)
  const [icon, setIcon] = useState(habit.icon || '✨')
  const [description, setDescription] = useState(habit.description || '')
  const [scheduledTime, setScheduledTime] = useState(habit.scheduled_time || '08:00')
  const [scheduledEndTime, setScheduledEndTime] = useState(() => {
    if (habit.scheduled_time && habit.duration_minutes) {
      return calculateEndTime(habit.scheduled_time, habit.duration_minutes)
    }
    return calculateEndTime(habit.scheduled_time || '08:00', habit.duration_minutes || 30)
  })
  const [isRequired, setIsRequired] = useState(habit.is_required || false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const duration = calculateDuration(scheduledTime, scheduledEndTime)

    onSave({
      name: name.trim(),
      icon,
      description: description.trim() || undefined,
      duration_minutes: duration,
      scheduled_time: scheduledTime || undefined,
      is_required: isRequired,
    })
  }

  return (
    <div className="edit-modal-overlay" onClick={onCancel}>
      <div className="edit-modal" onClick={e => e.stopPropagation()}>
        <header className="edit-modal__header">
          <h2>Edit Habit</h2>
          <button className="edit-modal__close" onClick={onCancel}>×</button>
        </header>

        <form onSubmit={handleSubmit} className="edit-modal__form">
          {/* Name + Icon */}
          <div className="edit-modal__row">
            <div className="edit-modal__field edit-modal__field--name">
              <label>Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Habit name"
                required
              />
            </div>
            <div className="edit-modal__field edit-modal__field--icon">
              <label>Icon</label>
              <EmojiPicker value={icon} onChange={setIcon} />
            </div>
          </div>

          <div className="edit-modal__field">
            <label>Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="A short description"
            />
          </div>

          {/* Time interval */}
          <div className="edit-modal__field">
            <label>When</label>
            <div className="edit-modal__time-range">
              <input
                type="time"
                value={scheduledTime}
                onChange={e => {
                  const newStart = e.target.value
                  // Recalculate end time to maintain same duration
                  const duration = calculateDuration(scheduledTime, scheduledEndTime)
                  const newEnd = calculateEndTime(newStart, duration)
                  setScheduledTime(newStart)
                  setScheduledEndTime(newEnd)
                }}
              />
              <span>→</span>
              <input
                type="time"
                value={scheduledEndTime}
                onChange={e => setScheduledEndTime(e.target.value)}
              />
            </div>
          </div>

          <label className="edit-modal__checkbox">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={e => setIsRequired(e.target.checked)}
            />
            <span>Required for unblock</span>
          </label>

          <div className="edit-modal__actions">
            {onDelete && (
              <button 
                type="button" 
                className="edit-modal__btn edit-modal__btn--delete"
                onClick={() => onDelete(habit.id)}
              >
                Delete
              </button>
            )}
            <div className="edit-modal__actions-right">
              <button type="button" className="edit-modal__btn edit-modal__btn--secondary" onClick={onCancel}>
                Cancel
              </button>
              <button type="submit" className="edit-modal__btn edit-modal__btn--primary">
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
