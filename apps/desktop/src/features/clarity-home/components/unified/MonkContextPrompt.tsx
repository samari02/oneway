import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/features/auth'
import { getUserContext, saveUserContext } from '../../api/userContext'

export function MonkContextPrompt() {
  const { user } = useAuth()
  const [contextText, setContextText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    getUserContext(user.id)
      .then((ctx) => setContextText(ctx?.context_text ?? null))
      .catch(() => setContextText(null))
      .finally(() => setLoading(false))
  }, [user])

  const handleSave = useCallback(async () => {
    if (!user || !input.trim()) return
    setSaving(true)
    try {
      await saveUserContext({ user_id: user.id, context_text: input.trim() })
      setContextText(input.trim())
      setExpanded(false)
    } catch (err) {
      console.error('[monk-context] Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }, [user, input])

  const handleEdit = () => {
    setInput(contextText ?? '')
    setExpanded(true)
  }

  if (loading) return null

  return (
    <div className="monk-ctx">
      {expanded ? (
        <div className="monk-ctx__editor">
          <textarea
            className="monk-ctx__textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. I'm building a productivity app, learning Japanese, and trying to go to the gym 4x/week…"
            rows={3}
            autoFocus
            disabled={saving}
          />
          <div className="monk-ctx__actions">
            <button
              type="button"
              className="monk-ctx__btn monk-ctx__btn--save"
              onClick={handleSave}
              disabled={saving || !input.trim()}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="monk-ctx__btn monk-ctx__btn--cancel"
              onClick={() => setExpanded(false)}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : contextText ? (
        <p className="monk-ctx__status">
          <span className="monk-ctx__dot" aria-hidden />
          Monk knows a bit about you
          <button type="button" className="monk-ctx__link" onClick={handleEdit}>
            edit
          </button>
        </p>
      ) : (
        <button type="button" className="monk-ctx__invite" onClick={handleEdit}>
          Monk doesn&apos;t know you yet — tell him what you&apos;re working on
        </button>
      )}
    </div>
  )
}
