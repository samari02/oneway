import { useMemo, type CSSProperties } from 'react'
import type { DailyPlan } from '@oneway/shared'
import {
  MOCK_CURRENT_FOCUS,
  MOCK_OPEN_TASKS,
  type OpenTaskCategory,
} from '../../mock-data'
import { HomeCharacter } from './HomeCharacter'

type DefaultHomeDashboardProps = {
  greeting: string
  subtitle: string
  todayPlan: DailyPlan | null
  isBusy: boolean
  isResetting: boolean
  onContinueFocus: () => void
  onPlanMyDay: () => void
}

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

function deriveOpenTasks(plan: DailyPlan | null): OpenTaskCategory[] {
  if (!plan?.goals.length) return MOCK_OPEN_TASKS

  const areaStyles: Record<string, Pick<OpenTaskCategory, 'color' | 'icon'>> = {
    clarity: { color: '#7c3aed', icon: '✦' },
    work: { color: '#3b82f6', icon: '◈' },
    health: { color: '#22c55e', icon: '♥' },
    learning: { color: '#f59e0b', icon: '◉' },
  }

  const counts = new Map<string, number>()
  for (const goal of plan.goals) {
    if (goal.status === 'done' || goal.status === 'skipped') continue
    const area = (goal.area ?? 'clarity').toLowerCase()
    counts.set(area, (counts.get(area) ?? 0) + 1)
  }

  if (counts.size === 0) return MOCK_OPEN_TASKS

  return Array.from(counts.entries()).map(([area, count]) => {
    const style = areaStyles[area] ?? { color: '#a78bfa', icon: '•' }
    const label = area.charAt(0).toUpperCase() + area.slice(1)
    return { id: area, label, count, ...style }
  })
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

export function DefaultHomeDashboard({
  greeting,
  subtitle,
  todayPlan,
  isBusy,
  isResetting,
  onContinueFocus,
  onPlanMyDay,
}: DefaultHomeDashboardProps) {
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

  const openTasks = useMemo(() => deriveOpenTasks(todayPlan), [todayPlan])

  return (
    <>
      <header className="uh-dash-header">
        <div className="uh-dash-header__text">
          <h1 className="uh-dash-header__title">{greeting}</h1>
          <p className="uh-dash-header__subtitle">{subtitle}</p>
        </div>
        <div className="uh-dash-header__aside">
          <div className="uh-dash-header__actions">
            <button type="button" className="uh-dash-icon-btn" aria-label="Notifications">
              <BellIcon />
            </button>
            <button type="button" className="uh-dash-icon-btn" aria-label="Clarity assistant">
              <SparkleIcon />
            </button>
          </div>
          <HomeCharacter size={112} />
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
        <ul className="uh-dash-open__list">
          {openTasks.map((task) => (
            <li key={task.id}>
              <button type="button" className="uh-dash-open__row">
                <span
                  className="uh-dash-open__icon"
                  style={{ '--uh-area-color': task.color } as CSSProperties}
                  aria-hidden
                >
                  {task.icon}
                </span>
                <span className="uh-dash-open__label">{task.label}</span>
                <span className="uh-dash-open__count">{task.count}</span>
                <span className="uh-dash-open__chevron" aria-hidden>
                  <ChevronIcon />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="uh-dash-actions">
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
