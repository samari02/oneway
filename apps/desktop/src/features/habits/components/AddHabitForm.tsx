import { useState } from 'react'
import './AddHabitForm.css'

interface AddHabitFormProps {
  onAdd: (name: string, icon: string) => Promise<void>
  onCancel: () => void
}

const EMOJI_SUGGESTIONS = ['☀️', '💧', '🏃', '🧘', '📚', '💪', '🥗', '😴', '✍️', '🎯']

export function AddHabitForm({ onAdd, onCancel }: AddHabitFormProps) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('✨')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    try {
      await onAdd(name.trim(), icon)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="add-habit-form" onSubmit={handleSubmit}>
      <div className="add-habit-form__header">
        <h3>New Habit</h3>
      </div>

      <div className="add-habit-form__field">
        <label className="add-habit-form__label">Icon</label>
        <div className="add-habit-form__icons">
          {EMOJI_SUGGESTIONS.map(emoji => (
            <button
              key={emoji}
              type="button"
              className={`add-habit-form__icon ${icon === emoji ? 'add-habit-form__icon--selected' : ''}`}
              onClick={() => setIcon(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="add-habit-form__field">
        <label className="add-habit-form__label">Name</label>
        <input
          type="text"
          className="add-habit-form__input"
          placeholder="e.g., Morning light"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

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
          disabled={!name.trim() || loading}
        >
          {loading ? '...' : 'Add Habit'}
        </button>
      </div>
    </form>
  )
}
