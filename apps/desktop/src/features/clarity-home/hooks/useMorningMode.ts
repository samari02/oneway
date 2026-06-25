import { useCallback, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'clarity-morning-mode'

// Legacy sidebar toggle persisted this flag; home now defaults to the dashboard on launch.
if (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true') {
  localStorage.setItem(STORAGE_KEY, 'false')
}

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

function getServerSnapshot(): boolean {
  return false
}

function emitChange() {
  listeners.forEach((listener) => listener())
}

export function setMorningMode(enabled: boolean) {
  localStorage.setItem(STORAGE_KEY, String(enabled))
  emitChange()
}

export function useMorningMode() {
  const isMorningMode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setIsMorningMode = useCallback((enabled: boolean) => {
    setMorningMode(enabled)
  }, [])

  const toggleMorningMode = useCallback(() => {
    setMorningMode(!isMorningMode)
  }, [isMorningMode])

  return { isMorningMode, setIsMorningMode, toggleMorningMode }
}
