import { useState } from 'react'
import type { Goal } from '@oneway/shared'
import './GoalModal.css'

interface GoalModalProps {
  goal: Goal | null
  onSave: (data: { name: string; icon: string; progress: number; target_date?: string }) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

const GOAL_ICONS = ['🎯', '🏃', '💪', '📚', '💰', '🎨', '🧘', '❤️', '⭐', '🚀', '🌱', '🔥', '💡', '🎵']

export function GoalModal({ goal, onSave, onDelete, onClose }: GoalModalProps) {
  const [name, setName] = useState(goal?.name || '')
  const [icon, setIcon] = useState(goal?.icon || '●')
  const [progress, setProgress] = useState(goal?.progress || 0)
  const [targetDate, setTargetDate] = useState(goal?.target_date || '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        icon,
        progress,
        target_date: targetDate || undefined
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    if (!confirm('Delete this goal?')) return
    setSaving(true)
    try {
      await onDelete()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="goal-modal__overlay" onClick={onClose}>
      <div className="goal-modal" onClick={e => e.stopPropagation()}>
        <div className="goal-modal__header">
          <h3>{goal ? 'Edit Goal' : 'New Goal'}</h3>
          <button className="goal-modal__close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="goal-modal__form">
          <div className="goal-modal__row">
            <div className="goal-modal__field goal-modal__field--icon">
              <label>Icon</label>
              <div className="goal-modal__icon-picker">
                {GOAL_ICONS.map(i => (
                  <button
                    key={i}
                    type="button"
                    className={`goal-modal__icon-btn ${icon === i ? 'goal-modal__icon-btn--selected' : ''}`}
                    onClick={() => setIcon(i)}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="goal-modal__field">
            <label>Goal name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Run a marathon"
              autoFocus
            />
          </div>

          <div className="goal-modal__field">
            <label>Progress</label>
            <div className="goal-modal__progress-row">
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={e => setProgress(parseInt(e.target.value))}
                className="goal-modal__slider"
              />
              <span className="goal-modal__progress-value">{progress}%</span>
            </div>
          </div>

          <div className="goal-modal__field">
            <label>Target date (optional)</label>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
            />
          </div>

          <div className="goal-modal__actions">
            {goal && onDelete && (
              <button 
                type="button" 
                className="goal-modal__btn goal-modal__btn--delete"
                onClick={handleDelete}
                disabled={saving}
              >
                Delete
              </button>
            )}
            <div className="goal-modal__actions-right">
              <button 
                type="button" 
                className="goal-modal__btn goal-modal__btn--cancel"
                onClick={onClose}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="goal-modal__btn goal-modal__btn--save"
                disabled={!name.trim() || saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
