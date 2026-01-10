import { useState } from 'react'
import type { Goal } from '@oneway/shared'
import './GoalModal.css'

interface GoalModalProps {
  goal: Goal | null
  onSave: (data: { name: string; icon: string; progress: number; target_date?: string }) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

// Simple icons - store the id, render as SVG
const GOAL_ICONS = [
  { id: 'target', label: 'Target', path: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-4a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
  { id: 'star', label: 'Star', path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
  { id: 'heart', label: 'Heart', path: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z' },
  { id: 'bolt', label: 'Energy', path: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
  { id: 'flag', label: 'Flag', path: 'M4 2v20M4 4h12l-2 4 2 4H4' },
  { id: 'trophy', label: 'Trophy', path: 'M8 21h8m-4-4v4m-4-8a4 4 0 0 1-4-4V4h16v5a4 4 0 0 1-4 4h-4z' },
  { id: 'mountain', label: 'Summit', path: 'm8 3 4 8 5-5 5 15H2L8 3z' },
  { id: 'book', label: 'Learn', path: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20' },
]

// Helper to render icon by id
export function GoalIcon({ iconId, size = 16, className = '' }: { iconId: string; size?: number; className?: string }) {
  const icon = GOAL_ICONS.find(i => i.id === iconId)
  if (!icon) return <span className={className}>●</span>
  
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <path d={icon.path} />
    </svg>
  )
}

export function GoalModal({ goal, onSave, onDelete, onClose }: GoalModalProps) {
  const [name, setName] = useState(goal?.name || '')
  const [icon, setIcon] = useState(goal?.icon || 'target')
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
                    key={i.id}
                    type="button"
                    className={`goal-modal__icon-btn ${icon === i.id ? 'goal-modal__icon-btn--selected' : ''}`}
                    onClick={() => setIcon(i.id)}
                    title={i.label}
                  >
                    <GoalIcon iconId={i.id} size={18} />
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
