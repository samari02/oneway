import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import type { Task, TaskPlanning } from '@oneway/shared'
import { useAuth } from '@/features/auth'
import { hasApiKey } from '@/lib/openai'
import { getUserContext } from '../api/userContext'
import {
  findDuplicateCandidates,
  scanOrganizeChat,
  sendOrganizeChatMessage,
  type OrganizeChatTurn,
  type OrganizeScanPayload,
  type OrganizeSuggestion,
  type RecentlyCompletedTask,
} from '../api/organizeChat'
import type { BucketContext, SubContext, TaskOrganizeContext } from '../api/suggestTaskOrganization'
import { OPENAI_KEY_SETTINGS_HINT } from '../hooks/useSpeechRecognition'
import { HomeCharacter } from './unified/HomeCharacter'
import { CloseIcon, PLANNING_LABELS } from './tasksViewShared'
import './OrganizeModal.css'

const SESSION_KEY = 'clarity-organize-session'
const CLARITY_AVATAR_SIZE = 40

export type OrganizeApplyAction =
  | { type: 'move'; taskId: string; planning?: TaskPlanning; category?: string }
  | { type: 'merge'; keepTaskId: string; mergeTaskIds: string[]; title?: string }
  | { type: 'archive'; taskId: string }

type OrganizeModalProps = {
  openTasks: Task[]
  recentlyCompleted: RecentlyCompletedTask[]
  buckets: BucketContext[]
  subs: SubContext[]
  getBucketForSub: (subId: string) => { id: string; label: string } | undefined
  getSubLabel: (subId: string) => string
  onApply: (actions: OrganizeApplyAction[]) => void
  onClose: () => void
}

type EnrichedSuggestion = {
  id: string
  checked: boolean
  applied: boolean
} & OrganizeSuggestion

type ChatMessage = {
  id: string
  role: 'clarity' | 'user'
  text: string
  timestamp: number
  suggestions?: EnrichedSuggestion[]
}

type LoadingPhase = 'scan' | 'followup' | null

type PersistedSession = {
  messages: ChatMessage[]
  savedAt: number
}

function loadSession(): PersistedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedSession
    if (!Array.isArray(parsed.messages)) return null
    return parsed
  } catch {
    return null
  }
}

function saveSession(messages: ChatMessage[]): void {
  try {
    const session: PersistedSession = { messages, savedAt: Date.now() }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // sessionStorage may be unavailable
  }
}

function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}

function enrichSuggestions(
  raw: OrganizeSuggestion[],
  openTasks: Task[],
): EnrichedSuggestion[] {
  const taskById = new Map(openTasks.map((t) => [t.id, t]))
  const result: EnrichedSuggestion[] = []

  for (const s of raw) {
    const id = crypto.randomUUID()

    if (s.type === 'move') {
      const task = taskById.get(s.taskId)
      if (!task) continue
      result.push({ ...s, id, checked: true, applied: false })
    } else if (s.type === 'merge') {
      const keep = taskById.get(s.keepTaskId)
      if (!keep) continue
      const rawMergeIds =
        s.mergeTaskIds ??
        ('mergeTaskId' in s && typeof s.mergeTaskId === 'string' ? [s.mergeTaskId] : [])
      const validMergeIds = rawMergeIds.filter((id) => {
        const merge = taskById.get(id)
        return !!merge && id !== s.keepTaskId
      })
      if (validMergeIds.length === 0) continue
      result.push({ ...s, mergeTaskIds: validMergeIds, id, checked: true, applied: false })
    } else if (s.type === 'archive') {
      const task = taskById.get(s.taskId)
      if (!task) continue
      result.push({ ...s, id, checked: true, applied: false })
    }
  }

  return result
}

function suggestionLabel(
  s: EnrichedSuggestion,
  openTasks: Task[],
  getSubLabel: (subId: string) => string,
): string {
  const taskById = new Map(openTasks.map((t) => [t.id, t]))

  if (s.type === 'move') {
    const task = taskById.get(s.taskId)
    if (!task) return 'Move task'
    const parts: string[] = [`Move "${task.title}"`]
    const currentPlanning = task.planning ?? 'backlog'
    if (s.suggestedPlanning && s.suggestedPlanning !== currentPlanning) {
      parts.push(`→ ${PLANNING_LABELS[s.suggestedPlanning]}`)
    }
    if (s.suggestedCategoryId && s.suggestedCategoryId !== task.category) {
      parts.push(`→ ${getSubLabel(s.suggestedCategoryId)}`)
    }
    return parts.join(' ')
  }

  if (s.type === 'merge') {
    const keep = taskById.get(s.keepTaskId)
    const count = s.mergeTaskIds.length
    const title = s.suggestedTitle ?? keep?.title ?? 'task'
    if (count === 1) {
      const merge = taskById.get(s.mergeTaskIds[0])
      return `Merge "${merge?.title ?? 'duplicate'}" into "${title}" (archive duplicate)`
    }
    return `Archive ${count} duplicate${count === 1 ? '' : 's'}, keep "${title}"`
  }

  if (s.type === 'archive') {
    const task = taskById.get(s.taskId)
    return `Archive "${task?.title ?? 'task'}"`
  }

  return 'Suggestion'
}

function suggestionTypeBadge(type: EnrichedSuggestion['type']): string {
  switch (type) {
    case 'move':
      return 'MOVE'
    case 'merge':
      return 'MERGE'
    case 'archive':
      return 'ARCHIVE'
  }
}

function loadingMessage(phase: LoadingPhase): string {
  if (phase === 'scan') return 'Looking at your tasks…'
  if (phase === 'followup') return 'Organizing…'
  return 'Thinking…'
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function renderMessageText(text: string) {
  return text.split('\n').map((line, i, lines) => {
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
        {i < lines.length - 1 && <br />}
      </span>
    )
  })
}

function SuggestionCard({
  suggestions,
  openTasks,
  getSubLabel,
  onToggle,
}: {
  suggestions: EnrichedSuggestion[]
  openTasks: Task[]
  getSubLabel: (subId: string) => string
  onToggle: (id: string) => void
}) {
  const pending = suggestions.filter((s) => !s.applied)
  if (pending.length === 0) return null

  return (
    <div className="organize-modal__suggestion-card">
      <div className="organize-modal__suggestion-card-header">
        <span className="organize-modal__preview-badge">Suggestions</span>
      </div>
      <ul className="organize-modal__suggestions">
        {pending.map((s) => (
          <li
            key={s.id}
            className={`organize-modal__suggestion${s.checked ? '' : ' organize-modal__suggestion--unchecked'}`}
          >
            <input
              type="checkbox"
              className="organize-modal__checkbox"
              checked={s.checked}
              onChange={() => onToggle(s.id)}
              aria-label={suggestionLabel(s, openTasks, getSubLabel)}
            />
            <div className="organize-modal__suggestion-body">
              <div className="organize-modal__suggestion-meta">
                <span className={`organize-modal__type-badge organize-modal__type-badge--${s.type}`}>
                  {suggestionTypeBadge(s.type)}
                </span>
                <span className="organize-modal__suggestion-title">
                  {suggestionLabel(s, openTasks, getSubLabel)}
                </span>
              </div>
              {s.reason && <p className="organize-modal__reason">{s.reason}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function OrganizeModal({
  openTasks,
  recentlyCompleted,
  buckets,
  subs,
  getBucketForSub,
  getSubLabel,
  onApply,
  onClose,
}: OrganizeModalProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadSession()?.messages ?? [])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>(null)
  const [error, setError] = useState<string | null>(null)
  const [userContextText, setUserContextText] = useState<string | undefined>()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scanStartedRef = useRef(false)

  const taskContext = useMemo((): TaskOrganizeContext[] => {
    return openTasks.map((t) => {
      const bucket = getBucketForSub(t.category)
      return {
        id: t.id,
        title: t.title,
        categoryId: t.category,
        categoryLabel: getSubLabel(t.category),
        bucketLabel: bucket?.label ?? '—',
        planning: t.planning ?? 'backlog',
      }
    })
  }, [openTasks, getBucketForSub, getSubLabel])

  const duplicateCandidates = useMemo(
    () => findDuplicateCandidates(taskContext),
    [taskContext],
  )

  const scanPayload = useMemo(
    (): OrganizeScanPayload => ({
      openTasks: taskContext,
      buckets,
      subs,
      duplicateCandidates,
      recentlyCompleted,
      userContext: userContextText,
    }),
    [taskContext, buckets, subs, duplicateCandidates, recentlyCompleted, userContextText],
  )

  const chatHistory = useMemo((): OrganizeChatTurn[] => {
    return messages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text,
    }))
  }, [messages])

  const pendingSuggestions = useMemo(() => {
    return messages.flatMap((m) => m.suggestions?.filter((s) => !s.applied && s.checked) ?? [])
  }, [messages])

  const allPendingSuggestions = useMemo(() => {
    return messages.flatMap((m) => m.suggestions?.filter((s) => !s.applied) ?? [])
  }, [messages])

  const checkedCount = pendingSuggestions.length

  useEffect(() => {
    if (!user?.id) return
    void getUserContext(user.id)
      .then((ctx) => {
        if (ctx?.context_text) setUserContextText(ctx.context_text)
      })
      .catch(() => {
        // user context is optional
      })
  }, [user?.id])

  useEffect(() => {
    saveSession(messages)
  }, [messages])

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, isLoading])

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    }
  }, [messages, isLoading])

  const appendClarityMessage = useCallback(
    (text: string, rawSuggestions?: OrganizeSuggestion[]) => {
      const suggestions = rawSuggestions?.length
        ? enrichSuggestions(rawSuggestions, openTasks)
        : undefined

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'clarity',
          text,
          timestamp: Date.now(),
          suggestions,
        },
      ])
    },
    [openTasks],
  )

  const runScan = useCallback(async () => {
    setError(null)

    if (!hasApiKey()) {
      setError(OPENAI_KEY_SETTINGS_HINT)
      return
    }

    if (openTasks.length === 0) {
      setMessages([
        {
          id: crypto.randomUUID(),
          role: 'clarity',
          text: "You don't have any open tasks yet. Add some tasks first, then I can help you organize them.",
          timestamp: Date.now(),
        },
      ])
      return
    }

    setIsLoading(true)
    setLoadingPhase('scan')
    try {
      const result = await scanOrganizeChat(scanPayload, openTasks)
      appendClarityMessage(result.message, result.suggestions)
    } catch (err) {
      if (err instanceof Error && err.message === 'NO_API_KEY') {
        setError(OPENAI_KEY_SETTINGS_HINT)
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      }
    } finally {
      setIsLoading(false)
      setLoadingPhase(null)
    }
  }, [scanPayload, openTasks, appendClarityMessage])

  useEffect(() => {
    if (scanStartedRef.current) return
    scanStartedRef.current = true

    const saved = loadSession()
    if (saved && saved.messages.length > 0) {
      setMessages(saved.messages)
      return
    }

    void runScan()
  }, [runScan])

  const toggleSuggestion = useCallback((messageId: string, suggestionId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || !m.suggestions) return m
        return {
          ...m,
          suggestions: m.suggestions.map((s) =>
            s.id === suggestionId ? { ...s, checked: !s.checked } : s,
          ),
        }
      }),
    )
  }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return

    if (!hasApiKey()) {
      setError(OPENAI_KEY_SETTINGS_HINT)
      return
    }

    setError(null)
    setInput('')
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', text, timestamp: Date.now() },
    ])

    setIsLoading(true)
    setLoadingPhase('followup')
    try {
      const result = await sendOrganizeChatMessage(
        scanPayload,
        [...chatHistory, { role: 'user', content: text }],
        text,
        openTasks,
      )
      appendClarityMessage(result.message, result.suggestions)
    } catch (err) {
      if (err instanceof Error && err.message === 'NO_API_KEY') {
        setError(OPENAI_KEY_SETTINGS_HINT)
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      }
    } finally {
      setIsLoading(false)
      setLoadingPhase(null)
      inputRef.current?.focus()
    }
  }, [input, isLoading, scanPayload, chatHistory, openTasks, appendClarityMessage])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handleSend()
      }
    },
    [handleSend],
  )

  const handleApply = useCallback(() => {
    const toApply = messages.flatMap((m) => m.suggestions?.filter((s) => s.checked && !s.applied) ?? [])
    if (toApply.length === 0) return

    const actions: OrganizeApplyAction[] = []

    for (const s of toApply) {
      if (s.type === 'move') {
        const task = openTasks.find((t) => t.id === s.taskId)
        if (!task || task.status !== 'open') continue
        const action: OrganizeApplyAction = { type: 'move', taskId: s.taskId }
        const currentPlanning = task.planning ?? 'backlog'
        if (s.suggestedPlanning && s.suggestedPlanning !== currentPlanning) {
          action.planning = s.suggestedPlanning
        }
        if (s.suggestedCategoryId && s.suggestedCategoryId !== task.category) {
          action.category = s.suggestedCategoryId
        }
        if (action.planning || action.category) actions.push(action)
      } else if (s.type === 'merge') {
        actions.push({
          type: 'merge',
          keepTaskId: s.keepTaskId,
          mergeTaskIds: s.mergeTaskIds,
          title: s.suggestedTitle,
        })
      } else if (s.type === 'archive') {
        actions.push({ type: 'archive', taskId: s.taskId })
      }
    }

    if (actions.length === 0) return

    onApply(actions)

    const appliedIds = new Set(toApply.map((s) => s.id))
    setMessages((prev) =>
      prev.map((m) => ({
        ...m,
        suggestions: m.suggestions?.map((s) =>
          appliedIds.has(s.id) ? { ...s, applied: true, checked: false } : s,
        ),
      })),
    )

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'clarity',
        text: `Applied ${actions.length} change${actions.length === 1 ? '' : 's'}. Want to keep going or adjust anything else?`,
        timestamp: Date.now(),
      },
    ])
  }, [messages, openTasks, onApply])

  const handleClose = useCallback(() => {
    saveSession(messages)
    onClose()
  }, [messages, onClose])

  const handleStartFresh = useCallback(() => {
    clearSession()
    setMessages([])
    scanStartedRef.current = false
    setError(null)
    scanStartedRef.current = true
    void runScan()
  }, [runScan])

  return (
    <div className="organize-modal__backdrop" role="presentation" onClick={handleClose}>
      <div
        className="organize-modal organize-modal--chat"
        role="dialog"
        aria-labelledby="organize-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="organize-modal__header">
          <div className="organize-modal__header-text">
            <h2 id="organize-modal-title" className="organize-modal__title">
              Organize with Clarity
            </h2>
            <p className="organize-modal__subtitle">Let Clarity handle the chaos.</p>
          </div>
          <div className="organize-modal__header-actions">
            <button
              type="button"
              className="organize-modal__btn organize-modal__btn--ghost organize-modal__btn--sm"
              onClick={handleStartFresh}
              disabled={isLoading}
            >
              Rescan
            </button>
            <button
              type="button"
              className="organize-modal__close"
              onClick={handleClose}
              aria-label="Close"
              disabled={isLoading}
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="organize-modal__chat-thread" ref={scrollRef}>
          <p className="organize-modal__disclaimer organize-modal__disclaimer--inline">
            You&apos;re in control. Review before applying.
          </p>

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`organize-modal__bubble organize-modal__bubble--${msg.role}`}
            >
              {msg.role === 'clarity' && (
                <div className="organize-modal__bubble-avatar">
                  <HomeCharacter size={CLARITY_AVATAR_SIZE} compact />
                </div>
              )}
              <div className="organize-modal__bubble-content">
                <div className="organize-modal__bubble-text">{renderMessageText(msg.text)}</div>
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <SuggestionCard
                    suggestions={msg.suggestions}
                    openTasks={openTasks}
                    getSubLabel={getSubLabel}
                    onToggle={(suggestionId) => toggleSuggestion(msg.id, suggestionId)}
                  />
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="organize-modal__bubble organize-modal__bubble--clarity">
              <div className="organize-modal__bubble-avatar">
                <HomeCharacter size={CLARITY_AVATAR_SIZE} compact />
              </div>
              <div className="organize-modal__bubble-content">
                <div className="organize-modal__typing" aria-live="polite">
                  <span className="organize-modal__typing-label">
                    {loadingMessage(loadingPhase)}
                  </span>
                  <span className="organize-modal__typing-dots" aria-hidden>
                    <span className="organize-modal__typing-dot" />
                    <span className="organize-modal__typing-dot" />
                    <span className="organize-modal__typing-dot" />
                  </span>
                </div>
              </div>
            </div>
          )}

          {error && <p className="organize-modal__error" role="alert">{error}</p>}
        </div>

        <footer className="organize-modal__footer organize-modal__footer--chat">
          {allPendingSuggestions.length > 0 && (
            <div className="organize-modal__apply-bar">
              <button
                type="button"
                className="organize-modal__btn organize-modal__btn--primary"
                onClick={handleApply}
                disabled={checkedCount === 0 || isLoading}
              >
                Apply {checkedCount} selected
              </button>
              <span className="organize-modal__apply-hint">or keep talking below</span>
            </div>
          )}

          <div className="organize-modal__input-row">
            <textarea
              ref={inputRef}
              className="organize-modal__chat-input"
              placeholder="Ask Clarity or answer a question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isLoading}
              aria-label="Message to Clarity"
            />
            <button
              type="button"
              className="organize-modal__send-btn"
              onClick={() => void handleSend()}
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
            >
              <SendIcon />
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
