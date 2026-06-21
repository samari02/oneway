import { useCallback, useMemo, useState } from 'react'
import type { ExtractedPlanItem } from '@/lib/morning-plan'
import { setMorningMode } from './useMorningMode'

export type SuccessFrame = 'ship' | 'progress' | 'consistent' | 'finish' | 'show_up'

export type DaySetup = {
  blockSites: boolean
  nudges: boolean
  focusSounds: boolean
  pomodoro: boolean
  minimal: boolean
}

export type PlanItemKind = 'goal' | 'task' | 'routine'

export type PlanItem = {
  id: string
  text: string
  kind: PlanItemKind
}

export type MorningFlowState = {
  step: 1 | 2 | 3
  intention: string
  successFrame: SuccessFrame
  daySetup: DaySetup
  brainDump?: string
  items?: PlanItem[]
  priorityItemId?: string
  summaryFrame?: string
}

export type DayPlan = MorningFlowState & {
  completedAt: string
}

export const DEFAULT_DAY_SETUP: DaySetup = {
  blockSites: true,
  nudges: true,
  focusSounds: true,
  pomodoro: false,
  minimal: false,
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getDayPlanStorageKey(date = new Date()): string {
  return `clarity-day-plan-${formatDateKey(date)}`
}

export function getTodayDayPlan(): DayPlan | null {
  try {
    const raw = localStorage.getItem(getDayPlanStorageKey())
    if (!raw) return null
    return JSON.parse(raw) as DayPlan
  } catch {
    return null
  }
}

export function saveDayPlan(state: MorningFlowState): DayPlan {
  const plan: DayPlan = {
    ...state,
    completedAt: new Date().toISOString(),
  }
  localStorage.setItem(getDayPlanStorageKey(), JSON.stringify(plan))
  return plan
}

export function inferSuccessFrame(intention: string): SuccessFrame {
  const text = intention.toLowerCase()

  if (/\b(rest|present|mindful|meditat|calm|peace|minimal)\b/.test(text)) {
    return 'show_up'
  }
  if (/\b(mvp|complete|finish|done|wrap up|ship today)\b/.test(text)) {
    return 'finish'
  }
  if (/\b(ship|launch|release|publish|deploy|build)\b/.test(text)) {
    return 'ship'
  }
  if (/\b(consistent|habit|daily|routine|momentum|show up)\b/.test(text)) {
    return 'consistent'
  }
  if (/\b(study|learn|progress|deep work|focus|startup)\b/.test(text)) {
    return 'progress'
  }

  return 'progress'
}

export function intentionMentionsMvp(intention: string): boolean {
  return /\bmvp\b/i.test(intention)
}

export function getSuccessFrameHint(frame: SuccessFrame, intention: string): string {
  switch (frame) {
    case 'ship':
      return 'Make something real and shareable'
    case 'progress':
      return 'Move the needle forward'
    case 'consistent':
      return 'Show up and keep the momentum'
    case 'finish':
      return intentionMentionsMvp(intention)
        ? 'Complete the entire MVP'
        : 'Wrap up what you started'
    case 'show_up':
      return 'Focus on presence, not outcome'
  }
}

export function toPlanItems(extracted: ExtractedPlanItem[]): PlanItem[] {
  return extracted.map((item, index) => ({
    id: `plan-${index}-${item.kind}`,
    text: item.text,
    kind: item.kind,
  }))
}

export function deriveIntention(
  items: PlanItem[] | undefined,
  priorityItemId?: string,
  fallback = '',
): string {
  if (priorityItemId && items?.length) {
    const priority = items.find((item) => item.id === priorityItemId)
    if (priority) return priority.text
  }
  const firstGoal = items?.find((item) => item.kind === 'goal')
  if (firstGoal) return firstGoal.text
  if (items?.[0]) return items[0].text
  return fallback.trim()
}

export function getPriorityItem(plan: MorningFlowState): PlanItem | undefined {
  if (!plan.items?.length) return undefined
  if (plan.priorityItemId) {
    return plan.items.find((item) => item.id === plan.priorityItemId)
  }
  return plan.items.find((item) => item.kind === 'goal') ?? plan.items[0]
}

export function getSecondaryItems(plan: MorningFlowState): PlanItem[] {
  if (!plan.items?.length) return []
  const priorityId = plan.priorityItemId ?? getPriorityItem(plan)?.id
  return plan.items.filter((item) => item.id !== priorityId)
}

type UseMorningFlowOptions = {
  initialIntention?: string
}

export function useMorningFlow({ initialIntention = '' }: UseMorningFlowOptions = {}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [intention, setIntention] = useState(initialIntention)
  const [successFrame, setSuccessFrame] = useState<SuccessFrame>(() =>
    inferSuccessFrame(initialIntention),
  )
  const [daySetup, setDaySetup] = useState<DaySetup>({ ...DEFAULT_DAY_SETUP })
  const [brainDump, setBrainDump] = useState('')
  const [items, setItems] = useState<PlanItem[]>([])
  const [priorityItemId, setPriorityItemId] = useState<string | undefined>()
  const [summaryFrame, setSummaryFrame] = useState<string | undefined>()

  const goToStep = useCallback((next: 1 | 2 | 3, dir: 'forward' | 'back' = 'forward') => {
    setDirection(dir)
    setStep(next)
  }, [])

  const goForward = useCallback(() => {
    setDirection('forward')
    setStep((s) => Math.min(3, s + 1) as 1 | 2 | 3)
  }, [])

  const goBack = useCallback(() => {
    setDirection('back')
    setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3)
  }, [])

  const applyPlanExtraction = useCallback(
    (
      dump: string,
      extractedItems: PlanItem[],
      options?: { summaryFrame?: string; priorityItemId?: string },
    ) => {
      setBrainDump(dump)
      setItems(extractedItems)
      setSummaryFrame(options?.summaryFrame)
      if (options?.priorityItemId) {
        setPriorityItemId(options.priorityItemId)
      }
    },
    [],
  )

  const confirmPriority = useCallback(
    (itemId?: string) => {
      const nextItems = items
      const resolvedId = itemId ?? priorityItemId
      const nextIntention = deriveIntention(nextItems, resolvedId, brainDump || intention)
      if (!nextIntention) return false

      setPriorityItemId(resolvedId)
      setIntention(nextIntention)
      setSuccessFrame(inferSuccessFrame(nextIntention))
      goToStep(2, 'forward')
      return true
    },
    [items, priorityItemId, brainDump, intention, goToStep],
  )

  const submitIntention = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) return false
      setIntention(trimmed)
      setSuccessFrame(inferSuccessFrame(trimmed))
      goToStep(2, 'forward')
      return true
    },
    [goToStep],
  )

  const completeFlow = useCallback(() => {
    const plan = saveDayPlan({
      step: 3,
      intention,
      successFrame,
      daySetup,
      brainDump: brainDump || undefined,
      items: items.length > 0 ? items : undefined,
      priorityItemId,
      summaryFrame,
    })
    setMorningMode(false)
    return plan
  }, [intention, successFrame, daySetup, brainDump, items, priorityItemId, summaryFrame])

  const updateDaySetup = useCallback((patch: Partial<DaySetup>) => {
    setDaySetup((prev) => {
      if (patch.minimal === true) {
        return {
          blockSites: false,
          nudges: false,
          focusSounds: false,
          pomodoro: false,
          minimal: true,
        }
      }

      const next = { ...prev, ...patch }

      if (patch.minimal === false) {
        next.minimal = false
      } else if (Object.keys(patch).some((key) => key !== 'minimal')) {
        next.minimal = false
      }

      return next
    })
  }, [])

  const state = useMemo<MorningFlowState>(
    () => ({
      step,
      intention,
      successFrame,
      daySetup,
      brainDump: brainDump || undefined,
      items: items.length > 0 ? items : undefined,
      priorityItemId,
      summaryFrame,
    }),
    [step, intention, successFrame, daySetup, brainDump, items, priorityItemId, summaryFrame],
  )

  return {
    state,
    step,
    direction,
    intention,
    successFrame,
    daySetup,
    brainDump,
    items,
    priorityItemId,
    summaryFrame,
    setIntention,
    setSuccessFrame,
    setDaySetup: updateDaySetup,
    setBrainDump,
    setPriorityItemId,
    applyPlanExtraction,
    confirmPriority,
    goToStep,
    goForward,
    goBack,
    submitIntention,
    completeFlow,
  }
}
