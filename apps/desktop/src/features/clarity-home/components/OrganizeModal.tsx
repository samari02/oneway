import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { Task, TaskPlanning } from '@oneway/shared'
import { hasApiKey } from '@/lib/openai'
import { OPENAI_KEY_SETTINGS_HINT } from '../hooks/useSpeechRecognition'
import {
  suggestTaskOrganization,
  type TaskOrganizeContext,
  type TaskOrgSuggestion,
  type BucketContext,
  type SubContext,
} from '../api/suggestTaskOrganization'
import { CloseIcon, PLANNING_LABELS } from './tasksViewShared'
import './OrganizeModal.css'

type OrganizeModalProps = {
  openTasks: Task[]
  buckets: BucketContext[]
  subs: SubContext[]
  getBucketForSub: (subId: string) => { id: string; label: string } | undefined
  getSubLabel: (subId: string) => string
  onApply: (updates: Array<{ taskId: string; planning?: TaskPlanning; category?: string }>) => void
  onClose: () => void
}

type Phase = 'input' | 'loading' | 'preview'

type EnrichedSuggestion = {
  taskId: string
  taskTitle: string
  checked: boolean
  currentPlanning: TaskPlanning
  currentCategoryId: string
  currentCategoryLabel: string
  currentBucketLabel: string
  effectivePlanning?: TaskPlanning
  effectiveCategoryId?: string
  reason?: string
}

function planningPriority(planning: TaskPlanning): string {
  switch (planning) {
    case 'today':
      return 'High'
    case 'next':
      return 'Medium'
    case 'later':
      return 'Low'
    default:
      return 'Backlog'
  }
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1 3 1 1 3z" />
    </svg>
  )
}

function enrichSuggestions(
  raw: TaskOrgSuggestion[],
  openTasks: Task[],
  getBucketForSub: OrganizeModalProps['getBucketForSub'],
  getSubLabel: OrganizeModalProps['getSubLabel'],
): EnrichedSuggestion[] {
  const taskById = new Map(openTasks.map((t) => [t.id, t]))
  const result: EnrichedSuggestion[] = []

  for (const s of raw) {
    const task = taskById.get(s.taskId)
    if (!task || task.status !== 'open') continue

    const currentPlanning = task.planning ?? 'backlog'
    const bucket = getBucketForSub(task.category)
    const effectivePlanning = s.suggestedPlanning ?? currentPlanning
    const effectiveCategoryId = s.suggestedCategoryId ?? task.category

    const planningChange = effectivePlanning !== currentPlanning
    const categoryChange = effectiveCategoryId !== task.category
    if (!planningChange && !categoryChange) continue

    result.push({
      taskId: s.taskId,
      taskTitle: task.title,
      checked: true,
      currentPlanning,
      currentCategoryId: task.category,
      currentCategoryLabel: getSubLabel(task.category),
      currentBucketLabel: bucket?.label ?? '—',
      effectivePlanning,
      effectiveCategoryId,
      reason: s.reason,
    })
  }

  return result
}

export function OrganizeModal({
  openTasks,
  buckets,
  subs,
  getBucketForSub,
  getSubLabel,
  onApply,
  onClose,
}: OrganizeModalProps) {
  const [phase, setPhase] = useState<Phase>('input')
  const [userMessage, setUserMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reviewMode, setReviewMode] = useState(false)
  const [suggestions, setSuggestions] = useState<EnrichedSuggestion[]>([])
  const [appliedCount, setAppliedCount] = useState<number | null>(null)

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

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && phase !== 'loading') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, phase])

  const grouped = useMemo(() => {
    const map = new Map<string, EnrichedSuggestion[]>()

    for (const s of suggestions) {
      const subId = s.effectiveCategoryId ?? s.currentCategoryId
      const bucket = getBucketForSub(subId)
      const subLabel = getSubLabel(subId)
      const key = `${bucket?.label ?? '—'} · ${subLabel}`
      const list = map.get(key) ?? []
      list.push(s)
      map.set(key, list)
    }

    return Array.from(map.entries()).map(([label, items]) => ({
      label,
      color: '#8b5cf6',
      items,
    }))
  }, [suggestions, getBucketForSub, getSubLabel])

  const checkedCount = suggestions.filter((s) => s.checked).length

  const handleGenerate = useCallback(async () => {
    setError(null)
    setAppliedCount(null)
    setReviewMode(false)

    if (!hasApiKey()) {
      setError(OPENAI_KEY_SETTINGS_HINT)
      return
    }

    if (openTasks.length === 0) {
      setError('No open tasks to organize. Add some tasks first.')
      return
    }

    setPhase('loading')

    try {
      const raw = await suggestTaskOrganization(
        taskContext,
        buckets,
        subs,
        openTasks,
        userMessage || undefined,
      )

      const enriched = enrichSuggestions(raw, openTasks, getBucketForSub, getSubLabel)

      if (enriched.length === 0) {
        setError('Clarity thinks your tasks are already well organized — no changes suggested.')
        setPhase('input')
        return
      }

      setSuggestions(enriched)
      setPhase('preview')
    } catch (err) {
      if (err instanceof Error && err.message === 'NO_API_KEY') {
        setError(OPENAI_KEY_SETTINGS_HINT)
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      }
      setPhase('input')
    }
  }, [taskContext, buckets, subs, openTasks, userMessage, getBucketForSub, getSubLabel])

  const toggleSuggestion = (taskId: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.taskId === taskId ? { ...s, checked: !s.checked } : s)),
    )
  }

  const toggleAll = (checked: boolean) => {
    setSuggestions((prev) => prev.map((s) => ({ ...s, checked })))
  }

  const updateSuggestion = (
    taskId: string,
    updates: Partial<Pick<EnrichedSuggestion, 'effectivePlanning' | 'effectiveCategoryId'>>,
  ) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.taskId === taskId ? { ...s, ...updates } : s)),
    )
  }

  const handleApply = () => {
    const toApply = suggestions.filter((s) => {
      if (!s.checked) return false
      const planningChange = s.effectivePlanning !== s.currentPlanning
      const categoryChange = s.effectiveCategoryId !== s.currentCategoryId
      return planningChange || categoryChange
    })

    const updates = toApply.map((s) => ({
      taskId: s.taskId,
      ...(s.effectivePlanning !== s.currentPlanning ? { planning: s.effectivePlanning } : {}),
      ...(s.effectiveCategoryId !== s.currentCategoryId
        ? { category: s.effectiveCategoryId }
        : {}),
    }))

    onApply(updates)
    setAppliedCount(updates.length)
    setTimeout(onClose, 1200)
  }

  return (
    <div className="organize-modal__backdrop" role="presentation" onClick={onClose}>
      <div
        className="organize-modal"
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
          <button
            type="button"
            className="organize-modal__close"
            onClick={onClose}
            aria-label="Close"
            disabled={phase === 'loading'}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="organize-modal__body">
          {appliedCount !== null && (
            <p className="organize-modal__success">Applied {appliedCount} change{appliedCount === 1 ? '' : 's'}.</p>
          )}

          {phase === 'input' && (
            <section className="organize-modal__section" aria-labelledby="organize-capture-label">
              <h3 id="organize-capture-label" className="organize-modal__section-label">
                Capture anything
              </h3>
              <div className="organize-modal__input-wrap">
                <textarea
                  className="organize-modal__input"
                  placeholder="What's on your mind? (optional — e.g. &quot;focus on work this week&quot; or &quot;clear my Today column&quot;)"
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  rows={3}
                  aria-label="Optional guidance for Clarity"
                />
                <p className="organize-modal__context-note">
                  Clarity will analyze {openTasks.length} open task{openTasks.length === 1 ? '' : 's'} automatically.
                </p>
                <button
                  type="button"
                  className="organize-modal__generate-btn"
                  onClick={() => void handleGenerate()}
                  disabled={openTasks.length === 0}
                >
                  <SparkleIcon />
                  Get suggestions
                </button>
              </div>
            </section>
          )}

          {phase === 'loading' && (
            <div className="organize-modal__loading" aria-live="polite">
              <div className="organize-modal__spinner" aria-hidden />
              <span>Clarity is reviewing your tasks…</span>
            </div>
          )}

          {error && <p className="organize-modal__error" role="alert">{error}</p>}

          {phase === 'preview' && (
            <section className="organize-modal__section" aria-labelledby="organize-suggestions-label">
              <div className="organize-modal__preview-header">
                <h3 id="organize-suggestions-label" className="organize-modal__section-label">
                  AI organize suggestions
                </h3>
                <span className="organize-modal__preview-badge">Preview</span>
              </div>
              <p className="organize-modal__disclaimer">
                You&apos;re in control. Review before applying.
              </p>

              {suggestions.length === 0 ? (
                <p className="organize-modal__empty">No suggestions to show.</p>
              ) : (
                <div className="organize-modal__groups">
                  {grouped.map(({ label, color, items }) => (
                    <div key={label} className="organize-modal__group">
                      <div className="organize-modal__group-header">
                        <span
                          className="organize-modal__group-dot"
                          style={{ '--organize-cat-color': color } as CSSProperties}
                          aria-hidden
                        />
                        <span className="organize-modal__group-label">{label}</span>
                        <span className="organize-modal__group-count">{items.length}</span>
                      </div>
                      <ul className="organize-modal__suggestions">
                        {items.map((s) => {
                          const effectivePlanning = s.effectivePlanning ?? s.currentPlanning
                          return (
                            <li
                              key={s.taskId}
                              className={`organize-modal__suggestion${s.checked ? '' : ' organize-modal__suggestion--unchecked'}`}
                            >
                              <input
                                type="checkbox"
                                className="organize-modal__checkbox"
                                checked={s.checked}
                                onChange={() => toggleSuggestion(s.taskId)}
                                aria-label={`Apply suggestion for ${s.taskTitle}`}
                              />
                              <div className="organize-modal__suggestion-body">
                                <span className="organize-modal__suggestion-title">{s.taskTitle}</span>
                                {reviewMode ? (
                                  <div className="organize-modal__suggestion-change">
                                    <select
                                      className="organize-modal__edit-select"
                                      value={effectivePlanning}
                                      onChange={(e) =>
                                        updateSuggestion(s.taskId, {
                                          effectivePlanning: e.target.value as TaskPlanning,
                                        })
                                      }
                                      aria-label={`Planning for ${s.taskTitle}`}
                                    >
                                      {(Object.keys(PLANNING_LABELS) as TaskPlanning[]).map((p) => (
                                        <option key={p} value={p}>
                                          {PLANNING_LABELS[p]}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      className="organize-modal__edit-select"
                                      value={s.effectiveCategoryId ?? s.currentCategoryId}
                                      onChange={(e) =>
                                        updateSuggestion(s.taskId, {
                                          effectiveCategoryId: e.target.value,
                                        })
                                      }
                                      aria-label={`Category for ${s.taskTitle}`}
                                    >
                                      {subs.map((sub) => (
                                        <option key={sub.id} value={sub.id}>
                                          {sub.bucketLabel} → {sub.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <div className="organize-modal__suggestion-change">
                                    <span>{PLANNING_LABELS[s.currentPlanning]}</span>
                                    <span className="organize-modal__arrow" aria-hidden>→</span>
                                    {s.effectivePlanning && s.effectivePlanning !== s.currentPlanning && (
                                      <span
                                        className={`organize-modal__plan-badge organize-modal__plan-badge--${s.effectivePlanning}`}
                                      >
                                        {PLANNING_LABELS[s.effectivePlanning]}
                                      </span>
                                    )}
                                    {s.effectiveCategoryId &&
                                      s.effectiveCategoryId !== s.currentCategoryId && (
                                        <>
                                          <span className="organize-modal__arrow" aria-hidden>·</span>
                                          <span>{getSubLabel(s.effectiveCategoryId)}</span>
                                        </>
                                      )}
                                    <span className="organize-modal__priority">
                                      {planningPriority(effectivePlanning)}
                                    </span>
                                  </div>
                                )}
                                {s.reason && !reviewMode && (
                                  <p className="organize-modal__reason">{s.reason}</p>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        <footer className="organize-modal__footer">
          {phase === 'preview' && suggestions.length > 0 && (
            <label className="organize-modal__select-all">
              <input
                type="checkbox"
                checked={checkedCount === suggestions.length}
                ref={(el) => {
                  if (el) el.indeterminate = checkedCount > 0 && checkedCount < suggestions.length
                }}
                onChange={(e) => toggleAll(e.target.checked)}
              />
              Select all
            </label>
          )}

          {phase === 'preview' ? (
            <>
              <button type="button" className="organize-modal__btn organize-modal__btn--ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="organize-modal__btn organize-modal__btn--ghost"
                onClick={() => setReviewMode((v) => !v)}
              >
                {reviewMode ? 'Done editing' : 'Review & edit'}
              </button>
              <button
                type="button"
                className="organize-modal__btn organize-modal__btn--primary"
                onClick={handleApply}
                disabled={checkedCount === 0 || appliedCount !== null}
              >
                Apply suggestions ({checkedCount})
              </button>
            </>
          ) : phase === 'input' ? (
            <button type="button" className="organize-modal__btn organize-modal__btn--ghost" onClick={onClose}>
              Cancel
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  )
}
