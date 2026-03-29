import { useCallback, useEffect, useState } from 'react'
import {
  createCustomBlockingRule,
  createCustomBlockingRulesBatch,
  deleteCustomBlockingRule,
  getCustomBlockingRules,
  updateCustomBlockingRule,
  type CreateCustomBlockingRuleInput,
} from '../api/customBlockingRules'
import type { CustomBlockingRule } from '@oneway/shared'

interface UseCustomBlockingRulesResult {
  rules: CustomBlockingRule[]
  loading: boolean
  error: Error | null
  lastSyncedAt: Date | null
  refetch: (silent?: boolean) => Promise<void>
  createRule: (input: CreateCustomBlockingRuleInput) => Promise<CustomBlockingRule>
  createRulesBatch: (inputs: CreateCustomBlockingRuleInput[]) => Promise<CustomBlockingRule[]>
  updateRule: (id: string, updates: Parameters<typeof updateCustomBlockingRule>[1]) => Promise<void>
  removeRule: (id: string) => Promise<void>
  optimisticRemove: (id: string) => void
  optimisticToggle: (id: string, isActive: boolean) => void
}

export function useCustomBlockingRules(userId: string | undefined): UseCustomBlockingRulesResult {
  const [rules, setRules] = useState<CustomBlockingRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)

  const fetch = useCallback(
    async (silent = false) => {
      if (!userId) {
        setLoading(false)
        return
      }
      if (!silent) setLoading(true)
      setError(null)
      try {
        const data = await getCustomBlockingRules(userId)
        setRules(data)
        setLastSyncedAt(new Date())
      } catch (e) {
        setError(e instanceof Error ? e : new Error('Unknown error'))
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [userId]
  )

  useEffect(() => {
    fetch(false)
  }, [fetch])

  const optimisticRemove = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const optimisticToggle = useCallback((id: string, isActive: boolean) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: isActive } : r)))
  }, [])

  const createRule = useCallback(
    async (input: CreateCustomBlockingRuleInput) => {
      const row = await createCustomBlockingRule(input)
      setRules((prev) => [row, ...prev])
      setLastSyncedAt(new Date())
      return row
    },
    []
  )

  const createRulesBatch = useCallback(async (inputs: CreateCustomBlockingRuleInput[]) => {
    const rows = await createCustomBlockingRulesBatch(inputs)
    setRules((prev) => [...rows, ...prev])
    setLastSyncedAt(new Date())
    return rows
  }, [])

  const updateRule = useCallback(async (id: string, updates: Parameters<typeof updateCustomBlockingRule>[1]) => {
    const row = await updateCustomBlockingRule(id, updates)
    setRules((prev) => prev.map((r) => (r.id === id ? row : r)))
    setLastSyncedAt(new Date())
  }, [])

  const removeRule = useCallback(async (id: string) => {
    await deleteCustomBlockingRule(id)
    setRules((prev) => prev.filter((r) => r.id !== id))
    setLastSyncedAt(new Date())
  }, [])

  return {
    rules,
    loading,
    error,
    lastSyncedAt,
    refetch: fetch,
    createRule,
    createRulesBatch,
    updateRule,
    removeRule,
    optimisticRemove,
    optimisticToggle,
  }
}
