import { useState } from 'react'
import type { TimeOfDay, HabitType, AvoidCategory, Goal } from '@oneway/shared'
import { EmojiPicker } from './EmojiPicker'
import { GoalIcon } from '@/features/goals/components/GoalModal'
import './AddHabitModal.css'

interface HabitFormData {
  name: string
  icon: string
  description: string
  duration_minutes: number | null
  scheduled_time: string
  is_required: boolean
  time_of_day: TimeOfDay
  habit_type: HabitType
  avoid_category?: AvoidCategory
  time_start?: string
  time_end?: string
  blocked_sites?: string[]
  days_of_week?: number[]
  goal_id?: string
}

interface AddHabitModalProps {
  onAdd: (data: HabitFormData) => Promise<void>
  onCancel: () => void
  goals?: Goal[]
  initialTime?: string
  initialDuration?: number
}

const DAYS = [
  { value: 1, label: 'M' },
  { value: 2, label: 'T' },
  { value: 3, label: 'W' },
  { value: 4, label: 'T' },
  { value: 5, label: 'F' },
  { value: 6, label: 'S' },
  { value: 7, label: 'S' },
]

const COMMON_SITES = [
  { pattern: 'instagram.com', label: 'Instagram' },
  { pattern: 'twitter.com', label: 'X' },
  { pattern: 'tiktok.com', label: 'TikTok' },
  { pattern: 'youtube.com', label: 'YouTube' },
  { pattern: 'reddit.com', label: 'Reddit' },
]

export function AddHabitModal({ onAdd, onCancel, goals = [], initialTime, initialDuration }: AddHabitModalProps) {
  const [data, setData] = useState<HabitFormData>({
    name: '',
    icon: '✨',
    description: '',
    duration_minutes: initialDuration ?? null,
    scheduled_time: initialTime ?? '',
    is_required: false,
    time_of_day: 'morning',
    habit_type: 'do',
    avoid_category: undefined,
    time_start: undefined,
    time_end: undefined,
    blocked_sites: [],
    days_of_week: [1, 2, 3, 4, 5, 6, 7],
    goal_id: undefined,
  })
  const [loading, setLoading] = useState(false)

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

  const isBoundary = data.habit_type === 'avoid'

  return (
    <div className="add-modal-overlay" onClick={onCancel}>
      <div className="add-modal" onClick={e => e.stopPropagation()}>
        <header className="add-modal__header">
          <h2>New Habit</h2>
          <button className="add-modal__close" onClick={onCancel}>×</button>
        </header>

        <form onSubmit={handleSubmit} className="add-modal__form">
          {/* Type Toggle */}
          <div className="add-modal__type-toggle">
            <button
              type="button"
              className={`add-modal__type-btn ${data.habit_type === 'do' ? 'add-modal__type-btn--active' : ''}`}
              onClick={() => updateData({ 
                habit_type: 'do',
                avoid_category: undefined,
                time_start: undefined,
                time_end: undefined,
                blocked_sites: [],
                icon: '✨'
              })}
            >
              <span>✓</span> Do
            </button>
            <button
              type="button"
              className={`add-modal__type-btn add-modal__type-btn--avoid ${data.habit_type === 'avoid' ? 'add-modal__type-btn--active' : ''}`}
              onClick={() => updateData({ 
                habit_type: 'avoid',
                avoid_category: 'digital',
                time_start: '06:00',
                time_end: '08:00',
                icon: '🛡️'
              })}
            >
              <span>🛡️</span> Avoid
            </button>
          </div>

          {/* Name + Icon */}
          <div className="add-modal__row">
            <div className="add-modal__field add-modal__field--name">
              <label>Name</label>
              <input
                type="text"
                value={data.name}
                onChange={e => updateData({ name: e.target.value })}
                placeholder=""
                autoFocus
                required
              />
            </div>
            <div className="add-modal__field add-modal__field--icon">
              <label>Icon</label>
              <EmojiPicker value={data.icon} onChange={(icon) => updateData({ icon })} />
            </div>
          </div>

          {/* For DO habits: Time interval */}
          {!isBoundary && (
            <div className="add-modal__field">
              <label>When</label>
              <div className="add-modal__time-interval">
                <div className="add-modal__time-field">
                  <span className="add-modal__time-label">Start</span>
                  <input
                    type="time"
                    value={data.scheduled_time || '08:00'}
                    onChange={e => updateData({ scheduled_time: e.target.value })}
                  />
                </div>
                <span className="add-modal__time-separator">→</span>
                <div className="add-modal__time-field">
                  <span className="add-modal__time-label">Duration</span>
                  <select
                    value={data.duration_minutes || 30}
                    onChange={e => updateData({ duration_minutes: Number(e.target.value) })}
                  >
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Goal selector */}
          {goals.length > 0 && (
            <div className="add-modal__field">
              <label>Link to goal</label>
              <div className="add-modal__goals">
                <button
                  type="button"
                  className={`add-modal__goal-btn ${!data.goal_id ? 'add-modal__goal-btn--active' : ''}`}
                  onClick={() => updateData({ goal_id: undefined })}
                >
                  None
                </button>
                {goals.map(goal => (
                  <button
                    key={goal.id}
                    type="button"
                    className={`add-modal__goal-btn ${data.goal_id === goal.id ? 'add-modal__goal-btn--active' : ''}`}
                    onClick={() => updateData({ goal_id: goal.id })}
                  >
                    <GoalIcon iconId={goal.icon || 'target'} size={14} />
                    <span>{goal.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* For AVOID boundaries */}
          {isBoundary && (
            <>
              {/* Category */}
              <div className="add-modal__field">
                <label>Category</label>
                <div className="add-modal__category">
                  <button
                    type="button"
                    className={`add-modal__cat-btn ${data.avoid_category === 'digital' ? 'add-modal__cat-btn--active' : ''}`}
                    onClick={() => updateData({ avoid_category: 'digital' })}
                  >
                    📱 Digital
                  </button>
                  <button
                    type="button"
                    className={`add-modal__cat-btn ${data.avoid_category === 'physical' ? 'add-modal__cat-btn--active' : ''}`}
                    onClick={() => updateData({ avoid_category: 'physical', blocked_sites: [] })}
                  >
                    🍎 Physical
                  </button>
                </div>
              </div>

              {/* Time Range */}
              <div className="add-modal__field">
                <label>Active period</label>
                <div className="add-modal__time-range">
                  <input
                    type="time"
                    value={data.time_start || '06:00'}
                    onChange={e => updateData({ time_start: e.target.value })}
                  />
                  <span>→</span>
                  <input
                    type="time"
                    value={data.time_end || '08:00'}
                    onChange={e => updateData({ time_end: e.target.value })}
                  />
                </div>
              </div>

              {/* Days */}
              <div className="add-modal__field">
                <label>Days</label>
                <div className="add-modal__days">
                  {DAYS.map((day, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`add-modal__day ${(data.days_of_week || []).includes(day.value) ? 'add-modal__day--active' : ''}`}
                      onClick={() => toggleDay(day.value)}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Blocked sites (digital only) */}
              {data.avoid_category === 'digital' && (
                <div className="add-modal__field">
                  <label>Sites to block</label>
                  <div className="add-modal__sites">
                    {COMMON_SITES.map(site => (
                      <button
                        key={site.pattern}
                        type="button"
                        className={`add-modal__site ${(data.blocked_sites || []).includes(site.pattern) ? 'add-modal__site--active' : ''}`}
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

          {/* Actions */}
          <div className="add-modal__actions">
            <button type="button" className="add-modal__btn add-modal__btn--secondary" onClick={onCancel}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="add-modal__btn add-modal__btn--primary"
              disabled={!data.name.trim() || loading}
            >
              {loading ? '...' : isBoundary ? 'Add Boundary' : 'Add Habit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
