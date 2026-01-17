import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'

export interface ExtensionStatus {
  connected: boolean
  lastSeen: number
  incognitoEnabled: boolean
  safeSearchEnforced: boolean
  searchFilterActive: boolean
  blockedSearchesToday: number
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
        incognito_enabled: boolean
        safe_search_enforced: boolean
        search_filter_active: boolean
        blocked_searches_today: number
      }>('get_extension_status')
      
      // Check if extension is still "connected" (seen in last 5 minutes)
      // We use a longer timeout because the native host process may have exited
      // but the extension is still active
      const isRecentlyConnected = result.connected && 
        (Date.now() - result.last_seen < 5 * 60 * 1000)
      
      setStatus({
        connected: isRecentlyConnected,
        lastSeen: result.last_seen,
        incognitoEnabled: result.incognito_enabled,
        safeSearchEnforced: result.safe_search_enforced,
        searchFilterActive: result.search_filter_active,
        blockedSearchesToday: result.blocked_searches_today
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
    
    // Poll every 10 seconds
    const interval = setInterval(fetch, 10000)
    return () => clearInterval(interval)
  }, [fetch])

  return { status, loading, error, refetch: fetch }
}
