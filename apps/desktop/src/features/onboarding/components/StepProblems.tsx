import { PROBLEMS } from '../types'
import './StepProblems.css'

interface StepProblemsProps {
  selected: string[]
  onChange: (problems: string[]) => void
  onNext: () => void
}

export function StepProblems({ selected, onChange, onNext }: StepProblemsProps) {
  const toggleProblem = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(p => p !== id))
    } else {
      onChange([...selected, id])
    }
  }

  return (
    <div className="onboarding-step">
      <div className="onboarding-step__header">
        <div className="onboarding-step__mascot">💧</div>
        <h1 className="onboarding-step__title">Hey! Qu'est-ce qui te freine ?</h1>
        <p className="onboarding-step__subtitle">Sélectionne ce qui te parle</p>
      </div>

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
          disabled={selected.length === 0}
        >
          Continuer
        </button>
      </div>
    </div>
  )
}
