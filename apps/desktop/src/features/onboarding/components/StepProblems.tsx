import { PROBLEMS } from '../types'
import { Mascot } from '../../mascot'
import './StepProblems.css'

interface StepProblemsProps {
  displayName: string
  selected: string[]
  onNameChange: (name: string) => void
  onChange: (problems: string[]) => void
  onNext: () => void
}

export function StepProblems({ displayName, selected, onNameChange, onChange, onNext }: StepProblemsProps) {
  const toggleProblem = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(p => p !== id))
    } else {
      onChange([...selected, id])
    }
  }

  const canContinue = displayName.trim().length > 0 && selected.length > 0

  return (
    <div className="onboarding-step">
      <div className="onboarding-step__header">
        <Mascot mood="happy" size="large" showMessage={false} />
        <h1 className="onboarding-step__title">Hey! Comment tu t'appelles ?</h1>
      </div>

      <div className="onboarding-step__name-field">
        <input
          type="text"
          className="onboarding-step__name-input"
          placeholder="Ton prénom"
          value={displayName}
          onChange={(e) => onNameChange(e.target.value)}
          autoFocus
        />
      </div>

      {displayName.trim() && (
        <>
          <p className="onboarding-step__subtitle">
            Enchanté {displayName} ! Qu'est-ce qui te freine ?
          </p>

          <div className="onboarding-step__content">
            <div className="problems-list">
          {PROBLEMS.map(problem => (
            <button
              key={problem.id}
              className={`problem-item ${selected.includes(problem.id) ? 'problem-item--selected' : ''}`}
              onClick={() => toggleProblem(problem.id)}
            >
              <span className="problem-item__icon">{problem.icon}</span>
              <span className="problem-item__label">{problem.label}</span>
              <span className="problem-item__check">
                {selected.includes(problem.id) ? '✓' : ''}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="onboarding-step__actions">
        <button
          className="onboarding-step__button onboarding-step__button--primary"
          onClick={onNext}
          disabled={!canContinue}
        >
          Continuer
        </button>
      </div>
          </>
        )}
    </div>
  )
}
