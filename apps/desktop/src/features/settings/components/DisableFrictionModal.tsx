import { useEffect, useState } from 'react'
import { DISABLE_CONFIRM_PHRASE } from '../hooks/useDisableFrictionPrefs'
import './DisableFrictionModal.css'

interface DisableFrictionModalProps {
  open: boolean
  title: string
  description?: string
  durationSecs: number
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}

/**
 * Autodiscipline gate: wait through a countdown, then type DISABLE to proceed.
 * Enable / resume paths should stay instant and skip this modal.
 */
export function DisableFrictionModal({
  open,
  title,
  description,
  durationSecs,
  busy = false,
  onCancel,
  onConfirm,
}: DisableFrictionModalProps) {
  const [remaining, setRemaining] = useState(durationSecs)
  const [phrase, setPhrase] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setRemaining(durationSecs)
    setPhrase('')
    setSubmitting(false)
  }, [open, durationSecs])

  useEffect(() => {
    if (!open || remaining <= 0) return
    const id = window.setTimeout(() => {
      setRemaining((r) => Math.max(0, r - 1))
    }, 1000)
    return () => window.clearTimeout(id)
  }, [open, remaining])

  if (!open) return null

  const waitDone = remaining <= 0
  const phraseOk = phrase.trim().toUpperCase() === DISABLE_CONFIRM_PHRASE
  const canConfirm = waitDone && phraseOk && !busy && !submitting

  const handleConfirm = async () => {
    if (!canConfirm) return
    setSubmitting(true)
    try {
      await onConfirm()
    } finally {
      setSubmitting(false)
    }
  }

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const timerLabel =
    mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`

  return (
    <div
      className="disable-friction-backdrop"
      role="presentation"
      onClick={() => !busy && !submitting && onCancel()}
    >
      <div
        className="disable-friction-modal"
        role="dialog"
        aria-labelledby="disable-friction-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="disable-friction-title" className="disable-friction-modal__title">
          {title}
        </h3>
        <p className="disable-friction-modal__desc">
          {description ??
            'Pause a moment before turning this off — impulse fades faster than regret.'}
        </p>

        <div className="disable-friction-modal__timer" aria-live="polite">
          {waitDone ? (
            <span>Ready — type {DISABLE_CONFIRM_PHRASE} below</span>
          ) : (
            <span>
              Wait <strong>{timerLabel}</strong> before you can confirm
            </span>
          )}
        </div>

        {!waitDone && (
          <div
            className="disable-friction-modal__progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={durationSecs}
            aria-valuenow={durationSecs - remaining}
          >
            <div
              className="disable-friction-modal__progress-bar"
              style={{ width: `${((durationSecs - remaining) / Math.max(1, durationSecs)) * 100}%` }}
            />
          </div>
        )}

        <label className="disable-friction-modal__field">
          Type <code>{DISABLE_CONFIRM_PHRASE}</code> to confirm
          <input
            type="text"
            className="disable-friction-modal__input"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            disabled={!waitDone || busy || submitting}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={waitDone ? DISABLE_CONFIRM_PHRASE : 'Available after countdown…'}
          />
        </label>

        <div className="disable-friction-modal__actions">
          <button
            type="button"
            className="disable-friction-modal__btn"
            disabled={busy || submitting}
            onClick={onCancel}
          >
            Keep protected
          </button>
          <button
            type="button"
            className="disable-friction-modal__btn disable-friction-modal__btn--danger"
            disabled={!canConfirm}
            onClick={() => void handleConfirm()}
          >
            {busy || submitting ? '…' : 'Turn off'}
          </button>
        </div>
      </div>
    </div>
  )
}
