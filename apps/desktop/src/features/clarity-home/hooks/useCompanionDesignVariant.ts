import { useSyncExternalStore } from 'react'

export type CompanionDesignVariant = 'orb' | 'monk'

const STORAGE_KEY = 'companion-design-variant'

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): CompanionDesignVariant {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'monk' ? 'monk' : 'orb'
}

function getServerSnapshot(): CompanionDesignVariant {
  return 'orb'
}

function emitChange() {
  listeners.forEach((listener) => listener())
}

export function setCompanionDesignVariant(variant: CompanionDesignVariant) {
  localStorage.setItem(STORAGE_KEY, variant)
  emitChange()
}

export function useCompanionDesignVariant() {
  const variant = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return { variant }
}
