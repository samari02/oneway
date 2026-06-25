import { useRef, useState, type KeyboardEvent } from 'react'
import { HomeCharacter } from '../unified/HomeCharacter'

type PlanStepInputProps = {
  onSubmit: (text: string) => void | Promise<void>
  isProcessing: boolean
  error?: string | null
}

const QUICK_CHIPS = ['Add tasks', 'Reorganize', 'Clear my mind'] as const

export function PlanStepInput({ onSubmit, isProcessing, error }: PlanStepInputProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed || isProcessing) return
    void onSubmit(trimmed)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleChip = (chip: string) => {
    const prefix = chip === 'Add tasks' ? '' : chip === 'Reorganize' ? 'Reorganize: ' : ''
    setText((prev) => (prev ? `${prev}\n${prefix}` : prefix))
    textareaRef.current?.focus()
  }

  return (
    <div className="pmd-input">
      <div className="pmd-input__hero">
        <HomeCharacter size={100} />
      </div>

      <h2 className="pmd-input__heading">What&apos;s on your mind today?</h2>

      <div className="pmd-input__chips">
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            className="uh-pill"
            onClick={() => handleChip(chip)}
            disabled={isProcessing}
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="pmd-input__field">
        <textarea
          ref={textareaRef}
          className="uh-morning-input__textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your tasks, goals, or just brain-dump everything…"
          rows={4}
          disabled={isProcessing}
          autoFocus
        />
        <button
          type="button"
          className="pmd-input__submit"
          onClick={handleSubmit}
          disabled={!text.trim() || isProcessing}
          aria-label="Submit"
        >
          {isProcessing ? (
            <span className="pmd-input__spinner" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </div>

      {error && (
        <p className="pmd-input__error" role="alert">
          {error}
        </p>
      )}

      <p className="pmd-input__hint">
        ⌘+Enter to submit · Separate tasks with new lines or commas
      </p>
    </div>
  )
}
