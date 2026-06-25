import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/features/auth'
import { useMonkChat, type ProposedArea, type ProposedTask } from '../../hooks/useMonkChat'
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

function ProposalCard({
  areas,
  tasks,
  onConfirm,
  isSaving,
}: {
  areas: ProposedArea[]
  tasks: ProposedTask[]
  onConfirm: () => void
  isSaving: boolean
}) {
  return (
    <div className="monk-chat__proposal">
      <div className="monk-chat__proposal-section">
        <span className="monk-chat__proposal-label">Focus Areas</span>
        <div className="monk-chat__proposal-areas">
          {areas.map((area) => (
            <span
              key={area.label}
              className="monk-chat__proposal-area"
              style={{ '--area-color': area.color } as React.CSSProperties}
            >
              <span className="monk-chat__proposal-area-emoji">{area.emoji}</span>
              {area.label}
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
              <li key={i} className="monk-chat__proposal-task">
                <span
                  className="monk-chat__proposal-task-dot"
                  style={{ background: area?.color ?? '#7c3aed' }}
                />
                <span className="monk-chat__proposal-task-title">
                  {task.title}
                </span>
                <span className="monk-chat__proposal-task-area">
                  {task.areaLabel}
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
        disabled={isSaving}
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
    start,
    send,
    confirmProposal,
    markDone,
    reset,
  } = useMonkChat(categories, activeAreas)

  const [input, setInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const inputBaseRef = useRef('')
  const sessionTranscriptRef = useRef('')
  const startedRef = useRef(false)
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
    isTranscribing,
    error: speechError,
    toggle: toggleSpeech,
    stop: stopSpeech,
  } = useSpeechRecognition({ onTranscript: handleSpeechTranscript })

  const handleSpeechToggle = useCallback(() => {
    if (!isListening) {
      inputBaseRef.current = input
      sessionTranscriptRef.current = ''
    }
    toggleSpeech()
  }, [input, isListening, toggleSpeech])

  useEffect(() => {
    setPortalTarget(document.querySelector('.app-layout__content') as HTMLElement | null)
  }, [])

  useEffect(() => {
    if (open && !startedRef.current) {
      startedRef.current = true
      start()
    }
  }, [open, start])

  useEffect(() => {
    if (!open) {
      startedRef.current = false
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

  const handleSave = useCallback(async () => {
    if (!user) return
    setIsSaving(true)

    try {
      if (proposedAreas.length > 0) {
        await addProposedAreas(
          proposedAreas.map((a) => ({
            label: a.label,
            emoji: a.emoji,
            color: a.color,
          })),
        )
      }

      if (proposedTasks.length > 0) {
        const areaMap = new Map<string, string>()
        for (const a of proposedAreas) {
          areaMap.set(a.label.toLowerCase(), a.label)
        }

        const tasks = proposedTasks.map((pt) => ({
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
        proposedAreas.length > 0
          ? `Focus areas: ${proposedAreas.map((a) => a.label).join(', ')}`
          : '',
        proposedTasks.length > 0
          ? `Tasks: ${proposedTasks.map((t) => t.title).join(', ')}`
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

      setShowSuccess(true)
      markDone()

      setTimeout(() => {
        setIsSaving(false)
      }, 500)
    } catch (err) {
      console.error('[monk-chat] Failed to save:', err)
      setIsSaving(false)
    }
  }, [user, proposedAreas, proposedTasks, addProposedAreas, mergeTasks, markDone])

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

  const handleClose = useCallback(() => {
    stopSpeech()
    reset()
    setInput('')
    inputBaseRef.current = ''
    sessionTranscriptRef.current = ''
    setIsSaving(false)
    setShowSuccess(false)
    onClose()
  }, [reset, onClose, stopSpeech])

  if (!open || !portalTarget) return null

  const isInputDisabled =
    isTyping || phase === 'saving' || phase === 'done'

  const modal = (
    <div className="monk-chat-overlay" onClick={handleClose}>
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
          <button
            type="button"
            className="monk-chat__close"
            onClick={handleClose}
            aria-label="Close chat"
          >
            <CloseIcon />
          </button>
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
                  />
                </div>
              </div>
            )}

          {showSuccess && (
            <div className="monk-chat__success">
              <div className="monk-chat__success-icon">
                <CheckCircleIcon />
              </div>
              <span>Workspace saved successfully</span>
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
            <button
              type="button"
              className="monk-chat__done-btn"
              onClick={handleClose}
            >
              Done — back to dashboard
            </button>
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
                  className={`monk-chat__mic${isListening ? ' monk-chat__mic--listening' : ''}`}
                  onClick={handleSpeechToggle}
                  disabled={isInputDisabled || isTranscribing}
                  aria-pressed={isListening}
                  aria-label={isListening ? 'Stop voice input' : 'Speak your message'}
                >
                  <MicIcon />
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
            {isTranscribing && (
              <p className="monk-chat__voice-status">Transcribing…</p>
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
