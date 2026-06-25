import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { DailyPlan, FocusArea } from '@oneway/shared'
import { useTaskStore } from '../../hooks/useTaskStore'
import { formatLocalDateKey } from '../../api/dailyPlans'

const DISMISS_STORAGE_KEY = 'clarity-reflection-dismissed'

type EveningReflectionPromptProps = {
  todayPlan: DailyPlan | null
  focusAreas?: FocusArea[]
  onPlanMyDay: () => void
}

type AreaGroup = {
  id: string
  label: string
  color: string
}

type PendingItem = {
  id: string
  title: string
  source: 'goal' | 'task'
}

function getDismissedDate(): string | null {
  try {
    return localStorage.getItem(DISMISS_STORAGE_KEY)
  } catch {
    return null
  }
}

function dismissForToday(): void {
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, formatLocalDateKey())
  } catch {
    // ignore
  }
}

function isEveningHours(): boolean {
  return new Date().getHours() >= 18
}

function isCompletedToday(isoDate: string | undefined): boolean {
  if (!isoDate) return false
  const completed = new Date(isoDate)
  const now = new Date()
  return (
    completed.getFullYear() === now.getFullYear() &&
    completed.getMonth() === now.getMonth() &&
    completed.getDate() === now.getDate()
  )
}

function resolveArea(
  areaId: string | undefined,
  focusAreas: FocusArea[] | undefined,
): AreaGroup {
  if (areaId && focusAreas) {
    const area = focusAreas.find((a) => a.id === areaId)
    if (area) {
      return { id: area.id, label: area.label, color: area.color ?? '#a78bfa' }
    }
  }
  return { id: areaId ?? 'other', label: areaId ?? 'Other', color: '#a78bfa' }
}

function computeMonkObservation(
  completedByArea: Map<string, AreaGroup & { count: number }>,
): string {
  const entries = [...completedByArea.values()].filter((e) => e.count > 0)
  if (entries.length === 0) return 'A quiet day — rest counts too.'
  if (entries.length === 1) {
    return `You focused mostly on ${entries[0].label} today.`
  }
  if (entries.length >= 3) {
    return `Balanced day across ${entries.length} areas.`
  }
  const top = entries.sort((a, b) => b.count - a.count)[0]
  return `${top.label} led today with ${top.count} completed.`
}

export function EveningReflectionPrompt({
  todayPlan,
  focusAreas,
  onPlanMyDay,
}: EveningReflectionPromptProps) {
  const { tasks, updateTask } = useTaskStore()
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(() => getDismissedDate() === formatLocalDateKey())

  const { completedItems, pendingItems, completedByArea, monkObservation, shouldShow } = useMemo(() => {
    const planGoals = todayPlan?.goals ?? []
    const doneGoals = planGoals.filter((g) => g.status === 'done')
    const openGoals = planGoals.filter((g) => g.status !== 'done' && g.status !== 'skipped')

    const doneTasks = tasks.filter((t) => t.status === 'done' && isCompletedToday(t.completedAt))
    const openTasks = tasks.filter((t) => t.status === 'open')

    const totalTrackable = planGoals.length + tasks.filter((t) => t.status !== 'archived').length
    const completedCount = doneGoals.length + doneTasks.length
    const completionRatio = totalTrackable > 0 ? completedCount / totalTrackable : 0
    const mostGoalsChecked = totalTrackable >= 2 && completionRatio >= 0.6

    const completed: Array<{ id: string; title: string; area: AreaGroup }> = [
      ...doneGoals.map((g) => ({
        id: g.id,
        title: g.title,
        area: resolveArea(g.area, focusAreas),
      })),
      ...doneTasks.map((t) => ({
        id: t.id,
        title: t.title,
        area: resolveArea(t.category, focusAreas),
      })),
    ]

    const byArea = new Map<string, AreaGroup & { count: number }>()
    for (const item of completed) {
      const existing = byArea.get(item.area.id)
      if (existing) {
        existing.count += 1
      } else {
        byArea.set(item.area.id, { ...item.area, count: 1 })
      }
    }

    const pending: PendingItem[] = [
      ...openGoals.map((g) => ({ id: g.id, title: g.title, source: 'goal' as const })),
      ...openTasks.map((t) => ({ id: t.id, title: t.title, source: 'task' as const })),
    ]

    const show =
      !dismissed &&
      (isEveningHours() || mostGoalsChecked) &&
      (completed.length > 0 || pending.length > 0)

    return {
      completedItems: completed,
      pendingItems: pending,
      completedByArea: byArea,
      monkObservation: computeMonkObservation(byArea),
      shouldShow: show,
    }
  }, [todayPlan, focusAreas, tasks, dismissed])

  if (!shouldShow) return null

  const handleDismiss = () => {
    dismissForToday()
    setDismissed(true)
  }

  const handleLetGo = (item: PendingItem) => {
    if (item.source === 'task') {
      updateTask(item.id, { status: 'archived' })
    }
  }

  const handleCarryForward = (_item: PendingItem) => {
    // Open tasks and incomplete goals already carry forward by default.
  }

  const groupedCompleted = [...completedByArea.values()]

  return (
    <section className="uh-evening-prompt" aria-label="Evening reflection">
      <div className="uh-evening-prompt__header">
        <h2 className="uh-evening-prompt__title">Wrap up your day?</h2>
        <button
          type="button"
          className="uh-evening-prompt__dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss for today"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {!expanded ? (
        <button type="button" className="uh-evening-prompt__btn" onClick={() => setExpanded(true)}>
          Review what you accomplished
          <span className="uh-evening-prompt__btn-sub">
            {completedItems.length} done · {pendingItems.length} left
          </span>
        </button>
      ) : (
        <div className="uh-reflection">
          {groupedCompleted.length > 0 && (
            <div className="uh-reflection__section">
              <h3 className="uh-reflection__section-title">Completed today</h3>
              <ul className="uh-reflection__list">
                {[...completedByArea.values()].flatMap((area) =>
                  completedItems
                    .filter((item) => item.area.id === area.id)
                    .map((item) => (
                      <li key={item.id} className="uh-reflection__item">
                        <span className="uh-reflection__item-check" aria-hidden>✓</span>
                        <span
                          className="progress-view__goal-area"
                          style={{ color: area.color } as CSSProperties}
                        >
                          {area.label}
                        </span>
                        {item.title}
                      </li>
                    )),
                )}
              </ul>
            </div>
          )}

          {pendingItems.length > 0 && (
            <div className="uh-reflection__section">
              <h3 className="uh-reflection__section-title">Still open</h3>
              <ul className="uh-reflection__list">
                {pendingItems.map((item) => (
                  <li key={item.id} className="uh-reflection__item">
                    <span className="uh-reflection__item-pending" aria-hidden>○</span>
                    {item.title}
                    <span className="uh-reflection__item-actions">
                      <button
                        type="button"
                        className="uh-reflection__item-action"
                        onClick={() => handleCarryForward(item)}
                      >
                        Carry forward
                      </button>
                      <button
                        type="button"
                        className="uh-reflection__item-action"
                        onClick={() => handleLetGo(item)}
                      >
                        Let go
                      </button>
                      <button
                        type="button"
                        className="uh-reflection__item-action"
                        onClick={onPlanMyDay}
                      >
                        Reschedule
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="uh-reflection__monk">
            <span className="uh-reflection__monk-icon" aria-hidden>🧘</span>
            {monkObservation}
          </p>
        </div>
      )}
    </section>
  )
}
