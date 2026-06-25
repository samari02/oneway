import { useState } from 'react'
import { resetTodayPlan, skipEveningReflection } from '../api/dailyPlans'
import { MorningFlowShell } from './morning/MorningFlowShell'
import './morning/MorningFlow.css'

type EveningReflectionViewProps = {
  firstName: string
  userId: string | undefined
  onActionComplete: () => Promise<void>
}

export function EveningReflectionView({
  firstName,
  userId,
  onActionComplete,
}: EveningReflectionViewProps) {
  const [isResetting, setIsResetting] = useState(false)
  const [isSkipping, setIsSkipping] = useState(false)
  const isBusy = isResetting || isSkipping

  const handlePlanAgain = async () => {
    if (!userId || isBusy) return

    setIsResetting(true)
    try {
      await resetTodayPlan(userId)
      await onActionComplete()
    } catch (err) {
      console.error('[EveningReflectionView] Failed to reset today plan:', err)
    } finally {
      setIsResetting(false)
    }
  }

  const handleSkip = async () => {
    if (!userId || isBusy) return

    setIsSkipping(true)
    try {
      await skipEveningReflection(userId)
      await onActionComplete()
    } catch (err) {
      console.error('[EveningReflectionView] Failed to skip evening reflection:', err)
    } finally {
      setIsSkipping(false)
    }
  }

  return (
    <div className="morning-flow morning-flow--shell morning-flow--no-bg">
      <div className="morning-flow__bg" aria-hidden />

      <div className="morning-flow__shell morning-flow__shell--flow">
        <div className="morning-flow__stage morning-flow__stage--flow">
          <MorningFlowShell
            firstName={firstName}
            greetingTitle={`Good evening, ${firstName}.`}
            greetingSubtitle="Rest is part of the work."
            monkMessage="Evening reflection is coming soon — a gentle space to look back on your day. For now, choose what feels right."
            isProcessing={isBusy}
            footer={
              <div className="evening-stub__actions">
                <button
                  type="button"
                  className="mf-btn mf-btn--primary mf-btn--wide"
                  onClick={() => void handlePlanAgain()}
                  disabled={!userId || isBusy}
                >
                  {isResetting ? 'Resetting…' : 'Plan again'}
                </button>
                <button
                  type="button"
                  className="mf-btn mf-btn--ghost mf-btn--wide"
                  onClick={() => void handleSkip()}
                  disabled={!userId || isBusy}
                >
                  {isSkipping ? 'One moment…' : 'Skip for now'}
                </button>
                <p className="evening-stub__hint">
                  Plan again starts fresh with the morning flow. Skip keeps your plan and returns you home.
                </p>
              </div>
            }
          >
            <div className="evening-stub__body" aria-hidden />
          </MorningFlowShell>
        </div>
      </div>
    </div>
  )
}
