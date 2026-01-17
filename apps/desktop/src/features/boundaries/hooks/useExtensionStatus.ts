import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'

// Alert levels for protection status
export type AlertLevel = 'ok' | 'warning' | 'critical'

export interface ExtensionStatus {
  connected: boolean
  lastSeen: number
  lastHeartbeat: number
  heartbeatCount: number
  incognitoEnabled: boolean
  safeSearchEnforced: boolean
  searchFilterActive: boolean
  blockedSearchesToday: number
  extensionVersion: string | null
  alertLevel: AlertLevel
}

interface UseExtensionStatusResult {
  status: ExtensionStatus | null
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function useExtensionStatus(): UseExtensionStatusResult {
  const [status, setStatus] = useState<ExtensionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetch = useCallback(async () => {
    try {
      const result = await invoke<{
        connected: boolean
        last_seen: number
        last_heartbeat: number
        heartbeat_count: number
        incognito_enabled: boolean
        safe_search_enforced: boolean
        search_filter_active: boolean
        blocked_searches_today: number
        extension_version: string | null
        alert_level: AlertLevel
      }>('get_extension_status')
      
      setStatus({
        connected: result.connected,
        lastSeen: result.last_seen,
        lastHeartbeat: result.last_heartbeat,
        heartbeatCount: result.heartbeat_count,
        incognitoEnabled: result.incognito_enabled,
        safeSearchEnforced: result.safe_search_enforced,
        searchFilterActive: result.search_filter_active,
        blockedSearchesToday: result.blocked_searches_today,
        extensionVersion: result.extension_version,
        alertLevel: result.alert_level
      })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to get extension status'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    
    // Poll every 5 seconds (faster to detect issues quicker)
    const interval = setInterval(fetch, 5000)
    return () => clearInterval(interval)
  }, [fetch])

  return { status, loading, error, refetch: fetch }
}
