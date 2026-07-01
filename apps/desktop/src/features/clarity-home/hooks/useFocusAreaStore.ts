import { useCallback, useEffect, useRef, useState } from 'react'
import type { FocusArea, FocusAreaInsert, FocusAreaUpdate } from '@oneway/shared'
import {
  getFocusAreas,
  createFocusArea,
  createFocusAreas,
  updateFocusArea,
  archiveFocusArea,
  reactivateFocusArea,
  deleteFocusArea,
} from '../api/focusAreas'

type FocusAreaStoreState = {
  areas: FocusArea[]
  loading: boolean
  error: string | null
}

const GENERAL_REPAIR_KEY = 'clarity-focus-general-repaired'

/**
 * Detect and repair the degenerate state left by migration 023: a single
 * synthetic "General" bucket with every real area parented under it.
 * Promotes all children to top-level buckets and removes the General row.
 */
async function repairGeneralBucket(areas: FocusArea[]): Promise<FocusArea[] | null> {
  const active = areas.filter((a) => a.status === 'active')
  const buckets = active.filter((a) => !a.parent_id)
  if (buckets.length !== 1) return null
  const general = buckets[0]
  if (general.label !== 'General' || general.source !== 'user') return null

  const subs = active.filter((a) => a.parent_id === general.id)
  if (subs.length === 0) return null

  if (localStorage.getItem(GENERAL_REPAIR_KEY) === general.id) return null

  try {
    await Promise.all(
      subs.map((s) => updateFocusArea(s.id, { parent_id: null })),
    )
    await deleteFocusArea(general.id)
    localStorage.setItem(GENERAL_REPAIR_KEY, general.id)

    return areas
      .filter((a) => a.id !== general.id)
      .map((a) => (a.parent_id === general.id ? { ...a, parent_id: null } : a))
  } catch (err) {
    console.error('[focus-areas] Failed to repair General bucket:', err)
    return null
  }
}

export function useFocusAreaStore(userId: string | undefined) {
  const [state, setState] = useState<FocusAreaStoreState>({
    areas: [],
    loading: false,
    error: null,
  })
  const fetchedRef = useRef(false)

  const activeAreas = state.areas.filter((a) => a.status === 'active')
  const archivedAreas = state.areas.filter((a) => a.status === 'archived')

  const getBuckets = useCallback(
    () =>
      activeAreas
        .filter((a) => !a.parent_id)
        .sort((a, b) => a.display_order - b.display_order),
    [activeAreas],
  )

  const getSubsForBucket = useCallback(
    (bucketId: string) =>
      activeAreas
        .filter((a) => a.parent_id === bucketId)
        .sort((a, b) => a.display_order - b.display_order),
    [activeAreas],
  )

  const getBucketForSub = useCallback(
    (subId: string): FocusArea | undefined => {
      const sub = activeAreas.find((a) => a.id === subId)
      if (!sub) return undefined
      if (!sub.parent_id) return sub
      return activeAreas.find((a) => a.id === sub.parent_id)
    },
    [activeAreas],
  )

  const getAllSubs = useCallback(
    () =>
      activeAreas
        .filter((a) => a.parent_id)
        .sort((a, b) => a.display_order - b.display_order),
    [activeAreas],
  )

  const fetchAreas = useCallback(async () => {
    if (!userId) return
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      let areas = await getFocusAreas(userId)
      const repaired = await repairGeneralBucket(areas)
      if (repaired) areas = repaired
      setState({ areas, loading: false, error: null })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load focus areas'
      setState((s) => ({ ...s, loading: false, error: msg }))
    }
  }, [userId])

  useEffect(() => {
    fetchedRef.current = false
  }, [userId])

  useEffect(() => {
    if (!userId || fetchedRef.current) return
    fetchedRef.current = true
    fetchAreas()
  }, [userId, fetchAreas])

  const addArea = useCallback(
    async (
      label: string,
      emoji?: string,
      color?: string,
      parentId?: string | null,
    ): Promise<FocusArea | null> => {
      if (!userId) return null
      try {
        const siblings = parentId
          ? state.areas.filter((a) => a.parent_id === parentId)
          : state.areas.filter((a) => !a.parent_id)
        const maxOrder = siblings.reduce((max, a) => Math.max(max, a.display_order), -1)
        const area = await createFocusArea({
          user_id: userId,
          label,
          emoji: emoji ?? null,
          color: color ?? null,
          parent_id: parentId ?? null,
          source: 'user',
          status: 'active',
          confidence: 1.0,
          mention_count: 0,
          display_order: maxOrder + 1,
        })
        setState((s) => ({ ...s, areas: [...s.areas, area] }))
        return area
      } catch (err) {
        console.error('[focus-areas] Failed to create:', err)
        return null
      }
    },
    [userId, state.areas],
  )

  const addBucket = useCallback(
    async (label: string, emoji?: string, color?: string) => addArea(label, emoji, color, null),
    [addArea],
  )

  const addSub = useCallback(
    async (bucketId: string, label: string, emoji?: string, color?: string) =>
      addArea(label, emoji, color, bucketId),
    [addArea],
  )

  const addProposedAreas = useCallback(
    async (proposals: Array<{ label: string; emoji?: string; color?: string }>): Promise<FocusArea[]> => {
      if (!userId) return []
      try {
        const maxOrder = state.areas.reduce((max, a) => Math.max(max, a.display_order), -1)
        const inserts: FocusAreaInsert[] = proposals.map((p, i) => ({
          user_id: userId,
          label: p.label,
          emoji: p.emoji ?? null,
          color: p.color ?? null,
          parent_id: null,
          source: 'ai_proposed' as const,
          status: 'active' as const,
          confidence: 0.8,
          mention_count: 0,
          display_order: maxOrder + 1 + i,
        }))
        const created = await createFocusAreas(inserts)
        setState((s) => ({ ...s, areas: [...s.areas, ...created] }))
        return created
      } catch (err) {
        console.error('[focus-areas] Failed to create proposed areas:', err)
        return []
      }
    },
    [userId, state.areas],
  )

  const editArea = useCallback(
    async (id: string, updates: FocusAreaUpdate): Promise<void> => {
      try {
        const updated = await updateFocusArea(id, updates)
        setState((s) => ({
          ...s,
          areas: s.areas.map((a) => (a.id === id ? updated : a)),
        }))
      } catch (err) {
        console.error('[focus-areas] Failed to update:', err)
      }
    },
    [],
  )

  const archive = useCallback(async (id: string): Promise<void> => {
    try {
      const updated = await archiveFocusArea(id)
      setState((s) => ({
        ...s,
        areas: s.areas.map((a) => (a.id === id ? updated : a)),
      }))
    } catch (err) {
      console.error('[focus-areas] Failed to archive:', err)
    }
  }, [])

  const reactivate = useCallback(async (id: string): Promise<void> => {
    try {
      const updated = await reactivateFocusArea(id)
      setState((s) => ({
        ...s,
        areas: s.areas.map((a) => (a.id === id ? updated : a)),
      }))
    } catch (err) {
      console.error('[focus-areas] Failed to reactivate:', err)
    }
  }, [])

  const remove = useCallback(async (id: string): Promise<void> => {
    try {
      await deleteFocusArea(id)
      setState((s) => ({
        ...s,
        areas: s.areas.filter((a) => a.id !== id),
      }))
    } catch (err) {
      console.error('[focus-areas] Failed to delete:', err)
    }
  }, [])

  const getAreaById = useCallback(
    (id: string): FocusArea | undefined => state.areas.find((a) => a.id === id),
    [state.areas],
  )

  const getAreaByLabel = useCallback(
    (label: string): FocusArea | undefined =>
      state.areas.find((a) => a.label.toLowerCase() === label.toLowerCase() && a.status === 'active'),
    [state.areas],
  )

  return {
    areas: state.areas,
    activeAreas,
    archivedAreas,
    loading: state.loading,
    error: state.error,
    fetchAreas,
    addArea,
    addBucket,
    addSub,
    addProposedAreas,
    editArea,
    archive,
    reactivate,
    remove,
    getAreaById,
    getAreaByLabel,
    getBuckets,
    getSubsForBucket,
    getBucketForSub,
    getAllSubs,
  }
}
