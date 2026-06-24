import { useCallback, useEffect, useRef, useState } from 'react'
import { extractMorningPlan } from '@/lib/morning-plan'
import { toPlanItems } from '../../hooks/useMorningFlow'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'
import {
  CarriedForwardChip,
  CarriedOverCard,
  MOCK_CARRIED_GOAL,
  MOCK_YESTERDAY_GOALS,
  YesterdayCard,
  type YesterdayGoal,
} from './MorningContextCards'

const PLACEHOLDER_SUGGESTIONS = ['Finish proposal', 'Review onboarding', 'Exercise']

type MorningStepIntentionProps = {
  brainDump: string
  carriedForwardText?: string
  showCarriedCard: boolean
  yesterdayGoals?: YesterdayGoal[]
  onBrainDumpChange: (value: string) => void
  onPlanExtracted: (
    dump: string,
    items: ReturnType<typeof toPlanItems>,
    meta: {
      summaryFrame?: string
      suggestedBlockers?: string[]
      durationMinutes?: number
    },
  ) => void
  onCarryForward: (text: string) => void
  onDismissCarried: () => void
  onRemoveCarriedForward: () => void
  onContinue: () => void
  onExtractingChange: (extracting: boolean) => void
}

export function MorningStepIntention({
  brainDump,
  carriedForwardText,
  showCarriedCard,
  yesterdayGoals = MOCK_YESTERDAY_GOALS,
  onBrainDumpChange,
  onPlanExtracted,
  onCarryForward,
  onDismissCarried,
  onRemoveCarriedForward,
  onContinue,
  onExtractingChange,
}: MorningStepIntentionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const brainDumpBaseRef = useRef('')
  const sessionTranscriptRef = useRef('')
  const [error, setError] = useState<string | null>(null)

  const handleSpeechTranscript = useCallback(
    (transcript: string, isFinal: boolean) => {
      const trimmed = transcript.trim()
      if (!trimmed) return

      if (isFinal) {
        const base = brainDumpBaseRef.current
        const session = sessionTranscriptRef.current
        const combined = [base, session, trimmed].filter(Boolean).join(' ')
        sessionTranscriptRef.current = [session, trimmed].filter(Boolean).join(' ')
        brainDumpBaseRef.current = combined
        onBrainDumpChange(combined)
        return
      }

      const base = brainDumpBaseRef.current
      const session = sessionTranscriptRef.current
      const preview = [base, session, transcript].filter(Boolean).join(' ')
      onBrainDumpChange(preview)
    },
    [onBrainDumpChange],
  )

  const {
    isSupported: isSpeechSupported,
    isListening,
    isTranscribing,
    error: speechError,
    toggle: toggleSpeech,
    stop: stopSpeech,
  } = useSpeechRecognition({ onTranscript: handleSpeechTranscript })

  const handleSpeechToggle = useCallback(() => {
    if (!isListening) {
      brainDumpBaseRef.current = brainDump
      sessionTranscriptRef.current = ''
    }
    toggleSpeech()
  }, [brainDump, isListening, toggleSpeech])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(async () => {
    const trimmed = brainDump.trim()
    if (!trimmed) return

    setError(null)
    onExtractingChange(true)

    try {
      const result = await extractMorningPlan(trimmed)
      const planItems = toPlanItems(result.items)
      onPlanExtracted(trimmed, planItems, {
        summaryFrame: result.summaryFrame,
        suggestedBlockers: result.suggestedBlockers,
        durationMinutes: result.suggestedDurationMinutes,
      })
      onContinue()
    } catch {
      setError('Something went wrong. Try again or keep it simple.')
    } finally {
      onExtractingChange(false)
    }
  }, [brainDump, onPlanExtracted, onContinue, onExtractingChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        void handleSubmit()
      }
    },
    [handleSubmit],
  )

  const applySuggestion = (suggestion: string) => {
    onBrainDumpChange(brainDump.trim() ? `${brainDump.trim()}, ${suggestion}` : suggestion)
    textareaRef.current?.focus()
  }

  const canContinue = brainDump.trim().length > 0

  return (
    <div className="mf-intention">
      <div className="mf-intention__input-wrap">
        {carriedForwardText && (
          <div className="mf-intention__chips">
            <CarriedForwardChip text={carriedForwardText} onRemove={onRemoveCarriedForward} />
          </div>
        )}

        <div className="mf-brain-dump__field">
          {(isListening || isTranscribing) && !brainDump.trim() && (
            <p className="mf-brain-dump__listening" role="status" aria-live="polite">
              <span className="mf-brain-dump__listening-dot" aria-hidden />
              {isListening ? 'Listening…' : 'Transcribing…'}
            </p>
          )}
          <textarea
            ref={textareaRef}
            className="mf-brain-dump__input mf-intention__textarea"
            value={brainDump}
            onChange={(e) => {
              if (isListening) stopSpeech()
              onBrainDumpChange(e.target.value)
            }}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDER_SUGGESTIONS.join(', ')}
            aria-label="What would make today successful?"
            rows={4}
          />
          {isSpeechSupported && (
            <button
              type="button"
              className={`mf-brain-dump__mic${isListening ? ' mf-brain-dump__mic--listening' : ''}`}
              onClick={handleSpeechToggle}
              aria-pressed={isListening}
              aria-label={isListening ? 'Stop voice input' : 'Speak your intention'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M19 11a7 7 0 0 1-14 0M12 18v3M8 21h8"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="mf-brain-dump__mic-ring" aria-hidden />
            </button>
          )}
        </div>

        <div className="mf-intention__suggestions" aria-label="Suggestions">
          {PLACEHOLDER_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="mf-pill"
              onClick={() => applySuggestion(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      <div className="mf-intention__context">
        <YesterdayCard goals={yesterdayGoals} />
        {showCarriedCard && !carriedForwardText && (
          <CarriedOverCard
            goal={MOCK_CARRIED_GOAL}
            onCarryForward={() => onCarryForward(MOCK_CARRIED_GOAL.text)}
            onLetGo={onDismissCarried}
          />
        )}
      </div>

      {speechError && (
        <p className="mf-brain-dump__voice-error" role="alert">
          {speechError}
        </p>
      )}

      {error && (
        <p className="mf-brain-dump__error" role="alert">
          {error}
        </p>
      )}

      <div className="mf-shell__footer-actions">
        <button
          type="button"
          className="mf-btn mf-btn--primary mf-btn--wide"
          onClick={() => void handleSubmit()}
          disabled={!canContinue}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
