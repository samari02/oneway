import { STRICTNESS_OPTIONS } from '../types'
import type { OnboardingData } from '../types'
import './StepStrictness.css'

interface StepStrictnessProps {
  selected: OnboardingData['strictness']
  onChange: (strictness: OnboardingData['strictness']) => void
  onNext: () => void
  onBack: () => void
}

export function StepStrictness({ selected, onChange, onNext, onBack }: StepStrictnessProps) {
  return (
    <div className="onboarding-step">
      <div className="onboarding-step__header">
        <div className="onboarding-step__mascot">🛡️</div>
        <h1 className="onboarding-step__title">Ton niveau d'aide</h1>
        <p className="onboarding-step__subtitle">Comment veux-tu que Clarity t'aide ?</p>
      </div>

      <div className="onboarding-step__content">
        <div className="strictness-options">
          {STRICTNESS_OPTIONS.map(option => (
            <button
              key={option.id}
              className={`strictness-option ${selected === option.id ? 'strictness-option--selected' : ''}`}
              onClick={() => onChange(option.id)}
            >
              <div className="strictness-option__header">
                <span className="strictness-option__emoji">{option.emoji}</span>
                <span className="strictness-option__label">{option.label}</span>
              </div>
              <p className="strictness-option__description">{option.description}</p>
            </button>
          ))}
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
