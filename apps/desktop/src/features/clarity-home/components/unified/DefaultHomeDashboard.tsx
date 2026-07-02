import { useMemo, useState, useRef, useCallback, useEffect, type CSSProperties } from 'react'
import type { DailyPlan, FocusArea } from '@oneway/shared'
import { useTaskStore } from '../../hooks/useTaskStore'
import type { Task } from '@oneway/shared'
import { useCategoryStore, resolveTaskDisplayBucket } from '../../hooks/useCategoryStore'
import { CategoryIcon } from '../CategoryIcon'
import { HomeCharacter } from './HomeCharacter'
import { MonkContextPrompt } from './MonkContextPrompt'
import { EveningReflectionPrompt } from './EveningReflectionPrompt'
import { CurrentFocusSection } from './CurrentFocusSection'
import { useCurrentFocus } from '../../hooks/useCurrentFocus'

type TimeOfDay = 'morning' | 'daytime' | 'evening'

type DefaultHomeDashboardProps = {
  greeting: string
  subtitle: string
  todayPlan: DailyPlan | null
  timeOfDay: TimeOfDay
  isBusy: boolean
  isResetting: boolean
  onContinueFocus: () => void
  onPlanMyDay: () => void
  focusAreas?: FocusArea[]
  userId?: string
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3a5 5 0 0 1 5 5v2.5l1.2 2.4a1 1 0 0 1-.9 1.4H6.7a1 1 0 0 1-.9-1.4L7 10.5V8a5 5 0 0 1 5-5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2l1.4 4.6L18 8l-4.6 1.4L12 14l-1.4-4.6L6 8l4.6-1.4L12 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M19 14l.8 2.6L22 17l-2.2.4L19 20l-.8-2.6L16 17l2.2-.4L19 14Z" fill="currentColor" />
    </svg>
  )
}

function TaskFocusButton({
  active,
  label,
  onSelect,
}: {
  active: boolean
  label: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={`uh-dash-open__focus-btn${active ? ' uh-dash-open__focus-btn--active' : ''}`}
      aria-label={`Set "${label}" as current focus`}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    </button>
  )
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7L8 5Z" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
      <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}


function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M9 7V5h6v2M10 11v6M14 11v6M6 7l1 12h10l1-12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function OpenTaskRow({
  task,
  isDone,
  completing,
  focusActive,
  onToggle,
  onComplete,
  onSelectFocus,
  onSaveTitle,
  onDelete,
}: {
  task: Task
  isDone: boolean
  completing: boolean
  focusActive: boolean
  onToggle: () => void
  onComplete: () => void
  onSelectFocus: () => void
  onSaveTitle: (title: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(task.title)
  }, [task.title, editing])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commitEdit = () => {
    const next = draft.trim()
    if (!next) {
      setDraft(task.title)
      setEditing(false)
      return
    }
    if (next !== task.title) onSaveTitle(next)
    setEditing(false)
  }

  return (
    <li
      className={`uh-dash-open__task${isDone ? ' uh-dash-open__task--done' : ''}${completing ? ' uh-dash-open__task--completing' : ''}${editing ? ' uh-dash-open__task--editing' : ''}`}
    >
      <TaskCheckbox
        checked={isDone}
        label={task.title}
        onToggle={onToggle}
        onComplete={onComplete}
      />
      {editing ? (
        <input
          ref={inputRef}
          className="uh-dash-open__task-input"
          value={draft}
          aria-label="Edit task title"
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit()
            if (e.key === 'Escape') {
              setDraft(task.title)
              setEditing(false)
            }
          }}
          onBlur={commitEdit}
        />
      ) : (
        <span className="uh-dash-open__task-title">{task.title}</span>
      )}
      <div className="uh-dash-open__task-actions">
        {!isDone && (
          <TaskFocusButton active={focusActive} label={task.title} onSelect={onSelectFocus} />
        )}
        <button
          type="button"
          className="uh-dash-open__task-action"
          aria-label={`Edit "${task.title}"`}
          onClick={(e) => {
            e.stopPropagation()
            setEditing(true)
          }}
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          className="uh-dash-open__task-action uh-dash-open__task-action--danger"
          aria-label={`Delete "${task.title}"`}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <TrashIcon />
        </button>
      </div>
    </li>
  )
}

function TaskCheckbox({
  checked,
  onToggle,
  label,
  onComplete,
}: {
  checked: boolean
  onToggle: () => void
  label: string
  onComplete?: () => void
}) {
  const [completing, setCompleting] = useState(false)

  const handleToggle = () => {
    if (!checked) {
      setCompleting(true)
      onComplete?.()
      setTimeout(() => setCompleting(false), 500)
    }
    onToggle()
  }

  return (
    <button
      type="button"
      className={`uh-dash-open__checkbox${checked ? ' uh-dash-open__checkbox--checked' : ''}${completing ? ' uh-dash-open__checkbox--completing' : ''}`}
      role="checkbox"
      aria-checked={checked}
      aria-label={`Mark "${label}" as ${checked ? 'open' : 'done'}`}
      onClick={(e) => {
        e.stopPropagation()
        handleToggle()
      }}
    >
      {checked && <CheckIcon />}
    </button>
  )
}

type TaskCategoryDisplay = {
  id: string
  label: string
  count: number
  color: string
  tasks: Task[]
}

export function DefaultHomeDashboard({
  greeting,
  subtitle,
  todayPlan,
  timeOfDay,
  isBusy,
  isResetting,
  onContinueFocus,
  onPlanMyDay,
  focusAreas,
  userId,
}: DefaultHomeDashboardProps) {
  const { tasks, toggleTask, updateTask, removeTask } = useTaskStore(userId)
  const { taskId: currentFocusTaskId, selectTask, clearFocusIfTask } = useCurrentFocus()
  const { categories } = useCategoryStore()
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => new Set())
  const [completedExpanded, setCompletedExpanded] = useState(false)
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(() => new Set())
  const monkNodRef = useRef(false)
  const [monkNod, setMonkNod] = useState(false)

  const triggerMonkNod = useCallback(() => {
    if (monkNodRef.current) return
    monkNodRef.current = true
    setMonkNod(true)
    setTimeout(() => {
      setMonkNod(false)
      monkNodRef.current = false
    }, 500)
  }, [])

  const handleTaskComplete = useCallback((taskId: string) => {
    setCompletingTasks((prev) => new Set(prev).add(taskId))
    setCompletedExpanded(true)
    triggerMonkNod()
    setTimeout(() => {
      setCompletingTasks((prev) => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }, 700)
  }, [triggerMonkNod])

  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  const { openTaskCategories, completedTasks } = useMemo(() => {
    const visibleTasks = tasks.filter((t) => t.status !== 'archived')
    const openOnly = visibleTasks.filter((t) => t.status === 'open')
    const doneOnly = visibleTasks
      .filter((t) => t.status === 'done')
      .sort((a, b) => {
        const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0
        const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0
        return aTime - bTime
      })

    const bucketGroups = new Map<
      string,
      { id: string; label: string; color: string; order: number; tasks: Task[] }
    >()

    for (const task of openOnly) {
      const bucket =
        resolveTaskDisplayBucket(categories, task.category, focusAreas) ?? {
          id: 'other',
          label: 'Other',
          color: '#a78bfa',
          order: 999,
        }
      const existing = bucketGroups.get(bucket.id)
      if (existing) {
        existing.tasks.push(task)
      } else {
        bucketGroups.set(bucket.id, { ...bucket, tasks: [task] })
      }
    }

    const openTaskCategories: TaskCategoryDisplay[] = Array.from(bucketGroups.values())
      .map(({ id, label, color, tasks: bucketTasks }) => ({
        id,
        label,
        count: bucketTasks.length,
        color,
        tasks: bucketTasks,
      }))
      .sort((a, b) => {
        const orderA = bucketGroups.get(a.id)?.order ?? 99
        const orderB = bucketGroups.get(b.id)?.order ?? 99
        return orderA - orderB
      })

    return { openTaskCategories, completedTasks: doneOnly }
  }, [tasks, categories, focusAreas])

  const hasAnyTasks = openTaskCategories.length > 0 || completedTasks.length > 0

  const renderTaskRow = (task: Task) => {
    const isDone = task.status === 'done'
    return (
      <OpenTaskRow
        key={task.id}
        task={task}
        isDone={isDone}
        completing={completingTasks.has(task.id)}
        focusActive={currentFocusTaskId === task.id}
        onToggle={() => toggleTask(task.id)}
        onComplete={() => handleTaskComplete(task.id)}
        onSelectFocus={() => selectTask(task.id, task.title)}
        onSaveTitle={(title) => {
          updateTask(task.id, { title })
          if (currentFocusTaskId === task.id) {
            selectTask(task.id, title)
          }
        }}
        onDelete={() => {
          clearFocusIfTask(task.id)
          removeTask(task.id)
        }}
      />
    )
  }


  const planIsPrimary = timeOfDay === 'morning'
  const bothSecondary = timeOfDay === 'evening'

  return (
    <>
      <header className="uh-dash-header">
        <div className="uh-dash-header__toolbar">
          <div className="uh-dash-header__actions">
            <button type="button" className="uh-dash-icon-btn" aria-label="Notifications">
              <BellIcon />
            </button>
            <button type="button" className="uh-dash-icon-btn" aria-label="Clarity assistant">
              <SparkleIcon />
            </button>
          </div>
        </div>
        <div className="uh-dash-header__hero">
          <HomeCharacter size={210} nodding={monkNod} />
          <div className="uh-dash-header__text">
            <h1 className="uh-dash-header__title">{greeting}</h1>
            <p className="uh-dash-header__subtitle">{subtitle}</p>
          </div>
        </div>
        <MonkContextPrompt />
      </header>

      <CurrentFocusSection />

      <section className="uh-dash-open" aria-label="Tasks">
        <span className="uh-dash-section-label">Open Tasks</span>
        {openTaskCategories.length > 0 ? (
          <ul className="uh-dash-open__list">
            {openTaskCategories.map((cat) => {
              const isExpanded = expandedCategories.has(cat.id)
              return (
                <li key={cat.id} className="uh-dash-open__item">
                  <button
                    type="button"
                    className={`uh-dash-open__row${isExpanded ? ' uh-dash-open__row--expanded' : ''}`}
                    aria-expanded={isExpanded}
                    onClick={() => toggleCategory(cat.id)}
                  >
                    <span
                      className="uh-dash-open__icon"
                      style={{ '--uh-area-color': cat.color } as CSSProperties}
                      aria-hidden
                    >
                      <CategoryIcon categoryId={cat.id} size={16} />
                    </span>
                    <span className="uh-dash-open__label">{cat.label}</span>
                    <span className="uh-dash-open__count">{cat.count}</span>
                    <span className="uh-dash-open__chevron" aria-hidden>
                      <ChevronIcon />
                    </span>
                  </button>
                  <div
                    className={`uh-dash-open__expand${isExpanded ? ' uh-dash-open__expand--open' : ''}`}
                    aria-hidden={!isExpanded}
                  >
                    <div className="uh-dash-open__expand-inner">
                      <ul className="uh-dash-open__tasks">
                        {cat.tasks.map((task) => renderTaskRow(task))}
                      </ul>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : hasAnyTasks ? (
          <div className="uh-dash-open__empty uh-dash-open__empty--done">
            All open tasks complete
          </div>
        ) : (
          <div className="uh-dash-open__empty">
            Plan your day to get started
          </div>
        )}

        {completedTasks.length > 0 && (
          <div className="uh-dash-open__completed">
            <button
              type="button"
              className={`uh-dash-open__completed-row${completedExpanded ? ' uh-dash-open__completed-row--expanded' : ''}`}
              aria-expanded={completedExpanded}
              onClick={() => setCompletedExpanded((prev) => !prev)}
            >
              <span className="uh-dash-open__completed-icon" aria-hidden>
                <CheckIcon />
              </span>
              <span className="uh-dash-open__completed-label">Completed</span>
              <span className="uh-dash-open__count">{completedTasks.length}</span>
              <span className="uh-dash-open__chevron" aria-hidden>
                <ChevronIcon />
              </span>
            </button>
            <div
              className={`uh-dash-open__expand${completedExpanded ? ' uh-dash-open__expand--open' : ''}`}
              aria-hidden={!completedExpanded}
            >
              <div className="uh-dash-open__expand-inner">
                <ul className="uh-dash-open__tasks uh-dash-open__tasks--completed">
                  {completedTasks.map((task) => renderTaskRow(task))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </section>

      <EveningReflectionPrompt
        todayPlan={todayPlan}
        focusAreas={focusAreas}
        onPlanMyDay={onPlanMyDay}
        userId={userId}
      />

      <div className="uh-dash-actions">
        {planIsPrimary ? (
          <>
            <button
              type="button"
              className="uh-dash-action uh-dash-action--primary"
              disabled={isResetting}
              onClick={onPlanMyDay}
            >
              <span className="uh-dash-action__icon uh-dash-action__icon--sparkle" aria-hidden>
                <SparkleIcon />
              </span>
              <span className="uh-dash-action__body">
                <span className="uh-dash-action__title">Plan My Day</span>
                <span className="uh-dash-action__subtitle">
                  Add tasks, re-organize, or talk to Clarity.
                </span>
              </span>
            </button>
            <button
              type="button"
              className="uh-dash-action uh-dash-action--outline"
              disabled={isBusy}
              onClick={onContinueFocus}
            >
              <span className="uh-dash-action__icon" aria-hidden>
                <PlayIcon />
              </span>
              <span className="uh-dash-action__body">
                <span className="uh-dash-action__title">Continue Focus</span>
                <span className="uh-dash-action__subtitle">Enter focus mode and stay protected.</span>
              </span>
            </button>
          </>
        ) : bothSecondary ? (
          <>
            <button
              type="button"
              className="uh-dash-action uh-dash-action--outline"
              disabled={isBusy}
              onClick={onContinueFocus}
            >
              <span className="uh-dash-action__icon" aria-hidden>
                <PlayIcon />
              </span>
              <span className="uh-dash-action__body">
                <span className="uh-dash-action__title">Continue Focus</span>
                <span className="uh-dash-action__subtitle">Enter focus mode and stay protected.</span>
              </span>
            </button>
            <button
              type="button"
              className="uh-dash-action uh-dash-action--outline"
              disabled={isResetting}
              onClick={onPlanMyDay}
            >
              <span className="uh-dash-action__icon uh-dash-action__icon--sparkle" aria-hidden>
                <SparkleIcon />
              </span>
              <span className="uh-dash-action__body">
                <span className="uh-dash-action__title">Plan My Day</span>
                <span className="uh-dash-action__subtitle">
                  Add tasks, re-organize, or talk to Clarity.
                </span>
              </span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="uh-dash-action uh-dash-action--primary"
              disabled={isBusy}
              onClick={onContinueFocus}
            >
              <span className="uh-dash-action__icon" aria-hidden>
                <PlayIcon />
              </span>
              <span className="uh-dash-action__body">
                <span className="uh-dash-action__title">Continue Focus</span>
                <span className="uh-dash-action__subtitle">Enter focus mode and stay protected.</span>
              </span>
            </button>
            <button
              type="button"
              className="uh-dash-action uh-dash-action--outline"
              disabled={isResetting}
              onClick={onPlanMyDay}
            >
              <span className="uh-dash-action__icon uh-dash-action__icon--sparkle" aria-hidden>
                <SparkleIcon />
              </span>
              <span className="uh-dash-action__body">
                <span className="uh-dash-action__title">Plan My Day</span>
                <span className="uh-dash-action__subtitle">
                  Add tasks, re-organize, or talk to Clarity.
                </span>
              </span>
            </button>
          </>
        )}
      </div>

      <footer className="uh-dash-footer">
        <LockIcon />
        <span>Distractions are blocked in Focus Mode</span>
        <button type="button" className="uh-dash-footer__manage">
          Manage
        </button>
      </footer>
    </>
  )
}
