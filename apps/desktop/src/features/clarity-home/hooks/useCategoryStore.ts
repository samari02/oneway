import { useCallback, useSyncExternalStore } from 'react'

export type Category = {
  id: string
  label: string
  emoji: string
  color: string
  order: number
}

const STORAGE_KEY = 'clarity-categories'

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'clarity', label: 'Clarity', emoji: '💻', color: '#7c3aed', order: 0 },
  { id: 'work', label: 'Work', emoji: '💼', color: '#f97316', order: 1 },
  { id: 'health', label: 'Health', emoji: '❤️', color: '#22c55e', order: 2 },
  { id: 'learning', label: 'Learning', emoji: '📘', color: '#3b82f6', order: 3 },
]

const listeners = new Set<() => void>()

function emitChange() {
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

function readCategories(): Category[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CATEGORIES
    const parsed = JSON.parse(raw) as Category[]
    return parsed.length > 0 ? parsed : DEFAULT_CATEGORIES
  } catch {
    return DEFAULT_CATEGORIES
  }
}

function writeCategories(cats: Category[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cats))
  emitChange()
}

let snapshotCache: Category[] | null = null

function getSnapshot(): Category[] {
  if (!snapshotCache) snapshotCache = readCategories()
  return snapshotCache
}

function getServerSnapshot(): Category[] {
  return DEFAULT_CATEGORIES
}

function invalidateCache() {
  snapshotCache = null
}

export function useCategoryStore() {
  const categories = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const addCategory = useCallback((label: string, emoji: string, color: string): Category => {
    const current = readCategories()
    const id = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const cat: Category = { id, label, emoji, color, order: current.length }
    invalidateCache()
    writeCategories([...current, cat])
    return cat
  }, [])

  const updateCategory = useCallback((id: string, updates: Partial<Pick<Category, 'label' | 'emoji' | 'color' | 'order'>>) => {
    const current = readCategories()
    invalidateCache()
    writeCategories(current.map((c) => (c.id === id ? { ...c, ...updates } : c)))
  }, [])

  const removeCategory = useCallback((id: string) => {
    const current = readCategories()
    invalidateCache()
    writeCategories(current.filter((c) => c.id !== id))
  }, [])

  const getCategoryById = useCallback(
    (id: string): Category | undefined => categories.find((c) => c.id === id),
    [categories],
  )

  return { categories, addCategory, updateCategory, removeCategory, getCategoryById, DEFAULT_CATEGORIES }
}
