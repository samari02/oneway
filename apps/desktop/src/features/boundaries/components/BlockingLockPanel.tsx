import { useState } from 'react'
import type { BlockingLockStatus } from '../hooks/useBlockingLock'
import './BlockingLockPanel.css'

interface BlockingLockPanelProps {
  status: BlockingLockStatus | null
  loading: boolean
  setPassword: (newPassword: string, currentPassword?: string) => Promise<void>
  unlock: (password: string) => Promise<void>
  relock: () => Promise<void>
}

function formatRemainingMs(untilMs: number): string {
  const ms = Math.max(0, untilMs - Date.now())
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function BlockingLockPanel({
  status,
  loading,
  setPassword,
  unlock,
  relock,
}: BlockingLockPanelProps) {
  const [showSetPw, setShowSetPw] = useState(false)
  const [showUnlock, setShowUnlock] = useState(false)
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwUnlock, setPwUnlock] = useState('')
  const [pwCurrent, setPwCurrent] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const closeModals = () => {
    setShowSetPw(false)
    setShowUnlock(false)
    setPwNew('')
    setPwConfirm('')
    setPwUnlock('')
    setPwCurrent('')
    setFormError(null)
  }

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (pwNew.length < 8) {
      setFormError('Use at least 8 characters.')
      return
    }
    if (pwNew !== pwConfirm) {
      setFormError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      if (status?.hasPassword) {
        await setPassword(pwNew, pwCurrent)
      } else {
        await setPassword(pwNew)
      }
      closeModals()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save password')
    } finally {
      setBusy(false)
    }
  }

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setBusy(true)
    try {
      await unlock(pwUnlock)
      closeModals()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unlock failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading || !status) {
    return (
      <div className="blocking-lock blocking-lock--loading">
        <span className="blocking-lock__muted">Checking lock…</span>
      </div>
    )
  }

  const unlockedUntil = status.unlockedUntilMs
  const isUnlocked = unlockedUntil != null && Date.now() < unlockedUntil

  return (
    <>
      <div className="blocking-lock">
        {!status.hasPassword && (
          <div className="blocking-lock__banner blocking-lock__banner--soft">
            <div className="blocking-lock__text">
              <strong>Optional:</strong> set a password so removing or turning off rules requires a short unlock (about{' '}
              {Math.round(status.unlockDurationSecs / 60)} minutes). Adding rules stays quick.
            </div>
            <button type="button" className="blocking-lock__btn" onClick={() => setShowSetPw(true)}>
              Set password
            </button>
          </div>
        )}

        {status.hasPassword && !isUnlocked && (
          <div className="blocking-lock__banner blocking-lock__banner--locked">
            <div className="blocking-lock__text">
              <strong>List is locked.</strong> You can still add rules. To remove a rule or turn one off, unlock with your
              password.
            </div>
            <button type="button" className="blocking-lock__btn blocking-lock__btn--primary" onClick={() => setShowUnlock(true)}>
              Unlock
            </button>
          </div>
        )}

        {status.hasPassword && isUnlocked && unlockedUntil != null && (
          <div className="blocking-lock__banner blocking-lock__banner--open">
            <div className="blocking-lock__text">
              <strong>Managing</strong> — time left: <span className="blocking-lock__timer">{formatRemainingMs(unlockedUntil)}</span>
            </div>
            <button type="button" className="blocking-lock__btn" onClick={() => void relock()}>
              Re-lock now
            </button>
            <button
              type="button"
              className="blocking-lock__btn blocking-lock__btn--ghost"
              onClick={() => {
                setPwCurrent('')
                setShowSetPw(true)
              }}
            >
              Change password
            </button>
          </div>
        )}

        <p className="blocking-lock__disclaimer">
          This protects against casual changes on this device. It cannot stop someone with full control of the computer.
        </p>
      </div>

      {showSetPw && (
        <div className="blocking-lock__modal-backdrop" role="presentation" onClick={() => !busy && closeModals()}>
          <div
            className="blocking-lock__modal"
            role="dialog"
            aria-labelledby="blocking-lock-set-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="blocking-lock-set-title" className="blocking-lock__modal-title">
              {status.hasPassword ? 'Change password' : 'Set password'}
            </h3>
            <form onSubmit={handleSetPassword}>
              {status.hasPassword && (
                <label className="blocking-lock__field">
                  Current password
                  <input
                    type="password"
                    value={pwCurrent}
                    onChange={(e) => setPwCurrent(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </label>
              )}
              <label className="blocking-lock__field">
                New password (min 8 characters)
                <input
                  type="password"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </label>
              <label className="blocking-lock__field">
                Confirm
                <input
                  type="password"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </label>
              {formError && <p className="blocking-lock__error">{formError}</p>}
              <div className="blocking-lock__modal-actions">
                <button type="button" className="blocking-lock__btn" disabled={busy} onClick={closeModals}>
                  Cancel
                </button>
                <button type="submit" className="blocking-lock__btn blocking-lock__btn--primary" disabled={busy}>
                  {busy ? '…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUnlock && (
        <div className="blocking-lock__modal-backdrop" role="presentation" onClick={() => !busy && closeModals()}>
          <div
            className="blocking-lock__modal"
            role="dialog"
            aria-labelledby="blocking-lock-unlock-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="blocking-lock-unlock-title" className="blocking-lock__modal-title">
              Unlock to manage
            </h3>
            <p className="blocking-lock__modal-hint">
              After unlocking, you can remove or turn off rules for about {Math.round(status.unlockDurationSecs / 60)} minutes.
            </p>
            <form onSubmit={handleUnlock}>
              <label className="blocking-lock__field">
                Password
                <input
                  type="password"
                  value={pwUnlock}
                  onChange={(e) => setPwUnlock(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              {formError && <p className="blocking-lock__error">{formError}</p>}
              <div className="blocking-lock__modal-actions">
                <button type="button" className="blocking-lock__btn" disabled={busy} onClick={closeModals}>
                  Cancel
                </button>
                <button type="submit" className="blocking-lock__btn blocking-lock__btn--primary" disabled={busy}>
                  {busy ? '…' : 'Unlock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
