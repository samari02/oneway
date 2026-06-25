import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/features/auth'
import {
  useMonkChat,
  type ProposedArea,
  type ProposedTask,
  fetchMonkChatSession,
  saveMonkChatSession,
  clearMonkChatSession,
} from '../../hooks/useMonkChat'
import { useCategoryStore } from '../../hooks/useCategoryStore'
import { useFocusAreaStore } from '../../hooks/useFocusAreaStore'
import { useTaskStore } from '../../hooks/useTaskStore'
import { saveUserContext } from '../../api/userContext'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'
import { HomeCharacter } from './HomeCharacter'
import './MonkChatModal.css'

const MONK_AVATAR_SIZE = 68

type MonkChatModalProps = {
  open: boolean
  onClose: () => void
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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
  )
}

function CheckCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function RemoveIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SavedSummaryCard({
  areas,
  tasks,
}: {
  areas: ProposedArea[]
  tasks: ProposedTask[]
}) {
  return (
    <div className="monk-chat__saved-summary">
      <div className="monk-chat__saved-summary-header">
        <CheckCircleIcon />
        <span>Saved to your workspace</span>
      </div>
      <div className="monk-chat__proposal-section">
        <span className="monk-chat__proposal-label">
          Focus Areas ({areas.length})
        </span>
        <div className="monk-chat__proposal-areas">
          {areas.map((area) => (
            <span
              key={area.label}
              className="monk-chat__proposal-area monk-chat__proposal-area--readonly"
              style={{ '--area-color': area.color } as React.CSSProperties}
            >
              <span className="monk-chat__proposal-area-emoji">{area.emoji}</span>
              {area.label}
            </span>
          ))}
        </div>
      </div>
      <div className="monk-chat__proposal-section">
        <span className="monk-chat__proposal-label">Tasks ({tasks.length})</span>
        <ul className="monk-chat__proposal-tasks">
          {tasks.map((task, i) => {
            const area = areas.find(
              (a) => a.label.toLowerCase() === task.areaLabel.toLowerCase(),
            )
            return (
              <li key={i} className="monk-chat__proposal-task monk-chat__proposal-task--readonly">
                <span
                  className="monk-chat__proposal-task-dot"
                  style={{ background: area?.color ?? '#7c3aed' }}
                />
                <span className="monk-chat__proposal-task-title">{task.title}</span>
                <span className="monk-chat__proposal-task-area">{task.areaLabel}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function ProposalCard({
  areas,
  tasks,
  onConfirm,
  isSaving,
  onUpdateArea,
  onRemoveArea,
  onUpdateTask,
  onRemoveTask,
  onUpdateTaskArea,
}: {
  areas: ProposedArea[]
  tasks: ProposedTask[]
  onConfirm: () => void
  isSaving: boolean
  onUpdateArea: (index: number, label: string) => void
  onRemoveArea: (index: number) => void
  onUpdateTask: (index: number, title: string) => void
  onRemoveTask: (index: number) => void
  onUpdateTaskArea: (index: number, areaLabel: string) => void
}) {
  const [editingArea, setEditingArea] = useState<number | null>(null)
  const [editingTask, setEditingTask] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  const startEditArea = (index: number, current: string) => {
    setEditingArea(index)
    setEditingTask(null)
    setEditValue(current)
  }

  const commitEditArea = (index: number) => {
    onUpdateArea(index, editValue)
    setEditingArea(null)
    setEditValue('')
  }

  const startEditTask = (index: number, current: string) => {
    setEditingTask(index)
    setEditingArea(null)
    setEditValue(current)
  }

  const commitEditTask = (index: number) => {
    onUpdateTask(index, editValue)
    setEditingTask(null)
    setEditValue('')
  }

  return (
    <div className="monk-chat__proposal">
      <div className="monk-chat__proposal-section">
        <span className="monk-chat__proposal-label">Focus Areas</span>
        <div className="monk-chat__proposal-areas">
          {areas.map((area, index) => (
            <span
              key={`${area.label}-${index}`}
              className="monk-chat__proposal-area monk-chat__proposal-area--editable"
              style={{ '--area-color': area.color } as React.CSSProperties}
            >
              <span className="monk-chat__proposal-area-emoji">{area.emoji}</span>
              {editingArea === index ? (
                <input
                  className="monk-chat__proposal-inline-input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitEditArea(index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEditArea(index)
                    if (e.key === 'Escape') setEditingArea(null)
                  }}
                  autoFocus
                />
              ) : (
                <span className="monk-chat__proposal-area-label">{area.label}</span>
              )}
              <span className="monk-chat__proposal-item-actions">
                <button
                  type="button"
                  className="monk-chat__proposal-action"
                  onClick={() => startEditArea(index, area.label)}
                  aria-label={`Edit ${area.label}`}
                >
                  <EditIcon />
                </button>
                <button
                  type="button"
                  className="monk-chat__proposal-action monk-chat__proposal-action--remove"
                  onClick={() => onRemoveArea(index)}
                  aria-label={`Remove ${area.label}`}
                  disabled={areas.length <= 1}
                >
                  <RemoveIcon />
                </button>
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="monk-chat__proposal-section">
        <span className="monk-chat__proposal-label">
          Tasks ({tasks.length})
        </span>
        <ul className="monk-chat__proposal-tasks">
          {tasks.map((task, i) => {
            const area = areas.find(
              (a) => a.label.toLowerCase() === task.areaLabel.toLowerCase(),
            )
            return (
              <li key={i} className="monk-chat__proposal-task monk-chat__proposal-task--editable">
                <span
                  className="monk-chat__proposal-task-dot"
                  style={{ background: area?.color ?? '#7c3aed' }}
                />
                {editingTask === i ? (
                  <input
                    className="monk-chat__proposal-inline-input monk-chat__proposal-inline-input--task"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => commitEditTask(i)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEditTask(i)
                      if (e.key === 'Escape') setEditingTask(null)
                    }}
                    autoFocus
                  />
                ) : (
                  <span className="monk-chat__proposal-task-title">{task.title}</span>
                )}
                <select
                  className="monk-chat__proposal-task-select"
                  value={task.areaLabel}
                  onChange={(e) => onUpdateTaskArea(i, e.target.value)}
                  aria-label={`Category for ${task.title}`}
                >
                  {areas.map((a) => (
                    <option key={a.label} value={a.label}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <span className="monk-chat__proposal-item-actions">
                  <button
                    type="button"
                    className="monk-chat__proposal-action"
                    onClick={() => startEditTask(i, task.title)}
                    aria-label={`Edit ${task.title}`}
                  >
                    <EditIcon />
                  </button>
                  <button
                    type="button"
                    className="monk-chat__proposal-action monk-chat__proposal-action--remove"
                    onClick={() => onRemoveTask(i)}
                    aria-label={`Remove ${task.title}`}
                  >
                    <RemoveIcon />
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      <button
        type="button"
        className="monk-chat__proposal-confirm"
        onClick={onConfirm}
        disabled={isSaving || areas.length === 0}
      >
        {isSaving ? (
          <span className="monk-chat__spinner" />
        ) : (
          <CheckCircleIcon />
        )}
        {isSaving ? 'Saving…' : 'Looks good — save everything'}
      </button>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="monk-chat__typing">
      <span />
      <span />
      <span />
    </div>
  )
}

export function MonkChatModal({ open, onClose }: MonkChatModalProps) {
  const { user } = useAuth()
  const { categories } = useCategoryStore()
  const { activeAreas, addProposedAreas } = useFocusAreaStore(user?.id)
  const { mergeTasks } = useTaskStore(user?.id)

  const {
    messages,
    phase,
    isTyping,
    proposedAreas,
    proposedTasks,
    savedSummary,
    start,
    restore,
    send,
    confirmProposal,
    markDone,
    reset,
    getPersistableState,
    updateProposedArea,
    removeProposedArea,
    updateProposedTask,
    removeProposedTask,
    updateProposedTaskArea,
  } = useMonkChat(categories, activeAreas)

  const [input, setInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [farewellMessage, setFarewellMessage] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const inputBaseRef = useRef('')
  const sessionTranscriptRef = useRef('')
  const initializedRef = useRef(false)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  const handleSpeechTranscript = useCallback(
    (transcript: string, isFinal: boolean) => {
      const trimmed = transcript.trim()
      if (!trimmed) return

      if (isFinal) {
        const base = inputBaseRef.current
        const session = sessionTranscriptRef.current
        const combined = [base, session, trimmed].filter(Boolean).join(' ')
        sessionTranscriptRef.current = [session, trimmed].filter(Boolean).join(' ')
        inputBaseRef.current = combined
        setInput(combined)
        return
      }

      const base = inputBaseRef.current
      const session = sessionTranscriptRef.current
      const preview = [base, session, transcript].filter(Boolean).join(' ')
      setInput(preview)
    },
    [],
  )

  const {
    isSupported: isSpeechSupported,
    isListening,
    isStarting,
    isTranscribing,
    error: speechError,
    toggle: toggleSpeech,
    stop: stopSpeech,
  } = useSpeechRecognition({ onTranscript: handleSpeechTranscript })

  const handleSpeechToggle = useCallback(() => {
    if (!isListening && !isStarting) {
      inputBaseRef.current = input
      sessionTranscriptRef.current = ''
    }
    toggleSpeech()
  }, [input, isListening, isStarting, toggleSpeech])

  useEffect(() => {
    setPortalTarget(document.querySelector('.app-layout__content') as HTMLElement | null)
  }, [])

  useEffect(() => {
    if (open && user && !initializedRef.current) {
      initializedRef.current = true
      let cancelled = false

      void fetchMonkChatSession(user.id).then((saved) => {
        if (cancelled) return
        if (saved && saved.messages.length > 0) {
          restore(saved)
        } else {
          start()
        }
      })

      return () => {
        cancelled = true
      }
    }
  }, [open, user, start, restore])

  useEffect(() => {
    if (!open) {
      initializedRef.current = false
      setFarewellMessage(null)
    }
  }, [open])

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    }
  }, [messages, isTyping])

  useEffect(() => {
    if (!isTyping && phase !== 'done' && phase !== 'saving') {
      inputRef.current?.focus()
    }
  }, [isTyping, phase, messages])

  const persistSession = useCallback(() => {
    if (!user) return
    saveMonkChatSession(user.id, getPersistableState(), { immediate: true })
  }, [user, getPersistableState])

  const handleSave = useCallback(async () => {
    if (!user) return
    setIsSaving(true)

    const areasToSave = [...proposedAreas]
    const tasksToSave = [...proposedTasks]

    try {
      if (areasToSave.length > 0) {
        await addProposedAreas(
          areasToSave.map((a) => ({
            label: a.label,
            emoji: a.emoji,
            color: a.color,
          })),
        )
      }

      if (tasksToSave.length > 0) {
        const tasks = tasksToSave.map((pt) => ({
          id: crypto.randomUUID(),
          title: pt.title,
          category: pt.areaLabel,
          status: 'open' as const,
          createdAt: new Date().toISOString(),
          source: 'ai' as const,
        }))
        mergeTasks(tasks)
      }

      const contextSummary = [
        areasToSave.length > 0
          ? `Focus areas: ${areasToSave.map((a) => a.label).join(', ')}`
          : '',
        tasksToSave.length > 0
          ? `Tasks: ${tasksToSave.map((t) => t.title).join(', ')}`
          : '',
      ]
        .filter(Boolean)
        .join('. ')

      if (contextSummary) {
        await saveUserContext({
          user_id: user.id,
          context_text: contextSummary,
        })
      }

      markDone(areasToSave, tasksToSave)
      setIsSaving(false)
    } catch (err) {
      console.error('[monk-chat] Failed to save:', err)
      setIsSaving(false)
    }
  }, [
    user,
    proposedAreas,
    proposedTasks,
    addProposedAreas,
    mergeTasks,
    markDone,
  ])

  useEffect(() => {
    if (phase === 'done' && user) {
      persistSession()
    }
  }, [phase, user, persistSession])

  useEffect(() => {
    if (phase === 'saving') {
      handleSave()
    }
  }, [phase, handleSave])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || isTyping) return
    stopSpeech()
    setInput('')
    inputBaseRef.current = ''
    sessionTranscriptRef.current = ''
    send(text)
  }, [input, isTyping, send, stopSpeech])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleOptionClick = useCallback(
    (option: string) => {
      setInput('')
      send(option)
    },
    [send],
  )

  const handleContinueLater = useCallback(() => {
    stopSpeech()
    persistSession()
    setFarewellMessage("I'll be here when you're back.")
    setInput('')
    inputBaseRef.current = ''
    sessionTranscriptRef.current = ''
    setTimeout(() => {
      setFarewellMessage(null)
      onClose()
    }, 1200)
  }, [persistSession, onClose, stopSpeech])

  const handleClose = useCallback(() => {
    stopSpeech()
    if (phase !== 'welcome' && messages.length > 0) {
      persistSession()
    }
    setInput('')
    inputBaseRef.current = ''
    sessionTranscriptRef.current = ''
    setIsSaving(false)
    onClose()
  }, [persistSession, onClose, stopSpeech, phase, messages.length])

  const handleStartFresh = useCallback(() => {
    if (!user) return
    void clearMonkChatSession(user.id).then(() => {
      reset()
      setInput('')
      inputBaseRef.current = ''
      sessionTranscriptRef.current = ''
      start()
    })
  }, [user, reset, start])

  if (!open || !portalTarget) return null

  const isInputDisabled =
    isTyping || phase === 'saving' || phase === 'done'

  const micDisabledReason = isInputDisabled
    ? 'Wait for Monk to finish typing'
    : isStarting
      ? 'Starting microphone…'
      : isTranscribing
        ? 'Transcribing your voice…'
        : undefined

  const modal = (
    <div className="monk-chat-overlay" onClick={handleContinueLater}>
      <div
        className="monk-chat"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Chat with Monk"
      >
        <header className="monk-chat__header">
          <div className="monk-chat__header-info">
            <span className="monk-chat__header-name">Monk</span>
            <span className="monk-chat__header-status">
              {isTyping ? 'typing…' : 'online'}
            </span>
          </div>
          <div className="monk-chat__header-actions">
            {phase !== 'done' && phase !== 'saving' && (
              <button
                type="button"
                className="monk-chat__continue-later"
                onClick={handleContinueLater}
              >
                Continue later
              </button>
            )}
            <button
              type="button"
              className="monk-chat__close"
              onClick={handleClose}
              aria-label="Close chat"
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="monk-chat__messages" ref={scrollRef}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`monk-chat__bubble monk-chat__bubble--${msg.role}`}
            >
              {msg.role === 'monk' && (
                <div className="monk-chat__bubble-avatar">
                  <HomeCharacter size={MONK_AVATAR_SIZE} compact />
                </div>
              )}
              <div className="monk-chat__bubble-content">
                <div className="monk-chat__bubble-text">
                  {msg.text.split('\n').map((line, i) => {
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return (
                        <strong key={i}>
                          {line.slice(2, -2)}
                          <br />
                        </strong>
                      )
                    }
                    const boldParts = line.split(/(\*\*[^*]+\*\*)/)
                    return (
                      <span key={i}>
                        {boldParts.map((part, j) =>
                          part.startsWith('**') && part.endsWith('**') ? (
                            <strong key={j}>{part.slice(2, -2)}</strong>
                          ) : (
                            <span key={j}>{part}</span>
                          ),
                        )}
                        {i < msg.text.split('\n').length - 1 && <br />}
                      </span>
                    )
                  })}
                </div>
                {msg.options && msg.options.length > 0 && (
                  <div className="monk-chat__options">
                    {msg.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className="monk-chat__option"
                        onClick={() => handleOptionClick(opt)}
                        disabled={isInputDisabled}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {phase === 'proposal' &&
            proposedAreas.length > 0 && (
              <div className="monk-chat__bubble monk-chat__bubble--monk">
                <div className="monk-chat__bubble-avatar">
                  <HomeCharacter size={MONK_AVATAR_SIZE} compact />
                </div>
                <div className="monk-chat__bubble-content">
                  <ProposalCard
                    areas={proposedAreas}
                    tasks={proposedTasks}
                    onConfirm={confirmProposal}
                    isSaving={isSaving}
                    onUpdateArea={updateProposedArea}
                    onRemoveArea={removeProposedArea}
                    onUpdateTask={updateProposedTask}
                    onRemoveTask={removeProposedTask}
                    onUpdateTaskArea={updateProposedTaskArea}
                  />
                </div>
              </div>
            )}

          {phase === 'done' && savedSummary && (
            <div className="monk-chat__bubble monk-chat__bubble--monk">
              <div className="monk-chat__bubble-avatar">
                <HomeCharacter size={MONK_AVATAR_SIZE} compact />
              </div>
              <div className="monk-chat__bubble-content">
                <SavedSummaryCard
                  areas={savedSummary.areas}
                  tasks={savedSummary.tasks}
                />
              </div>
            </div>
          )}

          {farewellMessage && (
            <div className="monk-chat__farewell">
              <span>{farewellMessage}</span>
            </div>
          )}

          {isTyping && (
            <div className="monk-chat__bubble monk-chat__bubble--monk">
              <div className="monk-chat__bubble-avatar">
                <HomeCharacter size={MONK_AVATAR_SIZE} compact />
              </div>
              <div className="monk-chat__bubble-content">
                <TypingIndicator />
              </div>
            </div>
          )}
        </div>

        <div className="monk-chat__input-area">
          {phase === 'done' ? (
            <div className="monk-chat__done-actions">
              <button
                type="button"
                className="monk-chat__done-btn"
                onClick={handleClose}
              >
                Done — back to dashboard
              </button>
              <button
                type="button"
                className="monk-chat__fresh-btn"
                onClick={handleStartFresh}
              >
                Start fresh conversation
              </button>
            </div>
          ) : (
            <>
              <div className="monk-chat__input-row">
              <textarea
                ref={inputRef}
                className="monk-chat__input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  phase === 'areas' || phase === 'areas_explore'
                    ? 'e.g. Work, Health, Side Project, Learning…'
                    : phase === 'projects' || phase === 'projects_explore'
                      ? 'e.g. Building a productivity app, training for a marathon…'
                      : phase === 'tasks' || phase === 'tasks_explore'
                        ? 'e.g. Finish landing page, go to gym, read chapter 3…'
                        : 'Type a message…'
                }
                rows={1}
                disabled={isInputDisabled}
              />
              {isSpeechSupported && (
                <button
                  type="button"
                  className={`monk-chat__mic${isListening ? ' monk-chat__mic--listening' : ''}${isStarting ? ' monk-chat__mic--starting' : ''}`}
                  onClick={handleSpeechToggle}
                  disabled={isInputDisabled || isTranscribing || isStarting}
                  aria-pressed={isListening}
                  aria-label={isListening ? 'Stop voice input' : 'Speak your message'}
                  title={micDisabledReason}
                >
                  <MicIcon />
                  <span className="monk-chat__mic-ring" aria-hidden />
                </button>
              )}
              <button
                type="button"
                className="monk-chat__send"
                onClick={handleSend}
                disabled={isInputDisabled || !input.trim()}
                aria-label="Send message"
              >
                <SendIcon />
              </button>
            </div>
            {(isStarting || isListening || isTranscribing) && (
              <p className="monk-chat__voice-status" role="status" aria-live="polite">
                {(isStarting || isListening) && (
                  <span
                    className={`monk-chat__voice-status-dot${isListening ? ' monk-chat__voice-status-dot--listening' : ''}`}
                    aria-hidden
                  />
                )}
                {isStarting
                  ? 'Starting mic…'
                  : isListening
                    ? 'Listening…'
                    : 'Transcribing…'}
              </p>
            )}
            {speechError && (
              <p className="monk-chat__voice-error" role="alert">
                {speechError}
              </p>
            )}
            </>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, portalTarget)
}
