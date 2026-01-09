import type { OnboardingData } from '../types'
import './StepBestSelf.css'

interface StepBestSelfProps {
  wakeTime: string
  sleepTime: string
  screenOffTime: string
  onChange: (updates: Partial<OnboardingData>) => void
  onNext: () => void
  onBack: () => void
}

export function StepBestSelf({ 
  wakeTime, 
  sleepTime, 
  screenOffTime, 
  onChange, 
  onNext, 
  onBack 
}: StepBestSelfProps) {
  return (
    <div className="onboarding-step">
      <div className="onboarding-step__header">
        <div className="onboarding-step__mascot">✨</div>
        <h1 className="onboarding-step__title">Ta meilleure version</h1>
        <p className="onboarding-step__subtitle">À quoi ressemble ta journée idéale ?</p>
      </div>

      <div className="onboarding-step__content">
        <div className="time-inputs">
          <div className="time-input">
            <label className="time-input__label">
              <span className="time-input__icon">🌅</span>
              Je me lève à
            </label>
            <input
              type="time"
              className="time-input__field"
              value={wakeTime}
              onChange={(e) => onChange({ wakeTime: e.target.value })}
            />
          </div>

          <div className="time-input">
            <label className="time-input__label">
              <span className="time-input__icon">📵</span>
              J'arrête les écrans à
            </label>
            <input
              type="time"
              className="time-input__field"
              value={screenOffTime}
              onChange={(e) => onChange({ screenOffTime: e.target.value })}
            />
          </div>

          <div className="time-input">
            <label className="time-input__label">
              <span className="time-input__icon">😴</span>
              Je me couche à
            </label>
            <input
              type="time"
              className="time-input__field"
              value={sleepTime}
              onChange={(e) => onChange({ sleepTime: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="onboarding-step__actions">
        <button
          className="onboarding-step__button onboarding-step__button--secondary"
          onClick={onBack}
        >
          Retour
        </button>
        <button
          className="onboarding-step__button onboarding-step__button--primary"
          onClick={onNext}
        >
          Continuer
        </button>
      </div>
    </div>
  )
}
