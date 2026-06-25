import { useState, useCallback } from 'react'
import type { ProposedFocusArea } from '@/lib/morning-plan'
import './FocusAreaProposal.css'

type ProposalItem = ProposedFocusArea & { accepted: boolean }

type FocusAreaProposalProps = {
  proposals: ProposedFocusArea[]
  onAccept: (accepted: Array<{ label: string; emoji?: string }>) => void
  onDismiss: () => void
}

export function FocusAreaProposal({ proposals, onAccept, onDismiss }: FocusAreaProposalProps) {
  const [items, setItems] = useState<ProposalItem[]>(() =>
    proposals.map((p) => ({ ...p, accepted: true })),
  )
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState('')

  const toggleItem = (idx: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, accepted: !item.accepted } : item)),
    )
  }

  const startEdit = (idx: number) => {
    setEditingIdx(idx)
    setEditLabel(items[idx].label)
  }

  const commitEdit = useCallback(() => {
    if (editingIdx === null) return
    const trimmed = editLabel.trim()
    if (trimmed) {
      setItems((prev) =>
        prev.map((item, i) => (i === editingIdx ? { ...item, label: trimmed } : item)),
      )
    }
    setEditingIdx(null)
  }, [editingIdx, editLabel])

  const handleAccept = () => {
    const accepted = items
      .filter((item) => item.accepted)
      .map((item) => ({ label: item.label, emoji: item.emoji }))
    onAccept(accepted)
  }

  const acceptedCount = items.filter((i) => i.accepted).length

  return (
    <div className="fa-proposal">
      <div className="fa-proposal__header">
        <p className="fa-proposal__lead">
          I&apos;ve noticed your goals tend to fall into a few areas.
        </p>
      </div>

      <ul className="fa-proposal__list">
        {items.map((item, idx) => (
          <li
            key={idx}
            className={`fa-proposal__item${item.accepted ? '' : ' fa-proposal__item--dismissed'}`}
          >
            <button
              type="button"
              className="fa-proposal__toggle"
              onClick={() => toggleItem(idx)}
              aria-pressed={item.accepted}
            >
              <span className="fa-proposal__check">
                {item.accepted && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
            </button>

            {editingIdx === idx ? (
              <input
                type="text"
                className="fa-proposal__edit-input"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit()
                  if (e.key === 'Escape') setEditingIdx(null)
                }}
                autoFocus
              />
            ) : (
              <button
                type="button"
                className="fa-proposal__label"
                onClick={() => startEdit(idx)}
                title="Click to rename"
              >
                <span className="fa-proposal__emoji">{item.emoji ?? '•'}</span>
                <span>{item.label}</span>
              </button>
            )}
          </li>
        ))}
      </ul>

      <p className="fa-proposal__hint">
        Tap a name to rename it. Uncheck any that don&apos;t feel right.
      </p>

      <div className="fa-proposal__actions">
        <button
          type="button"
          className="fa-proposal__btn fa-proposal__btn--primary"
          onClick={handleAccept}
          disabled={acceptedCount === 0}
        >
          {acceptedCount === items.length ? 'Looks good' : `Accept ${acceptedCount}`}
        </button>
        <button
          type="button"
          className="fa-proposal__btn fa-proposal__btn--ghost"
          onClick={onDismiss}
        >
          Not now
        </button>
      </div>
    </div>
  )
}
