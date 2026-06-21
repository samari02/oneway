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
    <div className="mf-stagger">
      <header>
        <h1 className="mf-title">Good morning, {firstName}.</h1>
      </header>

      <section className="mf-intention" aria-labelledby="mf-intention-heading">
        <h2 id="mf-intention-heading" className="mf-intention__heading">
          What matters today?
        </h2>
        <p className="mf-intention__desc">Set one intention to guide your focus</p>

        <div className="mf-intention__field">
          <input
            ref={inputRef}
            className="mf-intention__input"
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
    </div>
  )
}
