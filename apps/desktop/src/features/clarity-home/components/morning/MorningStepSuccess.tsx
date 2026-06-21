import type { SuccessFrame } from '../../hooks/useMorningFlow'
import { intentionMentionsMvp } from '../../hooks/useMorningFlow'

type SuccessOption = {
  id: SuccessFrame
  label: string
  hint: string
  icon: React.ReactNode
}

function getSuccessOptions(intention: string): SuccessOption[] {
  const finishHint = intentionMentionsMvp(intention)
    ? 'Complete the entire MVP'
    : 'Wrap up what you started'

  return [
    {
      id: 'ship',
      label: 'Ship something',
      hint: 'Make something real and shareable',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M12 3 4 9v12h16V9l-8-6Z" />
          <path d="M9 21V12h6v9" />
        </svg>
      ),
    },
    {
      id: 'progress',
      label: 'Make meaningful progress',
      hint: 'Move the needle forward',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M3 3v18h18" />
          <path d="m7 14 4-4 4 4 5-6" />
        </svg>
      ),
    },
    {
      id: 'consistent',
      label: 'Stay consistent',
      hint: 'Show up and keep the momentum',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      ),
    },
    {
      id: 'finish',
      label: 'Finish completely',
      hint: finishHint,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <path d="M22 4 12 14.01l-3-3" />
        </svg>
      ),
    },
    {
      id: 'show_up',
      label: 'Just show up',
      hint: 'Focus on presence, not outcome',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4l3 3" />
        </svg>
      ),
    },
  ]
}

type MorningStepSuccessProps = {
  intention: string
  successFrame: SuccessFrame
  onSelect: (frame: SuccessFrame) => void
  onContinue: () => void
}

export function MorningStepSuccess({
  intention,
  successFrame,
  onSelect,
  onContinue,
}: MorningStepSuccessProps) {
  const options = getSuccessOptions(intention)

  return (
    <div className="mf-stagger">
      <header>
        <p className="mf-eyebrow">Got it.</p>
        <h1 className="mf-title mf-title--sm">Let&apos;s make it as clear as possible.</h1>
      </header>

      <section className="mf-success" aria-labelledby="mf-success-heading">
        <div className="mf-success__card">
          <h2 id="mf-success-heading" className="mf-success__card-title">
            What does success look like today?
          </h2>
          <p className="mf-success__card-desc">You can change this anytime.</p>

          <div className="mf-options" role="radiogroup" aria-label="Success framing">
            {options.map((option) => {
              const selected = successFrame === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`mf-option${selected ? ' mf-option--selected' : ''}`}
                  onClick={() => onSelect(option.id)}
                >
                  <span className="mf-option__icon">{option.icon}</span>
                  <span className="mf-option__body">
                    <span className="mf-option__label">{option.label}</span>
                    <span className="mf-option__hint">{option.hint}</span>
                  </span>
                  <span className="mf-option__radio" aria-hidden />
                </button>
              )
            })}
          </div>
        </div>

        <div className="mf-continue-row">
          <button type="button" className="mf-btn mf-btn--primary" onClick={onContinue}>
            Continue
          </button>
        </div>
      </section>
    </div>
  )
}
