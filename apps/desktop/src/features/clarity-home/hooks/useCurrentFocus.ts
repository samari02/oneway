import { useCallback, useSyncExternalStore } from 'react'
import { playFocusAlarm } from '../lib/playFocusAlarm'

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
let snapshotCache: CurrentFocusSnapshot | null = null

type CurrentFocusSnapshot = CurrentFocusState & {
  remainingSeconds: number
}

function emitChange() {
  snapshotCache = null
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
  if (raw.status === 'running' && raw.endsAt !== null) {
    if (Date.now() >= raw.endsAt) {
      return { ...raw, status: 'finished', endsAt: null }
    }
  }

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

function readState(): CurrentFocusState {
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

function writeState(state: CurrentFocusState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  manageTick(state)
  emitChange()
}

function getRemainingSeconds(state: CurrentFocusState): number {
  if (state.status === 'finished') return 0
  if (state.status === 'idle') return state.durationMinutes * 60
  if (!state.endsAt) return state.durationMinutes * 60
  return Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000))
}

function getSnapshot(): CurrentFocusSnapshot {
  if (!snapshotCache) {
    const state = readState()
    snapshotCache = {
      ...state,
      remainingSeconds: getRemainingSeconds(state),
    }
  }
  return snapshotCache
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
        const current = readState()
        if (current.status !== 'running' || current.endsAt === null) {
          if (tickInterval) {
            clearInterval(tickInterval)
            tickInterval = null
          }
          return
        }

        if (Date.now() >= current.endsAt) {
          writeState({ ...current, status: 'finished', endsAt: null })
          playFocusAlarm()
          return
        }

        emitChange()
      }, 1000)
    }
    return
  }

  if (tickInterval) {
    clearInterval(tickInterval)
    tickInterval = null
  }
}

manageTick(readState())

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
    dismissFinished,
  }
}
