import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Habit } from '@oneway/shared'
import './NorthStarEditModal.css'

interface NorthStarEditModalProps {
  userId: string
  goal: string
  icon: string
  habits: Habit[]
  onSave: () => void
  onCancel: () => void
}

const ICONS = ['🎯', '💪', '🧘', '📚', '💼', '❤️', '✨', '🌟', '🏃', '🎨', '💡', '🚀']

export function NorthStarEditModal({ 
  userId, 
  goal: initialGoal, 
  icon: initialIcon, 
  habits,
  onSave, 
  onCancel 
}: NorthStarEditModalProps) {
  const [goal, setGoal] = useState(initialGoal)
  const [icon, setIcon] = useState(initialIcon)
  const [linkedHabitIds, setLinkedHabitIds] = useState<Set<string>>(
    new Set(habits.filter(h => h.linked_to_north_star).map(h => h.id))
  )
  const [showIcons, setShowIcons] = useState(false)
  const [saving, setSaving] = useState(false)

  const toggleHabitLink = (habitId: string) => {
    setLinkedHabitIds(prev => {
      const next = new Set(prev)
      if (next.has(habitId)) {
        next.delete(habitId)
      } else {
        next.add(habitId)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!goal.trim()) return
    setSaving(true)

    try {
      // Update user settings
      await supabase
        .from('user_settings')
        .update({
          north_star_goal: goal.trim(),
          north_star_icon: icon,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      // Update habits linked status
      for (const habit of habits) {
        const shouldBeLinked = linkedHabitIds.has(habit.id)
        if (habit.linked_to_north_star !== shouldBeLinked) {
          await supabase
            .from('habits')
            .update({ linked_to_north_star: shouldBeLinked })
            .eq('id', habit.id)
        }
      }

      onSave()
    } catch (err) {
      console.error('Failed to save North Star:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="north-star-modal-overlay" onClick={onCancel}>
      <div className="north-star-modal" onClick={e => e.stopPropagation()}>
        <header className="north-star-modal__header">
          <h2>🎯 Edit North Star</h2>
          <button className="north-star-modal__close" onClick={onCancel}>×</button>
        </header>

        <div className="north-star-modal__content">
          {/* Goal input */}
          <div className="north-star-modal__field">
            <label>Your goal</label>
            <div className="north-star-modal__input-row">
              <button 
                type="button"
                className="north-star-modal__icon-btn"
                onClick={() => setShowIcons(!showIcons)}
              >
                {icon}
              </button>
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="What do you want to achieve?"
              />
            </div>

            {showIcons && (
              <div className="north-star-modal__icons">
                {ICONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`north-star-modal__icon-option ${icon === emoji ? 'north-star-modal__icon-option--selected' : ''}`}
                    onClick={() => {
                      setIcon(emoji)
                      setShowIcons(false)
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Linked habits */}
          {habits.length > 0 && (
            <div className="north-star-modal__field">
              <label>Linked habits</label>
              <p className="north-star-modal__hint">
                Select habits that contribute to this goal
              </p>
              <div className="north-star-modal__habits">
                {habits.filter(h => h.habit_type === 'do').map(habit => (
                  <label key={habit.id} className="north-star-modal__habit">
                    <input
                      type="checkbox"
                      checked={linkedHabitIds.has(habit.id)}
                      onChange={() => toggleHabitLink(habit.id)}
                    />
                    <span className="north-star-modal__habit-icon">{habit.icon || '✨'}</span>
                    <span className="north-star-modal__habit-name">{habit.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="north-star-modal__actions">
          <button 
            className="north-star-modal__btn north-star-modal__btn--secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button 
            className="north-star-modal__btn north-star-modal__btn--primary"
            onClick={handleSave}
            disabled={!goal.trim() || saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
