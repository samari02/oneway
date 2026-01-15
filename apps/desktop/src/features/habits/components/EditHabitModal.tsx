import { useState } from 'react'
import type { Habit } from '@oneway/shared'
import { EmojiPicker } from './EmojiPicker'
import './EditHabitModal.css'

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
  const [durationMinutes, setDurationMinutes] = useState(habit.duration_minutes?.toString() || '')
  const [scheduledTime, setScheduledTime] = useState(habit.scheduled_time || '')
  const [isRequired, setIsRequired] = useState(habit.is_required || false)
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'evening' | 'anytime'>(habit.time_of_day || 'anytime')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    onSave({
      name: name.trim(),
      icon,
      description: description.trim() || undefined,
      duration_minutes: durationMinutes ? parseInt(durationMinutes) : undefined,
      scheduled_time: scheduledTime || undefined,
      is_required: isRequired,
      time_of_day: timeOfDay,
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
            <div className="edit-modal__time-interval">
              <div className="edit-modal__time-field">
                <span className="edit-modal__time-label">Start</span>
                <input
                  type="time"
                  value={scheduledTime || '08:00'}
                  onChange={e => setScheduledTime(e.target.value)}
                />
              </div>
              <span className="edit-modal__time-separator">→</span>
              <div className="edit-modal__time-field">
                <span className="edit-modal__time-label">Duration</span>
                <select
                  value={durationMinutes || '30'}
                  onChange={e => setDurationMinutes(e.target.value)}
                >
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </div>
            </div>
          </div>

          <div className="edit-modal__row">
            <div className="edit-modal__field">
              <label>Time of day</label>
              <select value={timeOfDay} onChange={e => setTimeOfDay(e.target.value as typeof timeOfDay)}>
                <option value="anytime">Anytime</option>
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
              </select>
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
