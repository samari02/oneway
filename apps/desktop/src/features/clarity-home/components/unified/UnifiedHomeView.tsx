import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DailyGoal, DailyPlan, DayState } from '@oneway/shared'
import {
  resetTodayPlan,
  skipEveningReflection,
  syncMorningFlowPlan,
  updateDailyPlan,
} from '../../api/dailyPlans'
import { useMorningFlow, type PlanItem } from '../../hooks/useMorningFlow'
import { useMorningMode } from '../../hooks/useMorningMode'
import { HomeBlockersInline } from './HomeBlockersInline'
import { HomeCharacter } from './HomeCharacter'
import { HomeEveningActions } from './HomeEveningActions'
import { HomeGoalsList, type HomeGoalItem } from './HomeGoalsList'
import { HomeMorningInput } from './HomeMorningInput'
import { DefaultHomeDashboard } from './DefaultHomeDashboard'
import './UnifiedHome.css'
import '../morning/MorningFlow.css'

type MorningStep = 'input' | 'plan' | 'protect' | 'confirm'

type UnifiedHomeViewProps = {
  firstName: string
  userId: string | undefined
  dayState: DayState
  todayPlan: DailyPlan | null
  onRefetch: () => Promise<void>
  initialIntention?: string
}

function getTimeGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function planItemsToHomeGoals(
  items: PlanItem[],
  priorityItemId?: string,
): HomeGoalItem[] {
  return items.map((item) => ({
    id: item.id,
    title: item.text,
    done: false,
    isPriority: item.id === priorityItemId,
  }))
}

function dailyGoalsToHomeGoals(plan: DailyPlan): HomeGoalItem[] {
  return plan.goals.map((goal) => ({
    id: goal.id,
    title: goal.title,
    done: goal.status === 'done',
    isPriority: goal.id === plan.priority_goal_id,
    fromYesterday: (goal.carry_forward_count ?? 0) > 0,
  }))
}

function getSubtitle(dayState: DayState): string {
  if (dayState === 'evening') return 'Time to reflect on today.'
  return "Let's continue making progress."
}
function getBubbleMessage(
  dayState: DayState,
  morningStep: MorningStep,
  incompleteCount: number,
): string | null {
  if (dayState === 'evening') {
    if (incompleteCount === 1) return 'One goal remains…'
    if (incompleteCount > 1) return `${incompleteCount} goals remain…`
    return 'How did today go?'
  }

  if (dayState === 'active' || dayState === 'focus') {
    return null
  }

  switch (morningStep) {
    case 'input':
      return "I'm here with you. What would you like to accomplish today?"
    case 'plan':
      return 'Which one should we protect first?'
    case 'protect':
      return null
    case 'confirm':
      return "I'll help you stay with it."
    default:
      return null
  }
}

export function UnifiedHomeView({
  firstName,
  userId,
  dayState,
  todayPlan,
  onRefetch,
  initialIntention = '',
}: UnifiedHomeViewProps) {
  const { setIsMorningMode } = useMorningMode()
  const [showMorningFlow, setShowMorningFlow] = useState(false)
  // Morning planning is session-only — never auto-enter from persisted sidebar toggle.
  const inMorningPlanning = showMorningFlow
  const isMorning = inMorningPlanning

  useEffect(() => {
    setIsMorningMode(false)
  }, [setIsMorningMode])

  const [morningStep, setMorningStep] = useState<MorningStep>('input')
  const [isBusy, setIsBusy] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [eveningResolved, setEveningResolved] = useState<Record<string, 'carry' | 'skip'>>({})

  const flow = useMorningFlow({ initialIntention })

  const greeting = `${getTimeGreeting()}, ${firstName}.`
  const subtitle = getSubtitle(dayState)

  const incompleteGoals = useMemo(() => {
    if (!todayPlan) return []
    return todayPlan.goals.filter(
      (g) => g.status !== 'done' && g.status !== 'skipped' && !eveningResolved[g.id],
    )
  }, [todayPlan, eveningResolved])

  const bubbleMessage = getBubbleMessage(dayState, morningStep, incompleteGoals.length)

  const showGoalsList =
    (isMorning && morningStep !== 'input' && flow.items.length > 0) ||
    (!isMorning && (todayPlan?.goals.length ?? 0) > 0)

  const goalsListItems: HomeGoalItem[] = useMemo(() => {
    if (isMorning && flow.items.length > 0) {
      return planItemsToHomeGoals(flow.items, flow.priorityItemId)
    }
    if (todayPlan?.goals.length) {
      return dailyGoalsToHomeGoals(todayPlan)
    }
    return []
  }, [isMorning, flow.items, flow.priorityItemId, todayPlan])

  const goalsMode = useMemo(() => {
    if (isMorning && morningStep === 'plan') return 'select-priority' as const
    if (!isMorning && dayState !== 'evening') return 'toggle' as const
    return 'readonly' as const
  }, [isMorning, morningStep, dayState])

  const persistGoals = useCallback(
    async (goals: DailyGoal[]) => {
      if (!todayPlan || !userId) return
      if (todayPlan.id.startsWith('local-')) {
        await syncMorningFlowPlan(userId, {
          ...flow.state,
          items: goals.map((g) => ({
            id: g.id,
            text: g.title,
            kind: 'goal' as const,
            area: g.area,
          })),
          priorityItemId: todayPlan.priority_goal_id ?? undefined,
        })
      } else {
        await updateDailyPlan(todayPlan.id, { goals })
      }
      await onRefetch()
    },
    [todayPlan, userId, flow.state, onRefetch],
  )

  const handleToggleGoal = useCallback(
    async (goalId: string) => {
      if (!todayPlan) return
      setIsBusy(true)
      try {
        const goals = todayPlan.goals.map((g) =>
          g.id === goalId
            ? { ...g, status: g.status === 'done' ? ('pending' as const) : ('done' as const) }
            : g,
        )
        await persistGoals(goals)
      } catch (err) {
        console.error('[UnifiedHomeView] Failed to toggle goal:', err)
      } finally {
        setIsBusy(false)
      }
    },
    [todayPlan, persistGoals],
  )

  const handleEveningCarryForward = useCallback(
    async (goalId: string) => {
      if (!todayPlan) return
      setIsBusy(true)
      try {
        const goals = todayPlan.goals.map((g) =>
          g.id === goalId
            ? {
                ...g,
                carry_forward_count: (g.carry_forward_count ?? 0) + 1,
              }
            : g,
        )
        await persistGoals(goals)
        setEveningResolved((prev) => ({ ...prev, [goalId]: 'carry' }))
      } catch (err) {
        console.error('[UnifiedHomeView] Failed to carry forward goal:', err)
      } finally {
        setIsBusy(false)
      }
    },
    [todayPlan, persistGoals],
  )

  const handleEveningLetGo = useCallback(
    async (goalId: string) => {
      if (!todayPlan) return
      setIsBusy(true)
      try {
        const goals = todayPlan.goals.map((g) =>
          g.id === goalId ? { ...g, status: 'skipped' as const } : g,
        )
        await persistGoals(goals)
        setEveningResolved((prev) => ({ ...prev, [goalId]: 'skip' }))
      } catch (err) {
        console.error('[UnifiedHomeView] Failed to skip goal:', err)
      } finally {
        setIsBusy(false)
      }
    },
    [todayPlan, persistGoals],
  )

  const handleResetPlan = async () => {
    if (!userId || isResetting) return
    setIsResetting(true)
    try {
      await resetTodayPlan(userId)
      setMorningStep('input')
      setEveningResolved({})
      await onRefetch()
    } catch (err) {
      console.error('[UnifiedHomeView] Failed to reset plan:', err)
    } finally {
      setIsResetting(false)
    }
  }

  const handleMorningComplete = async () => {
    if (!userId) return
    setIsBusy(true)
    try {
      const plan = flow.completeFlow()
      await syncMorningFlowPlan(userId, plan)
      await onRefetch()
      setShowMorningFlow(false)
      setIsMorningMode(false)
    } catch (err) {
      console.error('[UnifiedHomeView] Failed to complete morning flow:', err)
    } finally {
      setIsBusy(false)
    }
  }

  const handleEveningDone = async () => {
    if (!userId) return
    setIsBusy(true)
    try {
      await skipEveningReflection(userId)
      await onRefetch()
    } catch (err) {
      console.error('[UnifiedHomeView] Failed to finish evening:', err)
    } finally {
      setIsBusy(false)
    }
  }

  const renderContextualZone = () => {
    if (isMorning) {
      switch (morningStep) {
        case 'input':
          return (
            <HomeMorningInput
              carriedForwardText={flow.carriedForwardText}
              showCarriedCard={flow.showCarriedCard}
              onBrainDumpChange={flow.setBrainDump}
              onPlanExtracted={(dump, items, meta) => {
                flow.applyPlanExtraction(dump, items, meta)
              }}
              onCarryForward={flow.carryForwardGoal}
              onDismissCarried={flow.dismissCarriedGoal}
              onRemoveCarriedForward={flow.removeCarriedForward}
              onExtractingChange={flow.setIsExtracting}
              onContinue={() => setMorningStep('plan')}
            />
          )
        case 'plan':
          return (
            <p className="uh-plan-hint">
              {flow.priorityItemId ? 'Tap another to change your focus.' : 'Select a goal to continue.'}
            </p>
          )
        case 'protect':
          return (
            <HomeBlockersInline
              options={flow.suggestedBlockers}
              selected={flow.blockers}
              onToggle={flow.toggleBlocker}
            />
          )
        case 'confirm': {
          const priority = flow.priorityItemId
            ? flow.items.find((item) => item.id === flow.priorityItemId)
            : flow.items[0]
          const blockerSummary =
            flow.blockers.length > 0 ? flow.blockers.join(', ') : 'None selected'
          return (
            <div className="uh-confirm">
              <p className="uh-confirm__line">
                <span className="uh-confirm__goal">{priority?.text ?? 'Your focus'}</span>
                {' · '}
                {flow.durationMinutes} min · {blockerSummary}
              </p>
            </div>
          )
        }
        default:
          return null
      }
    }

    if (dayState === 'evening') {
      return (
        <HomeEveningActions
          incompleteGoals={incompleteGoals}
          onCarryForward={(id) => void handleEveningCarryForward(id)}
          onLetGo={(id) => void handleEveningLetGo(id)}
        />
      )
    }

    return null
  }

  const renderPrimaryCta = () => {
    if (isMorning) {
      switch (morningStep) {
        case 'input':
          return null
        case 'plan':
          return (
            <div className="uh-footer-actions">
              <button
                type="button"
                className="uh-btn uh-btn--primary uh-btn--wide"
                disabled={!flow.priorityItemId || isBusy}
                onClick={() => {
                  if (flow.confirmPlanStep(flow.priorityItemId)) {
                    setMorningStep('protect')
                  }
                }}
              >
                Continue
              </button>
            </div>
          )
        case 'protect':
          return (
            <div className="uh-footer-actions">
              <button
                type="button"
                className="uh-btn uh-btn--primary uh-btn--wide"
                disabled={isBusy}
                onClick={() => {
                  flow.confirmBlockersStep()
                  setMorningStep('confirm')
                }}
              >
                Continue
              </button>
            </div>
          )
        case 'confirm':
          return (
            <div className="uh-footer-actions">
              <button
                type="button"
                className="uh-btn uh-btn--primary uh-btn--wide"
                disabled={isBusy}
                onClick={() => void handleMorningComplete()}
              >
                ▷ Start Focus Session
              </button>
            </div>
          )
        default:
          return null
      }
    }

    if (dayState === 'evening') {
      return (
        <div className="uh-footer-actions">
          <button
            type="button"
            className="uh-btn uh-btn--primary uh-btn--wide"
            disabled={isBusy || !userId}
            onClick={() => void handleEveningDone()}
          >
            Done
          </button>
        </div>
      )
    }

    if (dayState === 'active' || dayState === 'focus') {
      return null
    }

    return null
  }

  const contextBusy = isBusy || flow.isExtracting

  const showMorningInput = isMorning && morningStep === 'input'
  const showOtherContext = !showMorningInput
  const isDefaultHome = dayState !== 'evening' && !inMorningPlanning

  if (isDefaultHome) {
    return (
      <div className="unified-home">
        <div className="unified-home__bg" aria-hidden />
        <div className="unified-home__shell unified-home__shell--dashboard">
          <DefaultHomeDashboard
            greeting={greeting}
            subtitle={subtitle}
            todayPlan={todayPlan}
            isBusy={isBusy}
            isResetting={isResetting}
            onContinueFocus={() => undefined}
            onPlanMyDay={() => {
              setShowMorningFlow(true)
              void handleResetPlan()
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="unified-home">
      <div className="unified-home__bg" aria-hidden />

      <div className="unified-home__shell">
        <header className="uh-header">
          <h1 className="uh-header__title">{greeting}</h1>
          <p className="uh-header__subtitle">{subtitle}</p>
          {userId && (
            <button
              type="button"
              className="uh-header__replan"
              onClick={() => void handleResetPlan()}
              disabled={isResetting}
            >
              {isResetting ? 'Resetting…' : 'Replan today'}
            </button>
          )}
        </header>

        <div className="uh-hero">
          <HomeCharacter size={140} />
          {bubbleMessage && (
            <div className="uh-bubble" aria-live="polite">
              <p className="uh-bubble__text">{bubbleMessage}</p>
            </div>
          )}
        </div>

        {showMorningInput && (
          <div className={`uh-context${contextBusy ? ' uh-context--busy' : ''}`}>
            {renderContextualZone()}
          </div>
        )}

        {showGoalsList && (
          <HomeGoalsList
            goals={goalsListItems}
            mode={goalsMode}
            selectedPriorityId={flow.priorityItemId}
            onToggle={(id) => void handleToggleGoal(id)}
            onSelectPriority={flow.setPriorityItemId}
          />
        )}

        {showOtherContext && (
          <div className={`uh-context${contextBusy ? ' uh-context--busy' : ''}`}>
            {renderContextualZone()}
          </div>
        )}

        {renderPrimaryCta()}

        <footer className="uh-quote">
          <p>&ldquo;The way is not in the sky. The way is in the heart.&rdquo; — Buddha</p>
        </footer>
      </div>
    </div>
  )
}
