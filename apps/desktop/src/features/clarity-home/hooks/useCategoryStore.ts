import { useCallback, useSyncExternalStore } from 'react'

export type Category = {
  id: string
  label: string
  emoji: string
  color: string
  order: number
  parentId: string | null
}

const STORAGE_KEY = 'clarity-categories'
const GENERAL_BUCKET_ID = 'bucket-general'

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'clarity', label: 'Clarity', emoji: '💻', color: '#7c3aed', order: 0, parentId: null },
  { id: 'work', label: 'Work', emoji: '💼', color: '#f97316', order: 1, parentId: null },
  { id: 'health', label: 'Health', emoji: '❤️', color: '#22c55e', order: 2, parentId: null },
  { id: 'learning', label: 'Learning', emoji: '📘', color: '#3b82f6', order: 3, parentId: null },
]

const listeners = new Set<() => void>()

function emitChange() {
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

function normalizeCategory(raw: Partial<Category>): Category | null {
  if (
    typeof raw.id !== 'string' ||
    typeof raw.label !== 'string' ||
    typeof raw.emoji !== 'string' ||
    typeof raw.color !== 'string' ||
    typeof raw.order !== 'number'
  ) {
    return null
  }
  return {
    id: raw.id,
    label: raw.label,
    emoji: raw.emoji,
    color: raw.color,
    order: raw.order,
    parentId: raw.parentId ?? null,
  }
}

/** Flat legacy categories → preserve known seeds as buckets, reparent the rest under General. */
function migrateFlatCategories(cats: Category[]): Category[] {
  const hasHierarchy = cats.some((c) => c.parentId !== null)
  if (hasHierarchy) return cats

  const defaultIds = new Set(DEFAULT_CATEGORIES.map((d) => d.id))
  const seedBuckets = cats.filter((c) => defaultIds.has(c.id))
  const nonSeed = cats.filter((c) => !defaultIds.has(c.id))

  if (seedBuckets.length > 0) {
    const buckets = seedBuckets.map((c) => ({ ...c, parentId: null }))
    const fallbackBucket = buckets[0].id
    const subs = nonSeed.map((c) => ({ ...c, parentId: fallbackBucket }))
    return [...buckets, ...subs]
  }

  const general: Category = {
    id: GENERAL_BUCKET_ID,
    label: 'General',
    emoji: '📁',
    color: '#64748b',
    order: -1,
    parentId: null,
  }

  const migrated = cats.map((c) => ({ ...c, parentId: GENERAL_BUCKET_ID as string }))
  return [general, ...migrated]
}

function readCategories(): Category[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CATEGORIES
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_CATEGORIES
    const valid = parsed.map(normalizeCategory).filter((c): c is Category => c !== null)
    if (valid.length === 0) return DEFAULT_CATEGORIES
    return migrateFlatCategories(valid)
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

export function getBucketsFromCategories(categories: Category[]): Category[] {
  return categories.filter((c) => c.parentId === null).sort((a, b) => a.order - b.order)
}

export function getSubsForBucketFromCategories(categories: Category[], bucketId: string): Category[] {
  return categories.filter((c) => c.parentId === bucketId).sort((a, b) => a.order - b.order)
}

export function getBucketForSubFromCategories(categories: Category[], subId: string): Category | undefined {
  const sub = categories.find((c) => c.id === subId)
  if (!sub?.parentId) return sub?.parentId === null ? sub : undefined
  return categories.find((c) => c.id === sub.parentId)
}

export function getAllSubsFromCategories(categories: Category[]): Category[] {
  return categories.filter((c) => c.parentId !== null).sort((a, b) => a.order - b.order)
}

export function useCategoryStore() {
  const categories = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const getBuckets = useCallback(
    () => getBucketsFromCategories(categories),
    [categories],
  )

  const getSubsForBucket = useCallback(
    (bucketId: string) => getSubsForBucketFromCategories(categories, bucketId),
    [categories],
  )

  const getBucketForSub = useCallback(
    (subId: string) => getBucketForSubFromCategories(categories, subId),
    [categories],
  )

  const getAllSubs = useCallback(
    () => getAllSubsFromCategories(categories),
    [categories],
  )

  const addCategory = useCallback(
    (label: string, emoji: string, color: string, parentId: string | null = null): Category => {
      const current = readCategories()
      const siblings = parentId
        ? current.filter((c) => c.parentId === parentId)
        : current.filter((c) => c.parentId === null)
      const id = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const cat: Category = { id, label, emoji, color, order: siblings.length, parentId }
      invalidateCache()
      writeCategories([...current, cat])
      return cat
    },
    [],
  )

  const addBucket = useCallback(
    (label: string, emoji: string, color: string) => addCategory(label, emoji, color, null),
    [addCategory],
  )

  const addSub = useCallback(
    (bucketId: string, label: string, emoji: string, color: string) =>
      addCategory(label, emoji, color, bucketId),
    [addCategory],
  )

  const updateCategory = useCallback(
    (id: string, updates: Partial<Pick<Category, 'label' | 'emoji' | 'color' | 'order' | 'parentId'>>) => {
      const current = readCategories()
      invalidateCache()
      writeCategories(current.map((c) => (c.id === id ? { ...c, ...updates } : c)))
    },
    [],
  )

  const removeCategory = useCallback((id: string) => {
    const current = readCategories()
    invalidateCache()
    writeCategories(current.filter((c) => c.id !== id && c.parentId !== id))
  }, [])

  const getCategoryById = useCallback(
    (id: string): Category | undefined => categories.find((c) => c.id === id),
    [categories],
  )

  return {
    categories,
    addCategory,
    addBucket,
    addSub,
    updateCategory,
    removeCategory,
    getCategoryById,
    getBuckets,
    getSubsForBucket,
    getBucketForSub,
    getAllSubs,
    DEFAULT_CATEGORIES,
  }
}
