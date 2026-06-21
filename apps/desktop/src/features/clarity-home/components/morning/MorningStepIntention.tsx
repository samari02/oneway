import { useCallback, useEffect, useRef, useState } from 'react'

const SUGGESTIONS = [
  'Build my startup',
  'Deep work',
  'Study',
  'Be present',
  'Rest intentionally',
] as const

type MorningStepIntentionProps = {
  firstName: string
  intention: string
  onIntentionChange: (value: string) => void
  onSubmit: (value: string) => boolean
}

export function MorningStepIntention({
  firstName,
  intention,
  onIntentionChange,
  onSubmit,
}: MorningStepIntentionProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [showMore, setShowMore] = useState(false)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(() => {
    onSubmit(intention)
  }, [intention, onSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  const canSubmit = intention.trim().length > 0

  return (
    <div className="mf-welcome mf-stagger">
      <header className="mf-welcome__greeting">
        <div className="mf-welcome__sun" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        </div>
        <h1 className="mf-welcome__title">Good morning, {firstName}.</h1>
        <p className="mf-welcome__subtitle">
          Every day is a new opportunity to stay close to what matters.
        </p>
      </header>

      <section className="mf-welcome__intention" aria-labelledby="mf-intention-heading">
        <h2 id="mf-intention-heading" className="mf-welcome__intention-title">
          What matters today?
        </h2>
        <p className="mf-welcome__intention-desc">Set one intention to guide your focus</p>

        <div className="mf-intention__field">
          <input
            ref={inputRef}
            className="mf-welcome__intention-input"
            type="text"
            value={intention}
            onChange={(e) => onIntentionChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Build the Clarity MVP, Study deeply, Be present..."
            aria-label="Today's intention"
          />
          <button
            type="button"
            className="mf-intention__submit"
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-label="Continue"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>

        <div className="mf-pills" role="list">
          {SUGGESTIONS.map((label) => (
            <button
              key={label}
              type="button"
              className="mf-pill"
              role="listitem"
              onClick={() => {
                onIntentionChange(label)
                inputRef.current?.focus()
              }}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className="mf-pill"
            role="listitem"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
          >
            More
          </button>
        </div>

        {showMore && (
          <div className="mf-pills" style={{ marginTop: 8 }}>
            {['Write', 'Exercise', 'Connect with someone', 'Plan the week'].map((label) => (
              <button
                key={label}
                type="button"
                className="mf-pill"
                onClick={() => {
                  onIntentionChange(label)
                  inputRef.current?.focus()
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="mf-continue-row">
          <button
            type="button"
            className="mf-btn mf-btn--primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            Continue
          </button>
        </div>
      </section>

      <footer className="mf-welcome__quote">
        The way is not in the sky. The way is in the heart. — Buddha
      </footer>
    </div>
  )
}
