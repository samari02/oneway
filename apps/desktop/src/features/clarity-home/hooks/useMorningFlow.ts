import { useCallback, useMemo, useState } from 'react'

export type SuccessFrame = 'ship' | 'progress' | 'consistent' | 'finish' | 'show_up'

export type DaySetup = {
  blockSites: boolean
  nudges: boolean
  focusSounds: boolean
  pomodoro: boolean
  minimal: boolean
}

export type MorningFlowState = {
  step: 1 | 2 | 3
  intention: string
  successFrame: SuccessFrame
  daySetup: DaySetup
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
    return saveDayPlan({
      step: 3,
      intention,
      successFrame,
      daySetup,
    })
  }, [intention, successFrame, daySetup])

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
    () => ({ step, intention, successFrame, daySetup }),
    [step, intention, successFrame, daySetup],
  )

  return {
    state,
    step,
    direction,
    intention,
    successFrame,
    daySetup,
    setIntention,
    setSuccessFrame,
    setDaySetup: updateDaySetup,
    goToStep,
    goForward,
    goBack,
    submitIntention,
    completeFlow,
  }
}
