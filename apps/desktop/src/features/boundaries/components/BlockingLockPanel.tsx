import { useState } from 'react'
import type { BlockingLockStatus, FrictionChallengeStart } from '../hooks/useBlockingLock'
import { BlockingFrictionModal } from './BlockingFrictionModal'
import './BlockingLockPanel.css'

function invokeErrMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

interface BlockingLockPanelProps {
  status: BlockingLockStatus | null
  loading: boolean
  setPassword: (newPassword: string, currentPassword?: string) => Promise<void>
  setFrictionLock: () => Promise<void>
  unlock: (password: string) => Promise<void>
  relock: () => Promise<void>
  clearLock: (password?: string) => Promise<void>
  frictionStart: () => Promise<FrictionChallengeStart>
  frictionSubmit: (challengeId: string, answers: number[]) => Promise<void>
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
  setFrictionLock,
  unlock,
  relock,
  clearLock,
  frictionStart,
  frictionSubmit,
}: BlockingLockPanelProps) {
  const [showSetPw, setShowSetPw] = useState(false)
  const [showUnlock, setShowUnlock] = useState(false)
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwUnlock, setPwUnlock] = useState('')
  const [pwCurrent, setPwCurrent] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [frictionChallenge, setFrictionChallenge] = useState<FrictionChallengeStart | null>(null)
  const [frictionBusy, setFrictionBusy] = useState(false)
  const [frictionError, setFrictionError] = useState<string | null>(null)

  const closeModals = () => {
    setShowSetPw(false)
    setShowUnlock(false)
    setPwNew('')
    setPwConfirm('')
    setPwUnlock('')
    setPwCurrent('')
    setFormError(null)
  }

  const closeFriction = () => {
    setFrictionChallenge(null)
    setFrictionError(null)
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
      if (status?.hasLock && status.lockKind === 'password') {
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

  const handleUseFriction = async () => {
    if (
      !confirm(
        'Challenge lock: to remove or turn off rules you will complete counting steps each time (no password to remember). Continue?'
      )
    ) {
      return
    }
    setBusy(true)
    try {
      await setFrictionLock()
    } catch (err) {
      alert(invokeErrMessage(err) || 'Could not enable challenge lock')
    } finally {
      setBusy(false)
    }
  }

  const openFrictionUnlock = async () => {
    setFrictionError(null)
    setFrictionBusy(true)
    try {
      const ch = await frictionStart()
      setFrictionChallenge(ch)
    } catch (err) {
      setFrictionError(invokeErrMessage(err) || 'Could not start challenge')
    } finally {
      setFrictionBusy(false)
    }
  }

  const handleFrictionAnswers = async (answers: number[]) => {
    if (!frictionChallenge) return
    setFrictionBusy(true)
    setFrictionError(null)
    try {
      await frictionSubmit(
        frictionChallenge.challengeId,
        answers.map((n) => Math.min(255, Math.max(0, Math.floor(n))))
      )
      closeFriction()
    } catch (err) {
      const msg = invokeErrMessage(err) || 'Verification failed'
      setFrictionError(msg)
      try {
        const ch = await frictionStart()
        setFrictionChallenge(ch)
      } catch {
        setFrictionChallenge(null)
      }
    } finally {
      setFrictionBusy(false)
    }
  }

  const handleTurnOffProtection = async () => {
    if (!confirm('Turn off protection entirely? You can set a password or challenge lock again later.')) {
      return
    }
    setBusy(true)
    try {
      await clearLock()
    } catch (err) {
      const msg = invokeErrMessage(err) || 'Could not remove protection'
      const askPassword =
        status?.lockKind === 'password' &&
        (/unlock first|password|prompt/i.test(msg) || msg.includes('Unlock first'))
      if (askPassword) {
        const pw = window.prompt('Enter your password to turn off protection.')
        if (pw != null && pw !== '') {
          try {
            await clearLock(pw)
          } catch (e2) {
            alert(invokeErrMessage(e2) || 'Could not remove protection')
          }
        }
      } else {
        alert(msg)
      }
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
  // Match Rust session (canManageDestructive); avoid Date.now() vs backend skew that left "Managing" visible after expiry.
  const isUnlocked = status.hasLock && status.canManageDestructive
  const mins = Math.round(status.unlockDurationSecs / 60)

  return (
    <>
      <div className="blocking-lock">
        {!status.hasLock && (
          <div className="blocking-lock__banner blocking-lock__banner--soft">
            <div className="blocking-lock__text">
              <strong>Optional:</strong> protect removals — choose a <strong>password</strong> (quick unlock) or a{' '}
              <strong>challenge</strong> (count digits each time; nothing to memorize). Adding rules stays quick either way.
            </div>
            <div className="blocking-lock__setup-actions">
              <button type="button" className="blocking-lock__btn" disabled={busy} onClick={() => setShowSetPw(true)}>
                Set password
              </button>
              <button type="button" className="blocking-lock__btn blocking-lock__btn--primary" disabled={busy} onClick={() => void handleUseFriction()}>
                Use challenge lock
              </button>
            </div>
          </div>
        )}

        {status.hasLock && status.lockKind === 'password' && !isUnlocked && (
          <div className="blocking-lock__banner blocking-lock__banner--locked">
            <div className="blocking-lock__text">
              <strong>List is locked</strong> (password). You can still add rules. To remove or turn off a rule, unlock.
            </div>
            <button type="button" className="blocking-lock__btn blocking-lock__btn--primary" onClick={() => setShowUnlock(true)}>
              Unlock
            </button>
          </div>
        )}

        {status.hasLock && status.lockKind === 'friction' && !isUnlocked && (
          <div className="blocking-lock__banner blocking-lock__banner--locked">
            <div className="blocking-lock__text">
              <strong>List is locked</strong> (challenge). You can still add rules. To remove or turn off a rule, complete the
              counting steps.
            </div>
            <button
              type="button"
              className="blocking-lock__btn blocking-lock__btn--primary"
              disabled={frictionBusy}
              onClick={() => void openFrictionUnlock()}
            >
              {frictionBusy ? '…' : 'Unlock'}
            </button>
            {frictionError && !frictionChallenge && (
              <p className="blocking-lock__inline-error" role="alert">
                {frictionError}
              </p>
            )}
          </div>
        )}

        {status.hasLock && isUnlocked && unlockedUntil != null && (
          <div className="blocking-lock__banner blocking-lock__banner--open">
            <div className="blocking-lock__text">
              <strong>Managing</strong> — time left: <span className="blocking-lock__timer">{formatRemainingMs(unlockedUntil)}</span>
            </div>
            <button type="button" className="blocking-lock__btn" onClick={() => void relock()}>
              Re-lock now
            </button>
            {status.lockKind === 'password' && (
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
            )}
            <button type="button" className="blocking-lock__btn blocking-lock__btn--ghost" disabled={busy} onClick={() => void handleTurnOffProtection()}>
              Turn off protection
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
              {status.hasLock && status.lockKind === 'password' ? 'Change password' : 'Set password'}
            </h3>
            <form onSubmit={handleSetPassword}>
              {status.hasLock && status.lockKind === 'password' && (
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

      {showUnlock && status.lockKind === 'password' && (
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
              After unlocking, you can remove or turn off rules for about {mins} minutes.
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

      {frictionChallenge && (
        <BlockingFrictionModal
          challenge={frictionChallenge}
          busy={frictionBusy}
          error={frictionError}
          onClose={() => !frictionBusy && closeFriction()}
          onSubmit={(answers) => void handleFrictionAnswers(answers)}
        />
      )}
    </>
  )
}
