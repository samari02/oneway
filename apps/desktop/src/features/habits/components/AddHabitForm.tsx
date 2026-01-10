import { useState } from 'react'
import type { TimeOfDay, HabitType, AvoidCategory } from '@oneway/shared'
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
  // Boundary fields
  habit_type: HabitType
  avoid_category?: AvoidCategory
  time_start?: string
  time_end?: string
  blocked_sites?: string[]
  days_of_week?: number[]
}

interface AddHabitFormProps {
  onAdd: (data: HabitFormData) => Promise<void>
  onCancel: () => void
}

const DURATION_PRESETS = [5, 10, 15, 20, 30, 45, 60]
const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
]
const COMMON_SITES = [
  { pattern: 'instagram.com', label: 'Instagram' },
  { pattern: 'twitter.com', label: 'X (Twitter)' },
  { pattern: 'tiktok.com', label: 'TikTok' },
  { pattern: 'facebook.com', label: 'Facebook' },
  { pattern: 'youtube.com', label: 'YouTube' },
  { pattern: 'reddit.com', label: 'Reddit' },
  { pattern: 'linkedin.com', label: 'LinkedIn' },
]

export function AddHabitForm({ onAdd, onCancel }: AddHabitFormProps) {
  const [data, setData] = useState<HabitFormData>({
    name: '',
    icon: '✨',
    description: '',
    duration_minutes: null,
    scheduled_time: '',
    is_required: false,
    time_of_day: 'morning',
    habit_type: 'do',
    avoid_category: undefined,
    time_start: undefined,
    time_end: undefined,
    blocked_sites: [],
    days_of_week: [1, 2, 3, 4, 5, 6, 7], // All days by default
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

  const toggleDay = (day: number) => {
    const current = data.days_of_week || []
    if (current.includes(day)) {
      updateData({ days_of_week: current.filter(d => d !== day) })
    } else {
      updateData({ days_of_week: [...current, day].sort() })
    }
  }

  const toggleSite = (site: string) => {
    const current = data.blocked_sites || []
    if (current.includes(site)) {
      updateData({ blocked_sites: current.filter(s => s !== site) })
    } else {
      updateData({ blocked_sites: [...current, site] })
    }
  }

  return (
    <form className="add-habit-form" onSubmit={handleSubmit}>
      <div className="add-habit-form__header">
        <h3>New Habit</h3>
      </div>

      {/* Type Selection - Do vs Avoid */}
      <div className="add-habit-form__field">
        <label className="add-habit-form__label">Type</label>
        <div className="add-habit-form__type-selector">
          <button
            type="button"
            className={`add-habit-form__type-option ${data.habit_type === 'do' ? 'add-habit-form__type-option--selected' : ''}`}
            onClick={() => updateData({ 
              habit_type: 'do',
              avoid_category: undefined,
              time_start: undefined,
              time_end: undefined,
              blocked_sites: [],
              icon: data.habit_type === 'avoid' ? '✨' : data.icon
            })}
          >
            <span className="add-habit-form__type-icon">✓</span>
            <span className="add-habit-form__type-label">Do something</span>
            <span className="add-habit-form__type-example">e.g., Meditate, Exercise</span>
          </button>
          <button
            type="button"
            className={`add-habit-form__type-option ${data.habit_type === 'avoid' ? 'add-habit-form__type-option--selected add-habit-form__type-option--avoid' : ''}`}
            onClick={() => updateData({ 
              habit_type: 'avoid',
              avoid_category: 'digital',
              time_start: '06:00',
              time_end: '08:00',
              icon: '🛡️'
            })}
          >
            <span className="add-habit-form__type-icon">🛡️</span>
            <span className="add-habit-form__type-label">Avoid something</span>
            <span className="add-habit-form__type-example">e.g., No phone, No snacks</span>
          </button>
        </div>
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
          placeholder={data.habit_type === 'do' ? 'e.g., Morning light' : 'e.g., No phone at wake-up'}
          value={data.name}
          onChange={(e) => updateData({ name: e.target.value })}
          autoFocus
        />
      </div>

      {/* Conditional: Avoid Category */}
      {data.habit_type === 'avoid' && (
        <>
          <div className="add-habit-form__field">
            <label className="add-habit-form__label">Category</label>
            <div className="add-habit-form__category-selector">
              <button
                type="button"
                className={`add-habit-form__category-option ${data.avoid_category === 'digital' ? 'add-habit-form__category-option--selected' : ''}`}
                onClick={() => updateData({ avoid_category: 'digital' })}
              >
                <span>📱</span>
                <span>Digital</span>
                <small>Sites & apps</small>
              </button>
              <button
                type="button"
                className={`add-habit-form__category-option ${data.avoid_category === 'physical' ? 'add-habit-form__category-option--selected' : ''}`}
                onClick={() => updateData({ avoid_category: 'physical', blocked_sites: [] })}
              >
                <span>🍎</span>
                <span>Physical</span>
                <small>Food, habits, etc.</small>
              </button>
            </div>
          </div>

          {/* Time Range */}
          <div className="add-habit-form__field">
            <label className="add-habit-form__label">Active period</label>
            <div className="add-habit-form__time-range">
              <TimePicker
                value={data.time_start || '06:00'}
                onChange={(time_start) => updateData({ time_start })}
              />
              <span className="add-habit-form__time-separator">→</span>
              <TimePicker
                value={data.time_end || '08:00'}
                onChange={(time_end) => updateData({ time_end })}
              />
            </div>
          </div>

          {/* Days of week */}
          <div className="add-habit-form__field">
            <label className="add-habit-form__label">Active days</label>
            <div className="add-habit-form__days">
              {DAYS.map(day => (
                <button
                  key={day.value}
                  type="button"
                  className={`add-habit-form__day ${(data.days_of_week || []).includes(day.value) ? 'add-habit-form__day--selected' : ''}`}
                  onClick={() => toggleDay(day.value)}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Blocked sites (only for digital) */}
          {data.avoid_category === 'digital' && (
            <div className="add-habit-form__field">
              <label className="add-habit-form__label">Sites to block</label>
              <div className="add-habit-form__sites">
                {COMMON_SITES.map(site => (
                  <button
                    key={site.pattern}
                    type="button"
                    className={`add-habit-form__site ${(data.blocked_sites || []).includes(site.pattern) ? 'add-habit-form__site--selected' : ''}`}
                    onClick={() => toggleSite(site.pattern)}
                  >
                    {site.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Scheduled Time - only for 'do' habits */}
      {data.habit_type === 'do' && (
        <div className="add-habit-form__field">
          <label className="add-habit-form__label">Scheduled time</label>
          <TimePicker
            value={data.scheduled_time}
            onChange={(scheduled_time) => updateData({ scheduled_time })}
          />
        </div>
      )}

      {/* Toggle Advanced - only for 'do' habits */}
      {data.habit_type === 'do' && (
        <>
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
