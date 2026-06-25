import { useMemo, useState, useRef, useCallback, type CSSProperties } from 'react'
import type { DailyPlan, FocusArea } from '@oneway/shared'
import { useTaskStore, type Task } from '../../hooks/useTaskStore'
import { useCategoryStore } from '../../hooks/useCategoryStore'
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
      setTimeout(() => setCompleting(false), 350)
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
}: DefaultHomeDashboardProps) {
  const { tasks, toggleTask } = useTaskStore()
  const { taskId: currentFocusTaskId, selectTask } = useCurrentFocus()
  const { categories } = useCategoryStore()
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => new Set())
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
    triggerMonkNod()
    setTimeout(() => {
      setCompletingTasks((prev) => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }, 600)
  }, [triggerMonkNod])

  const useFocusAreasMode = focusAreas && focusAreas.length > 0

  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  const openTasks = useMemo((): TaskCategoryDisplay[] => {
    const visibleTasks = tasks.filter((t) => t.status !== 'archived')
    const openOnly = visibleTasks.filter((t) => t.status === 'open')
    if (openOnly.length === 0) return []

    const grouped = new Map<string, Task[]>()
    for (const t of visibleTasks) {
      const list = grouped.get(t.category) ?? []
      list.push(t)
      grouped.set(t.category, list)
    }

    if (useFocusAreasMode) {
      const areaMap = new Map(focusAreas.map((a) => [a.id, a]))
      return Array.from(grouped.entries())
        .map(([areaId, areaTasks]) => {
          const area = areaMap.get(areaId)
          const openCount = areaTasks.filter((t) => t.status === 'open').length
          return {
            id: areaId,
            label: area?.label ?? areaId.charAt(0).toUpperCase() + areaId.slice(1),
            count: openCount,
            color: area?.color ?? '#a78bfa',
            tasks: areaTasks,
          }
        })
        .filter((cat) => cat.count > 0)
        .sort((a, b) => {
          const orderMap = new Map(focusAreas.map((fa) => [fa.id, fa.display_order]))
          return (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99)
        })
    }

    return Array.from(grouped.entries())
      .map(([catId, catTasks]) => {
        const cat = categories.find((c) => c.id === catId)
        const openCount = catTasks.filter((t) => t.status === 'open').length
        return {
          id: catId,
          label: cat?.label ?? catId.charAt(0).toUpperCase() + catId.slice(1),
          count: openCount,
          color: cat?.color ?? '#a78bfa',
          tasks: catTasks,
        }
      })
      .filter((cat) => cat.count > 0)
      .sort((a, b) => {
        const orderMap = new Map(categories.map((c, i) => [c.id, i]))
        return (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99)
      })
  }, [tasks, categories, useFocusAreasMode, focusAreas])


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

      <section className="uh-dash-open" aria-label="Open tasks">
        <span className="uh-dash-section-label">Open Tasks</span>
        {openTasks.length > 0 ? (
          <ul className="uh-dash-open__list">
            {openTasks.map((cat) => {
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
                        {cat.tasks.map((task) => {
                          const isDone = task.status === 'done'
                          return (
                            <li
                              key={task.id}
                              className={`uh-dash-open__task${isDone ? ' uh-dash-open__task--done' : ''}${completingTasks.has(task.id) ? ' uh-dash-open__task--completing' : ''}`}
                            >
                              <TaskCheckbox
                                checked={isDone}
                                label={task.title}
                                onToggle={() => toggleTask(task.id)}
                                onComplete={() => handleTaskComplete(task.id)}
                              />
                              <span className="uh-dash-open__task-title">{task.title}</span>
                              {!isDone && (
                                <TaskFocusButton
                                  active={currentFocusTaskId === task.id}
                                  label={task.title}
                                  onSelect={() => selectTask(task.id, task.title)}
                                />
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="uh-dash-open__empty">
            Plan your day to get started
          </div>
        )}
      </section>

      <EveningReflectionPrompt
        todayPlan={todayPlan}
        focusAreas={focusAreas}
        onPlanMyDay={onPlanMyDay}
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
