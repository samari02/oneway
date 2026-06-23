import { useCallback, useEffect, useRef, useState } from 'react'
import { extractMorningPlan } from '@/lib/morning-plan'
import type { PlanItem, PlanItemKind } from '../../hooks/useMorningFlow'
import { toPlanItems } from '../../hooks/useMorningFlow'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'

type StepPhase = 'dump' | 'processing' | 'review'

export type VoiceCompanionMessage = {
  text: string
  variant: 'listening' | 'transcribing' | 'error'
}

const KIND_LABELS: Record<PlanItem['kind'], string> = {
  goal: 'Goals',
  task: 'Tasks',
  routine: 'Routines',
}

const KIND_ORDER: PlanItem['kind'][] = ['goal', 'task', 'routine']

type MorningStepIntentionProps = {
  firstName: string
  brainDump: string
  items: PlanItem[]
  priorityItemId?: string
  onBrainDumpChange: (value: string) => void
  onPlanExtracted: (
    dump: string,
    items: PlanItem[],
    meta: { avatarMessage: string; priorityQuestion: string; summaryFrame?: string },
  ) => void
  onPrioritySelect: (itemId: string) => void
  onConfirmPriority: (itemId?: string) => boolean
  onUpdateItem: (id: string, text: string) => void
  onDeleteItem: (id: string) => void
  onAddItem: (kind: PlanItemKind, text: string) => void
  onVoiceCompanionMessage?: (message: VoiceCompanionMessage | null) => void
}

type PlanItemRowProps = {
  item: PlanItem
  selected: boolean
  onSelect: () => void
  onUpdate: (text: string) => void
  onDelete: () => void
}

function PlanItemRow({ item, selected, onSelect, onUpdate, onDelete }: PlanItemRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.text)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(item.text)
  }, [item.text, editing])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commitEdit = useCallback(() => {
    const trimmed = draft.trim()
    if (trimmed) {
      onUpdate(trimmed)
    } else {
      setDraft(item.text)
    }
    setEditing(false)
  }, [draft, item.text, onUpdate])

  const cancelEdit = useCallback(() => {
    setDraft(item.text)
    setEditing(false)
  }, [item.text])

  return (
    <div
      role="listitem"
      className={`mf-plan-item${selected ? ' mf-plan-item--priority' : ''}${editing ? ' mf-plan-item--editing' : ''}`}
    >
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          className="mf-plan-item__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitEdit()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              cancelEdit()
            }
          }}
          aria-label={`Edit ${item.kind}`}
        />
      ) : (
        <button
          type="button"
          className="mf-plan-item__select"
          onClick={onSelect}
          aria-pressed={selected}
        >
          <span className="mf-plan-item__text">{item.text}</span>
          {selected && (
            <span className="mf-plan-item__star" aria-label="Priority">
              ★
            </span>
          )}
        </button>
      )}

      <div className="mf-plan-item__actions">
        {!editing && (
          <button
            type="button"
            className="mf-plan-item__action"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${item.text}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
        <button
          type="button"
          className="mf-plan-item__action mf-plan-item__action--delete"
          onClick={onDelete}
          aria-label={`Remove ${item.text}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

type AddItemRowProps = {
  kind: PlanItemKind
  label: string
  onAdd: (text: string) => void
}

function AddItemRow({ kind, label, onAdd }: AddItemRowProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const handleAdd = useCallback(() => {
    const trimmed = draft.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setDraft('')
    setOpen(false)
  }, [draft, onAdd])

  if (!open) {
    return (
      <button
        type="button"
        className="mf-plan-add"
        onClick={() => setOpen(true)}
      >
        + Add {label.toLowerCase().replace(/s$/, '')}
      </button>
    )
  }

  return (
    <div className="mf-plan-add-row">
      <input
        ref={inputRef}
        type="text"
        className="mf-plan-item__input mf-plan-add-row__input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={`New ${kind}…`}
        aria-label={`Add ${kind}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            handleAdd()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            setDraft('')
            setOpen(false)
          }
        }}
      />
      <button type="button" className="mf-btn mf-btn--ghost mf-btn--sm" onClick={handleAdd} disabled={!draft.trim()}>
        Add
      </button>
      <button
        type="button"
        className="mf-plan-item__action"
        onClick={() => {
          setDraft('')
          setOpen(false)
        }}
        aria-label="Cancel"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export function MorningStepIntention({
  firstName,
  brainDump,
  items,
  priorityItemId,
  onBrainDumpChange,
  onPlanExtracted,
  onPrioritySelect,
  onConfirmPriority,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onVoiceCompanionMessage,
}: MorningStepIntentionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const brainDumpBaseRef = useRef('')
  const sessionTranscriptRef = useRef('')
  const [phase, setPhase] = useState<StepPhase>(items.length > 0 ? 'review' : 'dump')
  const [avatarMessage, setAvatarMessage] = useState('')
  const [priorityQuestion, setPriorityQuestion] = useState('Which one would make today a win?')
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
    if (phase !== 'dump') {
      onVoiceCompanionMessage?.(null)
      return
    }

    if (isListening) {
      onVoiceCompanionMessage?.({
        text: 'Listening… speak freely, tap the mic when done',
        variant: 'listening',
      })
      return
    }

    if (isTranscribing) {
      onVoiceCompanionMessage?.({
        text: 'Transcribing your voice…',
        variant: 'transcribing',
      })
      return
    }

    if (speechError) {
      onVoiceCompanionMessage?.({
        text: speechError,
        variant: 'error',
      })
      return
    }

    onVoiceCompanionMessage?.(null)
  }, [phase, isListening, isTranscribing, speechError, onVoiceCompanionMessage])

  useEffect(() => {
    if (phase !== 'dump' && isListening) {
      stopSpeech()
    }
  }, [phase, isListening, stopSpeech])

  useEffect(() => {
    if (phase === 'dump') {
      textareaRef.current?.focus()
    }
  }, [phase])

  const handleBrainDumpSubmit = useCallback(async () => {
    const trimmed = brainDump.trim()
    if (!trimmed) return

    setError(null)
    setPhase('processing')

    try {
      const result = await extractMorningPlan(trimmed)
      const planItems = toPlanItems(result.items)
      setAvatarMessage(result.avatarMessage)
      setPriorityQuestion(result.priorityQuestion)
      onPlanExtracted(trimmed, planItems, {
        avatarMessage: result.avatarMessage,
        priorityQuestion: result.priorityQuestion,
        summaryFrame: result.summaryFrame,
      })
      setPhase('review')
    } catch {
      setError('Something went wrong. Try again or keep it simple.')
      setPhase('dump')
    }
  }, [brainDump, onPlanExtracted])

  useEffect(() => {
    if (items.length > 0 && phase === 'dump') {
      setPhase('review')
      if (!avatarMessage) {
        setAvatarMessage("Here's what I pulled from your brain dump.")
      }
    }
  }, [items.length, phase, avatarMessage])

  useEffect(() => {
    if (items.length === 0 && phase === 'review') {
      setPhase('dump')
    }
  }, [items.length, phase])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        void handleBrainDumpSubmit()
      }
    },
    [handleBrainDumpSubmit],
  )

  const canSubmitDump = brainDump.trim().length > 0
  const groupedItems = KIND_ORDER.map((kind) => ({
    kind,
    label: KIND_LABELS[kind],
    items: items.filter((item) => item.kind === kind),
  }))

  if (phase === 'processing') {
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
        </header>

        <section className="mf-plan-processing" aria-live="polite" aria-busy="true">
          <div className="mf-plan-processing__spinner" aria-hidden />
          <p className="mf-plan-processing__text">Sorting your thoughts…</p>
        </section>
      </div>
    )
  }

  if (phase === 'review' && items.length > 0) {
    return (
      <div className="mf-welcome mf-stagger mf-welcome--review">
        <header className="mf-welcome__greeting">
          <p className="mf-eyebrow">Clarity</p>
          <h1 className="mf-welcome__title mf-welcome__title--sm">{avatarMessage}</h1>
          <p className="mf-plan-review__subtitle">Tap to edit, star your focus, then continue.</p>
        </header>

        <section className="mf-plan-review" aria-labelledby="mf-plan-review-heading">
          <h2 id="mf-plan-review-heading" className="sr-only">
            Structured plan
          </h2>

          <div className="mf-plan-groups">
            {groupedItems.map((group) => (
              <div key={group.kind} className="mf-plan-group">
                <h3 className="mf-plan-group__label">{group.label}</h3>
                <div className="mf-plan-group__items" role="list">
                  {group.items.map((item) => (
                    <PlanItemRow
                      key={item.id}
                      item={item}
                      selected={priorityItemId === item.id}
                      onSelect={() => onPrioritySelect(item.id)}
                      onUpdate={(text) => onUpdateItem(item.id, text)}
                      onDelete={() => onDeleteItem(item.id)}
                    />
                  ))}
                </div>
                <AddItemRow
                  kind={group.kind}
                  label={group.label}
                  onAdd={(text) => onAddItem(group.kind, text)}
                />
              </div>
            ))}
          </div>

          <div className="mf-plan-priority">
            <p className="mf-plan-priority__question">{priorityQuestion}</p>
            <p className="mf-plan-priority__hint">
              {priorityItemId
                ? 'Looks good — continue when ready.'
                : 'Select a focus item, or skip for now.'}
            </p>
            <div className="mf-continue-row mf-continue-row--split">
              <button
                type="button"
                className="mf-btn mf-btn--ghost"
                onClick={() => onConfirmPriority(undefined)}
              >
                Skip for now
              </button>
              <button
                type="button"
                className="mf-btn mf-btn--primary"
                onClick={() => onConfirmPriority(priorityItemId)}
              >
                Continue
              </button>
            </div>
          </div>
        </section>
      </div>
    )
  }

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

      <section className="mf-welcome__intention mf-welcome__brain-dump" aria-labelledby="mf-brain-dump-heading">
        <h2 id="mf-brain-dump-heading" className="mf-welcome__intention-title">
          What&apos;s on your mind for today?
        </h2>
        <p className="mf-welcome__intention-desc">
          Dump everything here — messy is fine. We&apos;ll sort it out together.
        </p>

        <div className="mf-brain-dump__field">
          <textarea
            ref={textareaRef}
            className="mf-brain-dump__input"
            value={brainDump}
            onChange={(e) => {
              if (isListening) stopSpeech()
              onBrainDumpChange(e.target.value)
            }}
            onKeyDown={handleKeyDown}
            placeholder="e.g. finish the MVP landing page, call mom, gym after lunch, feeling scattered about the pitch deck…"
            aria-label="Brain dump for today"
            rows={5}
          />
          {isSpeechSupported && (
            <button
              type="button"
              className={`mf-brain-dump__mic${isListening ? ' mf-brain-dump__mic--listening' : ''}`}
              onClick={handleSpeechToggle}
              aria-pressed={isListening}
              aria-label={isListening ? 'Stop voice input' : 'Speak your brain dump'}
              title={isListening ? 'Tap to stop listening' : 'Speak instead of typing'}
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

        {error && (
          <p className="mf-brain-dump__error" role="alert">
            {error}
          </p>
        )}

        <div className="mf-continue-row mf-continue-row--brain-dump">
          {isSpeechSupported && (
            <button
              type="button"
              className={`mf-btn mf-btn--ghost mf-btn--speak${isListening ? ' mf-btn--speak-active' : ''}`}
              onClick={handleSpeechToggle}
              aria-pressed={isListening}
            >
              {isListening ? 'Stop' : 'Speak'}
            </button>
          )}
          <button
            type="button"
            className="mf-btn mf-btn--primary"
            onClick={() => void handleBrainDumpSubmit()}
            disabled={!canSubmitDump}
          >
            Sort my day
          </button>
        </div>
        <p className="mf-brain-dump__hint">
          {isSpeechSupported ? 'Speak or type — ⌘/Ctrl + Enter to continue' : '⌘/Ctrl + Enter to continue'}
        </p>
      </section>
    </div>
  )
}
