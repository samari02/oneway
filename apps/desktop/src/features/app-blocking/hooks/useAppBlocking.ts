import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'

export interface BlockedAppsConfig {
  blocked_bundle_ids: string[]
  blocking_enabled: boolean
  schedule: string
  time_start: string | null
  time_end: string | null
}

interface UseAppBlockingResult {
  config: BlockedAppsConfig
  loading: boolean
  error: Error | null
  isMonitoring: boolean
  setBlockedApps: (bundleIds: string[]) => Promise<void>
  setBlockingEnabled: (enabled: boolean) => Promise<void>
  startMonitoring: () => Promise<void>
  stopMonitoring: () => Promise<void>
  refetch: () => void
}

const defaultConfig: BlockedAppsConfig = {
  blocked_bundle_ids: [],
  blocking_enabled: false,
  schedule: 'always',
  time_start: null,
  time_end: null,
}

export function useAppBlocking(): UseAppBlockingResult {
  const [config, setConfig] = useState<BlockedAppsConfig>(defaultConfig)
  const [loading, setLoading] = useState(false) // Start false - don't block render
  const [error, setError] = useState<Error | null>(null)
  const [isMonitoring, setIsMonitoring] = useState(false)

  const fetchConfig = useCallback(async () => {
    try {
      const [blockedApps, monitoring] = await Promise.all([
        invoke<BlockedAppsConfig>('get_blocked_apps'),
        invoke<boolean>('is_app_monitoring_active'),
      ])
      setConfig(blockedApps)
      setIsMonitoring(monitoring)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to fetch config'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Small delay to not block initial render
    const timeout = setTimeout(fetchConfig, 50)
    return () => clearTimeout(timeout)
  }, [fetchConfig])

  const setBlockedApps = async (bundleIds: string[]) => {
    const newConfig = { ...config, blocked_bundle_ids: bundleIds }
    setConfig(newConfig)
    await invoke('set_blocked_apps', { config: newConfig })
  }

  const setBlockingEnabled = async (enabled: boolean) => {
    const newConfig = { ...config, blocking_enabled: enabled }
    setConfig(newConfig)
    await invoke('set_blocked_apps', { config: newConfig })
    
    // Start/stop monitoring based on enabled state
    if (enabled && !isMonitoring) {
      await startMonitoring()
    } else if (!enabled && isMonitoring) {
      await stopMonitoring()
    }
  }

  const startMonitoring = async () => {
    await invoke('start_app_monitoring')
    setIsMonitoring(true)
  }

  const stopMonitoring = async () => {
    await invoke('stop_app_monitoring')
    setIsMonitoring(false)
  }

  return {
    config,
    loading,
    error,
    isMonitoring,
    setBlockedApps,
    setBlockingEnabled,
    startMonitoring,
    stopMonitoring,
    refetch: fetchConfig,
  }
}
