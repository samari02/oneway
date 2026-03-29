import { useState } from 'react'
import type { CommitmentLevel, CustomBlockingRuleType } from '@oneway/shared'
import './BoundaryModal.css'

const MIN_LEN = 3
const LOCK_DAYS = 7

function addDaysIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

interface AddCustomBlockingRuleModalProps {
  userId: string
  ruleType: CustomBlockingRuleType
  onSave: () => void
  onCancel: () => void
  createRule: (input: {
    user_id: string
    rule_type: CustomBlockingRuleType
    value: string
    note?: string | null
    commitment_level?: CommitmentLevel
    locked_until?: string | null
  }) => Promise<unknown>
}

export function AddCustomBlockingRuleModal({
  userId,
  ruleType,
  onSave,
  onCancel,
  createRule,
}: AddCustomBlockingRuleModalProps) {
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [commitment, setCommitment] = useState<CommitmentLevel>('flexible')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const title =
    ruleType === 'url_contains' ? 'Add URL rule' : 'Add search keyword rule'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const v = value.trim()
    if (v.length < MIN_LEN) {
      setError(`Use at least ${MIN_LEN} characters to avoid accidental matches.`)
      return
    }

    setSaving(true)
    try {
      const lockedUntil =
        commitment === 'locked' ? addDaysIso(LOCK_DAYS) : null
      await createRule({
        user_id: userId,
        rule_type: ruleType,
        value: v,
        note: note.trim() || null,
        commitment_level: commitment,
        locked_until: lockedUntil,
      })
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="boundary-modal__overlay" onClick={onCancel}>
      <div className="boundary-modal" onClick={(e) => e.stopPropagation()}>
        <header className="boundary-modal__header">
          <h2>{title}</h2>
          <button type="button" className="boundary-modal__close" onClick={onCancel}>
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit} className="boundary-modal__form">
          <div className="boundary-modal__field">
            <label>{ruleType === 'url_contains' ? 'URL contains' : 'Search contains'}</label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={
                ruleType === 'url_contains'
                  ? 'e.g. reddit.com or /shorts'
                  : 'e.g. gossip or shopping'
              }
              autoFocus
            />
            <span className="blocking-modal__hint">
              Match mode: <strong>Contains</strong> (case-insensitive). Min. {MIN_LEN} characters.
            </span>
          </div>

          <div className="boundary-modal__field">
            <label>Why (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reminder for future you when you want to disable this…"
              rows={2}
            />
          </div>

          <div className="boundary-modal__field">
            <label>Commitment</label>
            <select
              value={commitment}
              onChange={(e) => setCommitment(e.target.value as CommitmentLevel)}
            >
              <option value="flexible">Flexible — disable or delete anytime</option>
              <option value="committed">
                Committed — extra confirmation before disable or delete
              </option>
              <option value="locked">
                Locked — cannot change for {LOCK_DAYS} days
              </option>
            </select>
          </div>

          {error && <p className="blocking-modal__error">{error}</p>}

          <div className="boundary-modal__actions">
            <button type="button" className="boundary-modal__btn boundary-modal__btn--secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="boundary-modal__btn boundary-modal__btn--primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
