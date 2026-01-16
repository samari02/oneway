import { useState, useEffect, useCallback } from 'react'
import { getBoundaries, getBoundaryStats, type BoundaryStatsResult } from '../api/boundaries'
import type { Boundary } from '@oneway/shared'

interface UseBoundariesResult {
  boundaries: Boundary[]
  stats: BoundaryStatsResult[]
  loading: boolean
  error: Error | null
  refetch: (silent?: boolean) => Promise<void>
  optimisticRemove: (id: string) => void
  optimisticToggle: (id: string, isActive: boolean) => void
}

export function useBoundaries(userId: string | undefined): UseBoundariesResult {
  const [boundaries, setBoundaries] = useState<Boundary[]>([])
  const [stats, setStats] = useState<BoundaryStatsResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetch = useCallback(async (silent = false) => {
    if (!userId) {
      setLoading(false)
      return
    }

    if (!silent) {
      setLoading(true)
    }
    setError(null)

    try {
      const [boundariesData, statsData] = await Promise.all([
        getBoundaries(userId),
        getBoundaryStats(userId),
      ])
      setBoundaries(boundariesData)
      setStats(statsData)
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'))
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [userId])

  useEffect(() => {
    fetch(false)
  }, [fetch])

  const optimisticRemove = useCallback((id: string) => {
    setBoundaries(prev => prev.filter(b => b.id !== id))
  }, [])

  const optimisticToggle = useCallback((id: string, isActive: boolean) => {
    setBoundaries(prev => prev.map(b => 
      b.id === id ? { ...b, is_active: isActive } : b
    ))
  }, [])

  return { 
    boundaries, 
    stats, 
    loading, 
    error, 
    refetch: fetch,
    optimisticRemove,
    optimisticToggle,
  }
}
