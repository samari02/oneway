import { useCallback, useMemo, useState } from 'react'
import type { ExtractedPlanItem } from '@/lib/morning-plan'

export type SuccessFrame = 'ship' | 'progress' | 'consistent' | 'finish' | 'show_up'

export type PlanItemKind = 'goal' | 'task' | 'routine'

export type PlanItem = {
  id: string
  text: string
  kind: PlanItemKind
  area?: string
}

export const DEFAULT_BLOCKER_OPTIONS = ['YouTube', 'Social Media', 'Reddit', 'News'] as const

export type MorningFlowState = {
  step: 1 | 2 | 3 | 4
  intention: string
  successFrame: SuccessFrame
  brainDump?: string
  items?: PlanItem[]
  priorityItemId?: string
  summaryFrame?: string
  blockers: string[]
  suggestedBlockers: string[]
  durationMinutes: number
  carriedForwardText?: string
}

export type DayPlan = MorningFlowState & {
  completedAt: string
}

export const DEFAULT_DURATION_MINUTES = 50

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
    blockers: state.blockers ?? [],
    suggestedBlockers: state.suggestedBlockers ?? [],
    durationMinutes: state.durationMinutes ?? DEFAULT_DURATION_MINUTES,
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
    area: item.area,
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
  initialCarriedForward?: string
}

export function useMorningFlow({
  initialIntention = '',
  initialCarriedForward,
}: UseMorningFlowOptions = {}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [intention, setIntention] = useState(initialIntention)
  const [successFrame, setSuccessFrame] = useState<SuccessFrame>(() =>
    inferSuccessFrame(initialIntention),
  )
  const [brainDump, setBrainDump] = useState('')
  const [items, setItems] = useState<PlanItem[]>([])
  const [priorityItemId, setPriorityItemId] = useState<string | undefined>()
  const [summaryFrame, setSummaryFrame] = useState<string | undefined>()
  const [blockers, setBlockers] = useState<string[]>([])
  const [suggestedBlockers, setSuggestedBlockers] = useState<string[]>([...DEFAULT_BLOCKER_OPTIONS])
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_DURATION_MINUTES)
  const [carriedForwardText, setCarriedForwardText] = useState<string | undefined>(initialCarriedForward)
  const [showCarriedCard, setShowCarriedCard] = useState(!initialCarriedForward)
  const [isExtracting, setIsExtracting] = useState(false)

  const goToStep = useCallback((next: 1 | 2 | 3 | 4, dir: 'forward' | 'back' = 'forward') => {
    setDirection(dir)
    setStep(next)
  }, [])

  const goForward = useCallback(() => {
    setDirection('forward')
    setStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4)
  }, [])

  const goBack = useCallback(() => {
    setDirection('back')
    setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4)
  }, [])

  const applyPlanExtraction = useCallback(
    (
      dump: string,
      extractedItems: PlanItem[],
      options?: {
        summaryFrame?: string
        priorityItemId?: string
        suggestedBlockers?: string[]
        durationMinutes?: number
      },
    ) => {
      setBrainDump(dump)
      setItems(extractedItems)
      setSummaryFrame(options?.summaryFrame)
      if (options?.priorityItemId) {
        setPriorityItemId(options.priorityItemId)
      }
      if (options?.suggestedBlockers?.length) {
        setSuggestedBlockers(options.suggestedBlockers)
        setBlockers(options.suggestedBlockers)
      }
      if (options?.durationMinutes) {
        setDurationMinutes(options.durationMinutes)
      }
    },
    [],
  )

  const updateItem = useCallback((id: string, text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, text: trimmed } : item)))
  }, [])

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
    setPriorityItemId((prev) => (prev === id ? undefined : prev))
  }, [])

  const addItem = useCallback((kind: PlanItemKind, text: string, area?: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const id = `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${kind}`
    setItems((prev) => [...prev, { id, text: trimmed, kind, area }])
  }, [])

  const confirmPlanStep = useCallback(
    (itemId?: string) => {
      const resolvedId = itemId ?? priorityItemId
      const nextIntention = deriveIntention(items, resolvedId, brainDump || intention)
      if (!nextIntention) return false

      setPriorityItemId(resolvedId)
      setIntention(nextIntention)
      setSuccessFrame(inferSuccessFrame(nextIntention))
      goToStep(3, 'forward')
      return true
    },
    [items, priorityItemId, brainDump, intention, goToStep],
  )

  const confirmBlockersStep = useCallback(() => {
    goToStep(4, 'forward')
  }, [goToStep])

  const toggleBlocker = useCallback((label: string) => {
    setBlockers((prev) =>
      prev.includes(label) ? prev.filter((b) => b !== label) : [...prev, label],
    )
  }, [])

  const carryForwardGoal = useCallback((text: string) => {
    setCarriedForwardText(text)
    setShowCarriedCard(false)
    setBrainDump((prev) => {
      if (prev.includes(text)) return prev
      return prev.trim() ? `${prev.trim()}, ${text}` : text
    })
  }, [])

  const dismissCarriedGoal = useCallback(() => {
    setShowCarriedCard(false)
  }, [])

  const removeCarriedForward = useCallback(() => {
    setCarriedForwardText(undefined)
  }, [])

  const completeFlow = useCallback(() => {
    const plan = saveDayPlan({
      step: 4,
      intention,
      successFrame,
      brainDump: brainDump || undefined,
      items: items.length > 0 ? items : undefined,
      priorityItemId,
      summaryFrame,
      blockers,
      suggestedBlockers,
      durationMinutes,
      carriedForwardText,
    })
    return plan
  }, [
    intention,
    successFrame,
    brainDump,
    items,
    priorityItemId,
    summaryFrame,
    blockers,
    suggestedBlockers,
    durationMinutes,
    carriedForwardText,
  ])

  const state = useMemo<MorningFlowState>(
    () => ({
      step,
      intention,
      successFrame,
      brainDump: brainDump || undefined,
      items: items.length > 0 ? items : undefined,
      priorityItemId,
      summaryFrame,
      blockers,
      suggestedBlockers,
      durationMinutes,
      carriedForwardText,
    }),
    [
      step,
      intention,
      successFrame,
      brainDump,
      items,
      priorityItemId,
      summaryFrame,
      blockers,
      suggestedBlockers,
      durationMinutes,
      carriedForwardText,
    ],
  )

  return {
    state,
    step,
    direction,
    intention,
    successFrame,
    brainDump,
    items,
    priorityItemId,
    summaryFrame,
    blockers,
    suggestedBlockers,
    durationMinutes,
    carriedForwardText,
    showCarriedCard,
    isExtracting,
    setBrainDump,
    setPriorityItemId,
    setIsExtracting,
    applyPlanExtraction,
    updateItem,
    deleteItem,
    addItem,
    confirmPlanStep,
    confirmBlockersStep,
    toggleBlocker,
    carryForwardGoal,
    dismissCarriedGoal,
    removeCarriedForward,
    goToStep,
    goForward,
    goBack,
    completeFlow,
  }
}
