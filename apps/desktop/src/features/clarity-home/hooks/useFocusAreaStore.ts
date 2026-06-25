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

export function useFocusAreaStore(userId: string | undefined) {
  const [state, setState] = useState<FocusAreaStoreState>({
    areas: [],
    loading: false,
    error: null,
  })
  const fetchedRef = useRef(false)

  const activeAreas = state.areas.filter((a) => a.status === 'active')
  const archivedAreas = state.areas.filter((a) => a.status === 'archived')

  const fetchAreas = useCallback(async () => {
    if (!userId) return
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const areas = await getFocusAreas(userId)
      setState({ areas, loading: false, error: null })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load focus areas'
      setState((s) => ({ ...s, loading: false, error: msg }))
    }
  }, [userId])

  useEffect(() => {
    if (!userId || fetchedRef.current) return
    fetchedRef.current = true
    fetchAreas()
  }, [userId, fetchAreas])

  // Reset when user changes
  useEffect(() => {
    fetchedRef.current = false
  }, [userId])

  const addArea = useCallback(
    async (label: string, emoji?: string, color?: string): Promise<FocusArea | null> => {
      if (!userId) return null
      try {
        const maxOrder = state.areas.reduce((max, a) => Math.max(max, a.display_order), -1)
        const area = await createFocusArea({
          user_id: userId,
          label,
          emoji: emoji ?? null,
          color: color ?? null,
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
    addProposedAreas,
    editArea,
    archive,
    reactivate,
    remove,
    getAreaById,
    getAreaByLabel,
  }
}
