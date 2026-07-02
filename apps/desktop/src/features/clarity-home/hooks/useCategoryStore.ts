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

/** IDs from addCategory — used to detect generated sub ids (not for hiding top-level buckets). */
export const GENERATED_CATEGORY_ID_PATTERN = /^cat-\d+-[a-z0-9]+$/i

/** Default sub-bucket label for buckets with no explicit sub-categories. */
export const DEFAULT_SUB_LABEL = 'Not assigned'

export function findDefaultSubForBucket<T extends { id: string; label: string }>(
  subs: T[],
): T | undefined {
  return subs.find(
    (sub) => sub.label.localeCompare(DEFAULT_SUB_LABEL, undefined, { sensitivity: 'base' }) === 0,
  )
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'clarity', label: 'Clarity', emoji: '💻', color: '#7c3aed', order: 0, parentId: null },
  { id: 'work', label: 'Work', emoji: '💼', color: '#f97316', order: 1, parentId: null },
  { id: 'health', label: 'Health', emoji: '❤️', color: '#22c55e', order: 2, parentId: null },
  { id: 'learning', label: 'Learning', emoji: '📘', color: '#3b82f6', order: 3, parentId: null },
]

const DEFAULT_BUCKET_IDS = new Set(DEFAULT_CATEGORIES.map((d) => d.id))

function labelKey(label: string): string {
  return label.trim().toLocaleLowerCase()
}

function isGeneralCategory(c: Category): boolean {
  return (
    c.id === GENERAL_BUCKET_ID ||
    (c.parentId === null && labelKey(c.label) === 'general')
  )
}

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

/** Flat legacy categories → keep every former top-level row as a bucket. */
function migrateFlatCategories(cats: Category[]): Category[] {
  const hasHierarchy = cats.some((c) => c.parentId !== null)
  if (hasHierarchy) return cats
  return cats.map((c) => ({ ...c, parentId: null }))
}

/** Merge duplicate top-level buckets that share the same label (prefer default seed ids). */
function dedupeTopLevelBucketLabels(cats: Category[]): Category[] {
  const removeIds = new Set<string>()
  const reparentFrom = new Map<string, string>()

  const topLevel = cats.filter((c) => c.parentId === null)
  const byLabel = new Map<string, Category[]>()
  for (const bucket of topLevel) {
    const key = labelKey(bucket.label)
    const group = byLabel.get(key) ?? []
    group.push(bucket)
    byLabel.set(key, group)
  }

  for (const group of byLabel.values()) {
    if (group.length <= 1) continue
    const keeper =
      group.find((c) => DEFAULT_BUCKET_IDS.has(c.id)) ??
      [...group].sort((a, b) => a.order - b.order)[0]
    for (const dup of group) {
      if (dup.id === keeper.id) continue
      removeIds.add(dup.id)
      reparentFrom.set(dup.id, keeper.id)
    }
  }

  if (removeIds.size === 0) return cats

  return cats
    .filter((c) => !removeIds.has(c.id))
    .map((c) => {
      if (c.parentId && reparentFrom.has(c.parentId)) {
        return { ...c, parentId: reparentFrom.get(c.parentId)! }
      }
      return c
    })
}

/**
 * Restore buckets wrongly parented under General (mirrors focus-area repair).
 * Known default bucket ids always stay top-level.
 */
function restoreBucketHierarchy(cats: Category[]): Category[] {
  let result = [...cats]

  const general = result.find((c) => isGeneralCategory(c) && c.parentId === null)
  if (general) {
    const generalId = general.id
    const topLevel = result.filter((c) => c.parentId === null)
    const underGeneral = result.filter((c) => c.parentId === generalId)

    // Degenerate: General is the sole bucket and real areas live underneath it.
    if (underGeneral.length > 0 && topLevel.length === 1 && topLevel[0].id === generalId) {
      const notAssignedIds = new Set(
        underGeneral
          .filter((c) => labelKey(c.label) === labelKey(DEFAULT_SUB_LABEL))
          .map((c) => c.id),
      )

      result = result
        .filter((c) => c.id !== generalId)
        .map((c) => {
          if (c.parentId !== generalId) return c
          if (notAssignedIds.has(c.id)) return c
          return { ...c, parentId: null }
        })

      const fallbackBucketId = result.find((c) => c.parentId === null && !notAssignedIds.has(c.id))?.id
      if (fallbackBucketId && notAssignedIds.size > 0) {
        result = result.map((c) =>
          notAssignedIds.has(c.id) ? { ...c, parentId: fallbackBucketId } : c,
        )
      }
    }
  }

  result = result.map((c) =>
    DEFAULT_BUCKET_IDS.has(c.id) ? { ...c, parentId: null } : c,
  )

  const generalAfter = result.find((c) => isGeneralCategory(c) && c.parentId === null)
  if (!generalAfter) return dedupeTopLevelBucketLabels(result)

  const generalId = generalAfter.id
  const underGeneral = result.filter((c) => c.parentId === generalId)

  if (underGeneral.length === 0) {
    return dedupeTopLevelBucketLabels(result.filter((c) => c.id !== generalId))
  }

  // Partial collapse: promote default buckets (by id or label) still trapped under General.
  const topLevelIds = new Set(result.filter((c) => c.parentId === null).map((c) => c.id))
  const defaultLabelToId = new Map(DEFAULT_CATEGORIES.map((d) => [labelKey(d.label), d.id]))

  result = result.map((c) => {
    if (c.parentId !== generalId) return c
    if (DEFAULT_BUCKET_IDS.has(c.id)) return { ...c, parentId: null }

    const seedId = defaultLabelToId.get(labelKey(c.label))
    if (seedId && !topLevelIds.has(seedId)) {
      return { ...c, parentId: null }
    }
    return c
  })

  const stillUnderGeneral = result.filter((c) => c.parentId === generalId)
  if (stillUnderGeneral.length === 0) {
    result = result.filter((c) => c.id !== generalId)
  }

  return dedupeTopLevelBucketLabels(result)
}

function fallbackBucketId(categories: Category[]): string {
  const buckets = categories.filter((c) => c.parentId === null)
  return (
    buckets.find((b) => b.id === 'clarity')?.id ??
    buckets.find((b) => b.id !== GENERAL_BUCKET_ID)?.id ??
    buckets[0]?.id ??
    DEFAULT_CATEGORIES[0].id
  )
}

/** Reparent orphan subs and dedupe default "Not assigned" subs per bucket. */
function repairCategories(cats: Category[]): Category[] {
  const idSet = new Set(cats.map((c) => c.id))
  const fallbackId = fallbackBucketId(cats)

  let repaired = cats.map((c) => {
    if (c.parentId !== null && !idSet.has(c.parentId)) {
      return { ...c, parentId: fallbackId }
    }
    return c
  })

  const keepDefaultSubByBucket = new Map<string, string>()
  const removeIds = new Set<string>()
  for (const c of repaired) {
    if (c.parentId === null) continue
    if (c.label.localeCompare(DEFAULT_SUB_LABEL, undefined, { sensitivity: 'base' }) !== 0) continue
    const existing = keepDefaultSubByBucket.get(c.parentId)
    if (existing) removeIds.add(c.id)
    else keepDefaultSubByBucket.set(c.parentId, c.id)
  }

  if (removeIds.size > 0) {
    repaired = repaired.filter((c) => !removeIds.has(c.id))
  }

  return repaired
}

function readCategories(): Category[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CATEGORIES
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_CATEGORIES
    const valid = parsed.map(normalizeCategory).filter((c): c is Category => c !== null)
    if (valid.length === 0) return DEFAULT_CATEGORIES
    const migrated = migrateFlatCategories(valid)
    const restored = restoreBucketHierarchy(migrated)
    const repaired = repairCategories(restored)
    if (JSON.stringify(repaired) !== JSON.stringify(valid)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(repaired))
    }
    return repaired
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

/** Resolve a task's category id (sub or bucket) to its top-level bucket. */
export function resolveTaskBucketFromCategories(
  categories: Category[],
  taskCategoryId: string,
): Category | undefined {
  let current = categories.find((c) => c.id === taskCategoryId)
  if (!current) return undefined

  while (current.parentId !== null) {
    const parent = categories.find((c) => c.id === current!.parentId)
    if (!parent) break
    current = parent
  }

  if (!current || current.parentId !== null) return undefined
  return current
}

export type TaskDisplayBucket = {
  id: string
  label: string
  color: string
  order: number
}

type FocusAreaBucketRef = {
  id: string
  label: string
  color: string | null
  parent_id: string | null
  display_order: number
  status?: string
}

function toDisplayBucket(
  id: string,
  label: string,
  color: string,
  order: number,
): TaskDisplayBucket {
  return { id, label, color, order }
}

/** Resolve a task category to a user-facing bucket (focus areas and/or local categories). */
export function resolveTaskDisplayBucket(
  categories: Category[],
  taskCategoryId: string,
  focusAreas?: FocusAreaBucketRef[],
): TaskDisplayBucket | undefined {
  const categoryBuckets = getBucketsFromCategories(categories)
  const fallback = categoryBuckets[0]

  if (focusAreas?.length) {
    const area = focusAreas.find((a) => a.id === taskCategoryId && a.status !== 'archived')
    if (area) {
      if (!area.parent_id) {
        return toDisplayBucket(area.id, area.label, area.color ?? '#a78bfa', area.display_order)
      }
      const parent = focusAreas.find((a) => a.id === area.parent_id && a.status !== 'archived')
      if (parent) {
        return toDisplayBucket(parent.id, parent.label, parent.color ?? '#a78bfa', parent.display_order)
      }
    }
  }

  const bucket = resolveTaskBucketFromCategories(categories, taskCategoryId)
  if (bucket) {
    return toDisplayBucket(bucket.id, bucket.label, bucket.color, bucket.order)
  }

  const directSub = categories.find((c) => c.id === taskCategoryId)
  if (directSub?.parentId === null) {
    return toDisplayBucket(directSub.id, directSub.label, directSub.color, directSub.order)
  }

  const direct = categoryBuckets.find((b) => b.id === taskCategoryId)
  if (direct) {
    return toDisplayBucket(direct.id, direct.label, direct.color, direct.order)
  }

  if (fallback) {
    return toDisplayBucket(fallback.id, fallback.label, fallback.color, fallback.order)
  }

  return undefined
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
      let resolvedParentId = parentId
      if (resolvedParentId !== null) {
        const parent = current.find((c) => c.id === resolvedParentId)
        if (!parent || parent.parentId !== null) {
          resolvedParentId = fallbackBucketId(current)
        }
      }
      const siblings = resolvedParentId
        ? current.filter((c) => c.parentId === resolvedParentId)
        : current.filter((c) => c.parentId === null)
      const id = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const cat: Category = { id, label, emoji, color, order: siblings.length, parentId: resolvedParentId }
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
