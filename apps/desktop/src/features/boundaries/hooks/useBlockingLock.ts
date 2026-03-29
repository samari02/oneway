import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'

export interface BlockingLockStatus {
  hasPassword: boolean
  unlockedUntilMs: number | null
  unlockDurationSecs: number
  canManageDestructive: boolean
}

export function useBlockingLock() {
  const [status, setStatus] = useState<BlockingLockStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const s = await invoke<BlockingLockStatus>('blocking_lock_get_status')
      setStatus(s)
    } catch (e) {
      console.error('[useBlockingLock]', e)
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!status?.unlockedUntilMs) return
    const t = window.setInterval(() => {
      void refresh()
    }, 1000)
    return () => window.clearInterval(t)
  }, [status?.unlockedUntilMs, refresh])

  const setPassword = useCallback(async (newPassword: string, currentPassword?: string) => {
    await invoke('blocking_lock_set_password', {
      newPassword,
      currentPassword: currentPassword ?? null,
    })
    await refresh()
  }, [refresh])

  const unlock = useCallback(async (password: string) => {
    await invoke('blocking_lock_verify_unlock', { password })
    await refresh()
  }, [refresh])

  const relock = useCallback(async () => {
    await invoke('blocking_lock_relock')
    await refresh()
  }, [refresh])

  return { status, loading, refresh, setPassword, unlock, relock }
}
