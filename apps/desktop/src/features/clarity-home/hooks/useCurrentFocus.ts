import { useCallback, useSyncExternalStore } from 'react'
import { playFocusAlarm, prepareFocusAlarmAudio } from '../lib/playFocusAlarm'

export const FOCUS_DURATION_PRESETS = [15, 25, 45, 60] as const

export type FocusDurationMinutes = (typeof FOCUS_DURATION_PRESETS)[number]

type CurrentFocusStatus = 'idle' | 'running' | 'finished'

type CurrentFocusState = {
  taskId: string | null
  taskTitle: string | null
  durationMinutes: FocusDurationMinutes
  endsAt: number | null
  status: CurrentFocusStatus
}

const STORAGE_KEY = 'clarity-current-focus'
const DEFAULT_DURATION: FocusDurationMinutes = 25

const listeners = new Set<() => void>()
let tickInterval: ReturnType<typeof setInterval> | null = null
let lastAlarmEndsAt: number | null = null

type CurrentFocusSnapshot = CurrentFocusState & {
  remainingSeconds: number
}

function emitChange() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function isValidDuration(value: unknown): value is FocusDurationMinutes {
  return typeof value === 'number' && (FOCUS_DURATION_PRESETS as readonly number[]).includes(value)
}

function isValidState(value: unknown): value is CurrentFocusState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<CurrentFocusState>
  const hasTask = state.taskId === null
    ? state.taskTitle === null
    : typeof state.taskId === 'string' && typeof state.taskTitle === 'string'
  return (
    hasTask &&
    isValidDuration(state.durationMinutes) &&
    (state.endsAt === null || typeof state.endsAt === 'number') &&
    (state.status === 'idle' || state.status === 'running' || state.status === 'finished')
  )
}

function normalizeState(raw: CurrentFocusState): CurrentFocusState {
  if (raw.status === 'finished' || raw.status === 'running') {
    if (!raw.taskId || !raw.taskTitle) {
      return createEmptyState()
    }
  }

  if (raw.status === 'idle' && raw.endsAt !== null) {
    return { ...raw, endsAt: null }
  }

  return raw
}

function createEmptyState(): CurrentFocusState {
  return {
    taskId: null,
    taskTitle: null,
    durationMinutes: DEFAULT_DURATION,
    endsAt: null,
    status: 'idle',
  }
}

function readStoredState(): CurrentFocusState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createEmptyState()
    const parsed: unknown = JSON.parse(raw)
    if (!isValidState(parsed)) return createEmptyState()
    return normalizeState(parsed)
  } catch {
    return createEmptyState()
  }
}

function readState(): CurrentFocusState {
  return finalizeIfExpired(readStoredState())
}

function getEffectiveState(state: CurrentFocusState): CurrentFocusState {
  if (state.status === 'running' && state.endsAt !== null && Date.now() >= state.endsAt) {
    return { ...state, status: 'finished', endsAt: null }
  }
  return state
}

function persistFinishedTimer(state: CurrentFocusState, endsAt: number): CurrentFocusState {
  const finished: CurrentFocusState = { ...state, status: 'finished', endsAt: null }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(finished))
  manageTick(finished)
  if (endsAt !== lastAlarmEndsAt) {
    lastAlarmEndsAt = endsAt
    playFocusAlarm()
  }
  emitChange()
  return finished
}

function finalizeIfExpired(state: CurrentFocusState): CurrentFocusState {
  if (state.status !== 'running' || state.endsAt === null || Date.now() < state.endsAt) {
    return state
  }
  return persistFinishedTimer(state, state.endsAt)
}

function writeState(state: CurrentFocusState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  manageTick(state)
  emitChange()
}

function getRemainingSeconds(state: CurrentFocusState): number {
  if (state.status === 'finished') return 0
  if (state.status === 'idle') return state.durationMinutes * 60
  if (!state.endsAt) return state.durationMinutes * 60
  if (Date.now() >= state.endsAt) return 0
  return Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000))
}

function getSnapshot(): CurrentFocusSnapshot {
  const state = getEffectiveState(readStoredState())
  return {
    ...state,
    remainingSeconds: getRemainingSeconds(state),
  }
}

function getServerSnapshot(): CurrentFocusSnapshot {
  return {
    ...createEmptyState(),
    remainingSeconds: DEFAULT_DURATION * 60,
  }
}

function manageTick(state: CurrentFocusState) {
  if (state.status === 'running' && state.endsAt !== null) {
    if (!tickInterval) {
      tickInterval = setInterval(() => {
        const stored = readStoredState()
        if (stored.status !== 'running' || stored.endsAt === null) {
          if (tickInterval) {
            clearInterval(tickInterval)
            tickInterval = null
          }
          return
        }

        if (Date.now() >= stored.endsAt) {
          persistFinishedTimer(stored, stored.endsAt)
          return
        }

        emitChange()
      }, 250)
    }
    return
  }

  if (tickInterval) {
    clearInterval(tickInterval)
    tickInterval = null
  }
}

const initialState = readStoredState()
if (
  initialState.status === 'running' &&
  initialState.endsAt !== null &&
  Date.now() >= initialState.endsAt
) {
  persistFinishedTimer(initialState, initialState.endsAt)
} else {
  manageTick(initialState)
}

export function formatFocusCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function useCurrentFocus() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const selectTask = useCallback((taskId: string, taskTitle: string) => {
    const current = readState()
    writeState({
      taskId,
      taskTitle,
      durationMinutes: current.durationMinutes,
      endsAt: null,
      status: 'idle',
    })
  }, [])

  const setDuration = useCallback((durationMinutes: FocusDurationMinutes) => {
    const current = readState()
    if (current.status === 'running') return
    writeState({ ...current, durationMinutes })
  }, [])

  const startTimer = useCallback((durationMinutes?: FocusDurationMinutes) => {
    const current = readState()
    if (!current.taskId || !current.taskTitle) return
    prepareFocusAlarmAudio()
    lastAlarmEndsAt = null
    const minutes = durationMinutes ?? current.durationMinutes
    writeState({
      ...current,
      durationMinutes: minutes,
      endsAt: Date.now() + minutes * 60 * 1000,
      status: 'running',
    })
  }, [])

  const stopTimer = useCallback(() => {
    const current = readState()
    if (!current.taskId || !current.taskTitle) {
      writeState(createEmptyState())
      return
    }
    writeState({
      ...current,
      endsAt: null,
      status: 'idle',
    })
  }, [])

  const clearFocus = useCallback(() => {
    writeState(createEmptyState())
  }, [])

  const clearFocusIfTask = useCallback((taskId: string) => {
    const current = readState()
    if (current.taskId === taskId) {
      writeState(createEmptyState())
    }
  }, [])

  const dismissFinished = useCallback(() => {
    const current = readState()
    if (current.status !== 'finished') return
    writeState({
      ...current,
      endsAt: null,
      status: 'idle',
    })
  }, [])

  return {
    taskId: snapshot.taskId,
    taskTitle: snapshot.taskTitle,
    durationMinutes: snapshot.durationMinutes,
    status: snapshot.status,
    remainingSeconds: snapshot.remainingSeconds,
    selectTask,
    setDuration,
    startTimer,
    stopTimer,
    clearFocus,
    clearFocusIfTask,
    dismissFinished,
  }
}
