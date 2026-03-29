import { useEffect, useState } from 'react'
import type { FrictionChallengeStart } from '../hooks/useBlockingLock'
import './BlockingFrictionModal.css'

interface BlockingFrictionModalProps {
  challenge: FrictionChallengeStart | null
  busy: boolean
  error: string | null
  onClose: () => void
  onSubmit: (answers: number[]) => void
}

export function BlockingFrictionModal({ challenge, busy, error, onClose, onSubmit }: BlockingFrictionModalProps) {
  const [answers, setAnswers] = useState<number[]>([])

  useEffect(() => {
    if (!challenge) {
      setAnswers([])
      return
    }
    setAnswers(challenge.rounds.map(() => 0))
  }, [challenge])

  if (!challenge) return null

  const n = challenge.rounds.length

  const setAnswer = (index: number, value: string) => {
    const v = parseInt(value, 10)
    setAnswers((prev) => {
      const base = prev.length === n ? [...prev] : Array.from({ length: n }, (_, i) => prev[i] ?? 0)
      base[index] = Number.isFinite(v) ? Math.max(0, Math.min(99, v)) : 0
      return base
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const a = answers.length === n ? answers : Array.from({ length: n }, (_, i) => answers[i] ?? 0)
    onSubmit(a)
  }

  return (
    <div className="blocking-friction-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="blocking-friction-modal"
        role="dialog"
        aria-labelledby="blocking-friction-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="blocking-friction-title" className="blocking-friction-modal__title">
          Count the digits
        </h3>
        <p className="blocking-friction-modal__hint">
          For each grid, count how many times the digit <strong>(shown below)</strong> appears. Cells are not highlighted on
          purpose.
        </p>

        <form onSubmit={handleSubmit}>
          {challenge.rounds.map((round, ri) => (
            <div key={ri} className="blocking-friction-modal__round">
              <p className="blocking-friction-modal__round-label">
                Round {ri + 1} — how many <strong>{round.targetDigit}</strong>s?
              </p>
              <div className="blocking-friction-grid" aria-hidden>
                {round.rows.map((row, i) => (
                  <div key={i} className="blocking-friction-grid__row">
                    {row.split('').map((ch, j) => (
                      <span key={j} className="blocking-friction-grid__cell">
                        {ch}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
              <label className="blocking-friction-modal__count-label">
                Your count
                <input
                  type="number"
                  min={0}
                  max={99}
                  inputMode="numeric"
                  value={answers[ri] ?? 0}
                  onChange={(e) => setAnswer(ri, e.target.value)}
                  required
                />
              </label>
            </div>
          ))}

          {error && <p className="blocking-friction-modal__error">{error}</p>}

          <div className="blocking-friction-modal__actions">
            <button type="button" className="blocking-friction-modal__btn" disabled={busy} onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="blocking-friction-modal__btn blocking-friction-modal__btn--primary"
              disabled={busy}
            >
              {busy ? '…' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
