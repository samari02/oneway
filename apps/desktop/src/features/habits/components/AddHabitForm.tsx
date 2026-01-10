import { useState } from 'react'
import type { TimeOfDay } from '@oneway/shared'
import { EmojiPicker } from './EmojiPicker'
import { TimePicker } from './TimePicker'
import './AddHabitForm.css'

interface HabitFormData {
  name: string
  icon: string
  description: string
  duration_minutes: number | null
  scheduled_time: string
  is_required: boolean
  time_of_day: TimeOfDay
}

interface AddHabitFormProps {
  onAdd: (data: HabitFormData) => Promise<void>
  onCancel: () => void
}

const DURATION_PRESETS = [5, 10, 15, 20, 30, 45, 60]

export function AddHabitForm({ onAdd, onCancel }: AddHabitFormProps) {
  const [data, setData] = useState<HabitFormData>({
    name: '',
    icon: '✨',
    description: '',
    duration_minutes: null,
    scheduled_time: '',
    is_required: false,
    time_of_day: 'morning',
  })
  const [loading, setLoading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!data.name.trim()) return

    setLoading(true)
    try {
      await onAdd(data)
    } finally {
      setLoading(false)
    }
  }

  const updateData = (updates: Partial<HabitFormData>) => {
    setData(prev => ({ ...prev, ...updates }))
  }

  return (
    <form className="add-habit-form" onSubmit={handleSubmit}>
      <div className="add-habit-form__header">
        <h3>New Habit</h3>
      </div>

      {/* Icon Selection */}
      <div className="add-habit-form__field">
        <label className="add-habit-form__label">Icon</label>
        <EmojiPicker 
          value={data.icon} 
          onChange={(icon) => updateData({ icon })} 
        />
      </div>

      {/* Name */}
      <div className="add-habit-form__field">
        <label className="add-habit-form__label">Name *</label>
        <input
          type="text"
          className="add-habit-form__input"
          placeholder="e.g., Morning light"
          value={data.name}
          onChange={(e) => updateData({ name: e.target.value })}
          autoFocus
        />
      </div>

      {/* Scheduled Time */}
      <div className="add-habit-form__field">
        <label className="add-habit-form__label">Scheduled time</label>
        <TimePicker
          value={data.scheduled_time}
          onChange={(scheduled_time) => updateData({ scheduled_time })}
        />
      </div>

      {/* Toggle Advanced */}
      <button
        type="button"
        className="add-habit-form__toggle-advanced"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? '− Less options' : '+ More options'}
      </button>

      {showAdvanced && (
        <>
          {/* Duration */}
          <div className="add-habit-form__field">
            <label className="add-habit-form__label">Duration</label>
            <div className="add-habit-form__durations">
              {DURATION_PRESETS.map(mins => (
                <button
                  key={mins}
                  type="button"
                  className={`add-habit-form__duration ${data.duration_minutes === mins ? 'add-habit-form__duration--selected' : ''}`}
                  onClick={() => updateData({ 
                    duration_minutes: data.duration_minutes === mins ? null : mins 
                  })}
                >
                  {mins < 60 ? `${mins}min` : `${mins / 60}h`}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="add-habit-form__field">
            <label className="add-habit-form__label">Description (optional)</label>
            <textarea
              className="add-habit-form__textarea"
              placeholder="Add details, notes, or instructions..."
              value={data.description}
              onChange={(e) => updateData({ description: e.target.value })}
              rows={2}
            />
          </div>

          {/* Required toggle */}
          <div className="add-habit-form__field">
            <label className="add-habit-form__checkbox">
              <input
                type="checkbox"
                checked={data.is_required}
                onChange={(e) => updateData({ is_required: e.target.checked })}
              />
              <span className="add-habit-form__checkbox-label">
                <strong>Required for unblock</strong>
                <small>Must complete this habit to access blocked sites</small>
              </span>
            </label>
          </div>
        </>
      )}

      <div className="add-habit-form__actions">
        <button 
          type="button" 
          className="add-habit-form__button add-habit-form__button--secondary"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button 
          type="submit" 
          className="add-habit-form__button add-habit-form__button--primary"
          disabled={!data.name.trim() || loading}
        >
          {loading ? '...' : 'Add Habit'}
        </button>
      </div>
    </form>
  )
}
