import { useState } from 'react'
import { DEFAULT_HABITS, STRICTNESS_OPTIONS } from '../types'
import type { OnboardingData } from '../types'
import './StepSetup.css'

interface StepSetupProps {
  data: OnboardingData
  onComplete: () => Promise<void>
  onBack: () => void
}

export function StepSetup({ data, onComplete, onBack }: StepSetupProps) {
  const [loading, setLoading] = useState(false)

  // Get suggested habits based on selected problems
  const suggestedHabits = DEFAULT_HABITS.filter(habit =>
    habit.forProblems.some(p => data.problems.includes(p))
  )

  const strictnessOption = STRICTNESS_OPTIONS.find(o => o.id === data.strictness)

  const [error, setError] = useState<string | null>(null)

  const handleComplete = async () => {
    setLoading(true)
    setError(null)
    try {
      await onComplete()
    } catch (e) {
      console.error('Onboarding error:', e)
      setError(e instanceof Error ? e.message : 'Une erreur est survenue')
      setLoading(false)
    }
  }

  return (
    <div className="onboarding-step">
      <div className="onboarding-step__header">
        <div className="onboarding-step__mascot">🚀</div>
        <h1 className="onboarding-step__title">Tout est prêt !</h1>
        <p className="onboarding-step__subtitle">Voici ce qu'on va mettre en place</p>
      </div>

      <div className="onboarding-step__content">
        <div className="setup-summary">
          <div className="setup-section">
            <h3 className="setup-section__title">📋 Tes habits</h3>
            <div className="setup-habits">
              {suggestedHabits.length > 0 ? (
                suggestedHabits.map(habit => (
                  <div key={habit.name} className="setup-habit">
                    <span>{habit.icon}</span>
                    <span>{habit.name}</span>
                  </div>
                ))
              ) : (
                <p className="setup-section__empty">Tu pourras ajouter tes habits après</p>
              )}
            </div>
          </div>

          <div className="setup-section">
            <h3 className="setup-section__title">⏰ Ton planning</h3>
            <div className="setup-times">
              <div className="setup-time">
                <span>🌅 Réveil</span>
                <span>{data.wakeTime}</span>
              </div>
              <div className="setup-time">
                <span>📵 Écrans off</span>
                <span>{data.screenOffTime}</span>
              </div>
              <div className="setup-time">
                <span>😴 Coucher</span>
                <span>{data.sleepTime}</span>
              </div>
            </div>
          </div>

          <div className="setup-section">
            <h3 className="setup-section__title">🛡️ Mode</h3>
            <div className="setup-mode">
              <span>{strictnessOption?.emoji}</span>
              <span>{strictnessOption?.label}</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="setup-error">
          <p>❌ {error}</p>
        </div>
      )}

      <div className="onboarding-step__actions">
        <button
          className="onboarding-step__button onboarding-step__button--secondary"
          onClick={onBack}
          disabled={loading}
        >
          Retour
        </button>
        <button
          className="onboarding-step__button onboarding-step__button--primary"
          onClick={handleComplete}
          disabled={loading}
        >
          {loading ? 'Configuration...' : "C'est parti !"}
        </button>
      </div>
    </div>
  )
}
