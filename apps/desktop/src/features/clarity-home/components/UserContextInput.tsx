import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/features/auth'
import { getUserContext, saveUserContext } from '../api/userContext'

type UserContextInputProps = {
  /** Compact mode for onboarding — hides the section header */
  compact?: boolean
  /** Called after save completes (with the saved text) */
  onSaved?: (text: string) => void
  /** Called when user skips (onboarding) */
  onSkip?: () => void
}

export function UserContextInput({ compact, onSaved, onSkip }: UserContextInputProps) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    getUserContext(user.id)
      .then((ctx) => {
        if (ctx?.context_text) setText(ctx.context_text)
      })
      .catch((err) => console.warn('[user-context] Failed to load:', err))
      .finally(() => setLoading(false))
  }, [user])

  const handleSave = useCallback(async () => {
    if (!user || !text.trim()) return
    setSaving(true)
    try {
      await saveUserContext({ user_id: user.id, context_text: text.trim() })
      setSaved(true)
      onSaved?.(text.trim())
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('[user-context] Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }, [user, text, onSaved])

  if (loading) {
    return <div className="user-context-input user-context-input--loading">Loading…</div>
  }

  return (
    <div className={`user-context-input${compact ? ' user-context-input--compact' : ''}`}>
      {!compact && (
        <div className="user-context-input__header">
          <h3 className="user-context-input__title">About Me</h3>
          <p className="user-context-input__desc">
            Tell Monk about yourself — it helps organize your goals better.
          </p>
        </div>
      )}

      {compact && (
        <p className="user-context-input__lead">
          You can tell me a bit about yourself and what you&apos;re working on — it helps me
          organize your goals better. Or skip this and I&apos;ll learn as we go.
        </p>
      )}

      <textarea
        className="user-context-input__textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. I'm building a productivity app, learning Japanese, and trying to go to the gym 4x/week…"
        rows={compact ? 4 : 5}
        disabled={saving}
      />

      <div className="user-context-input__actions">
        <button
          type="button"
          className="user-context-input__btn user-context-input__btn--primary"
          onClick={handleSave}
          disabled={saving || !text.trim()}
        >
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </button>
        {compact && onSkip && (
          <button
            type="button"
            className="user-context-input__btn user-context-input__btn--ghost"
            onClick={onSkip}
          >
            Skip for now
          </button>
        )}
      </div>

      {!compact && (
        <p className="user-context-input__hint">
          No required fields — write freely. Monk will use this to organize goals faster.
        </p>
      )}
    </div>
  )
}
