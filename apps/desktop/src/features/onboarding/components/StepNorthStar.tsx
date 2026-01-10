import { useState } from 'react'
import './StepNorthStar.css'

interface StepNorthStarProps {
  goal: string
  icon: string
  onChange: (updates: { northStarGoal?: string; northStarIcon?: string }) => void
  onNext: () => void
  onBack: () => void
}

const ICONS = ['🎯', '💪', '🧘', '📚', '💼', '❤️', '✨', '🌟', '🏃', '🎨', '💡', '🚀']

export function StepNorthStar({ goal, icon, onChange, onNext, onBack }: StepNorthStarProps) {
  const [showIcons, setShowIcons] = useState(false)

  const canContinue = goal.trim().length > 0

  return (
    <div className="step-north-star">
      <div className="step-north-star__header">
        <span className="step-north-star__emoji">🎯</span>
        <h2>What's your North Star?</h2>
        <p className="step-north-star__subtitle">
          What do you want to achieve? This goal will guide your daily habits.
        </p>
      </div>

      <div className="step-north-star__form">
        <div className="step-north-star__input-row">
          <button 
            type="button"
            className="step-north-star__icon-btn"
            onClick={() => setShowIcons(!showIcons)}
          >
            {icon}
          </button>
          <input
            type="text"
            className="step-north-star__input"
            placeholder="Be healthier, learn a new skill, launch my project..."
            value={goal}
            onChange={(e) => onChange({ northStarGoal: e.target.value })}
            autoFocus
          />
        </div>

        {showIcons && (
          <div className="step-north-star__icons">
            {ICONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`step-north-star__icon-option ${icon === emoji ? 'step-north-star__icon-option--selected' : ''}`}
                onClick={() => {
                  onChange({ northStarIcon: emoji })
                  setShowIcons(false)
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <p className="step-north-star__hint">
          💡 Don't worry about being precise. You can refine it later.
        </p>
      </div>

      <div className="step-north-star__actions">
        <button 
          className="step-north-star__btn step-north-star__btn--secondary"
          onClick={onBack}
        >
          Back
        </button>
        <button 
          className="step-north-star__btn step-north-star__btn--primary"
          onClick={onNext}
          disabled={!canContinue}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
