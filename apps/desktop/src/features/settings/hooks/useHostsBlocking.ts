import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'

export interface HostsBlockingStatus {
  enabled: boolean
  hostsSectionPresent: boolean
  domainCount: number
  appliedDomainCount: number
  lastAppliedAt: string | null
  supported: boolean
  note: string
  lastBackupPath: string | null
}

interface UseHostsBlockingResult {
  status: HostsBlockingStatus | null
  loading: boolean
  busy: boolean
  error: string | null
  enable: () => Promise<void>
  disable: () => Promise<void>
  refresh: () => Promise<void>
  refetch: () => void
}

const invokeErrorMessage = (e: unknown): string => {
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message
  return 'System blocking request failed'
}

export function useHostsBlocking(): UseHostsBlockingResult {
  const [status, setStatus] = useState<HostsBlockingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const next = await invoke<HostsBlockingStatus>('get_hosts_blocking_status')
      setStatus(next)
      setError(null)
    } catch (e) {
      setError(invokeErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(fetchStatus, 50)
    return () => clearTimeout(timeout)
  }, [fetchStatus])

  const run = async (fn: () => Promise<HostsBlockingStatus>) => {
    setBusy(true)
    setError(null)
    try {
      const next = await fn()
      setStatus(next)
    } catch (e) {
      setError(invokeErrorMessage(e))
      await fetchStatus()
    } finally {
      setBusy(false)
    }
  }

  return {
    status,
    loading,
    busy,
    error,
    enable: () => run(() => invoke('enable_hosts_adult_blocking')),
    disable: () => run(() => invoke('disable_hosts_adult_blocking')),
    refresh: () => run(() => invoke('refresh_hosts_adult_blocking')),
    refetch: fetchStatus,
  }
}
