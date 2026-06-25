import { useMemo, useState, type CSSProperties } from 'react'
import type { DailyPlan, FocusArea } from '@oneway/shared'
import { MOCK_CURRENT_FOCUS } from '../../mock-data'
import { useTaskStore, type Task } from '../../hooks/useTaskStore'
import { useCategoryStore } from '../../hooks/useCategoryStore'
import { CategoryIcon } from '../CategoryIcon'
import { HomeCharacter } from './HomeCharacter'

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

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

function FocusProgressRing({
  todayMinutes,
  goalMinutes,
}: {
  todayMinutes: number
  goalMinutes: number
}) {
  const size = 88
  const stroke = 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = goalMinutes > 0 ? Math.min(todayMinutes / goalMinutes, 1) : 0
  const offset = circumference * (1 - progress)

  return (
    <div className="uh-dash-focus__ring-wrap">
      <span className="uh-dash-focus__ring-label">Today&apos;s progress</span>
      <svg className="uh-dash-focus__ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="uh-dash-focus__ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="uh-dash-focus__ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="uh-dash-focus__ring-stats">
        <span className="uh-dash-focus__ring-value">{formatMinutes(todayMinutes)}</span>
        <span className="uh-dash-focus__ring-goal">Goal {formatMinutes(goalMinutes)}</span>
      </div>
    </div>
  )
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

function TargetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
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
}: {
  checked: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      type="button"
      className={`uh-dash-open__checkbox${checked ? ' uh-dash-open__checkbox--checked' : ''}`}
      role="checkbox"
      aria-checked={checked}
      aria-label={`Mark "${label}" as ${checked ? 'open' : 'done'}`}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
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
  const { categories } = useCategoryStore()
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => new Set())

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

  const focusData = useMemo(() => {
    const priorityGoal = todayPlan?.goals.find((g) => g.id === todayPlan.priority_goal_id)
      ?? todayPlan?.goals.find((g) => g.status !== 'done' && g.status !== 'skipped')
    const focusedSeconds = priorityGoal?.focused_seconds ?? 0
    const todayMinutes = focusedSeconds > 0
      ? Math.round(focusedSeconds / 60)
      : MOCK_CURRENT_FOCUS.todayMinutes
    const goalMinutes = todayPlan?.suggested_duration_minutes ?? MOCK_CURRENT_FOCUS.goalMinutes
    const totalTime = focusedSeconds > 0
      ? `${formatMinutes(Math.round(focusedSeconds / 60))} total`
      : MOCK_CURRENT_FOCUS.totalTime
    const fromYesterday = (priorityGoal?.carry_forward_count ?? 0) > 0

    return {
      title: priorityGoal?.title ?? MOCK_CURRENT_FOCUS.title,
      tag: MOCK_CURRENT_FOCUS.tag,
      startedLabel: fromYesterday ? 'Started yesterday' : MOCK_CURRENT_FOCUS.startedLabel,
      totalTime,
      todayMinutes,
      goalMinutes,
    }
  }, [todayPlan])

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
          <HomeCharacter size={210} />
          <div className="uh-dash-header__text">
            <h1 className="uh-dash-header__title">{greeting}</h1>
            <p className="uh-dash-header__subtitle">{subtitle}</p>
          </div>
        </div>
      </header>

      <section className="uh-dash-focus" aria-label="Current focus">
        <span className="uh-dash-section-label">Current Focus</span>
        <div className="uh-dash-focus__card">
          <div className="uh-dash-focus__main">
            <div className="uh-dash-focus__task">
              <span className="uh-dash-focus__task-icon" aria-hidden>
                <TargetIcon />
              </span>
              <p className="uh-dash-focus__task-title">{focusData.title}</p>
            </div>
            <div className="uh-dash-focus__meta">
              <span className="uh-dash-focus__tag">
                <span className="uh-dash-focus__tag-dot" aria-hidden />
                {focusData.tag}
              </span>
              <span className="uh-dash-focus__timing">
                {focusData.startedLabel} · {focusData.totalTime}
              </span>
            </div>
          </div>
          <FocusProgressRing
            todayMinutes={focusData.todayMinutes}
            goalMinutes={focusData.goalMinutes}
          />
        </div>
      </section>

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
                              className={`uh-dash-open__task${isDone ? ' uh-dash-open__task--done' : ''}`}
                            >
                              <TaskCheckbox
                                checked={isDone}
                                label={task.title}
                                onToggle={() => toggleTask(task.id)}
                              />
                              <span className="uh-dash-open__task-title">{task.title}</span>
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
