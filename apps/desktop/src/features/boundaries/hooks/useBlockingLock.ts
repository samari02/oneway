import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'

export type BlockingLockKind = 'none' | 'password' | 'friction'

export interface BlockingLockStatus {
  hasLock: boolean
  lockKind: BlockingLockKind
  unlockedUntilMs: number | null
  unlockDurationSecs: number
  canManageDestructive: boolean
}

export interface FrictionChallengeRound {
  rows: string[]
  targetDigit: number
}

export interface FrictionChallengeStart {
  challengeId: string
  rounds: FrictionChallengeRound[]
}

/** Tauri may expose serde fields as camelCase or snake_case depending on version / bridge. */
function normalizeBlockingLockStatus(raw: unknown): BlockingLockStatus | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const hasLock = Boolean(r.hasLock ?? r.has_lock)
  const lk = (r.lockKind ?? r.lock_kind ?? 'none') as string
  const lockKind: BlockingLockKind =
    lk === 'password' || lk === 'friction' || lk === 'none' ? lk : 'none'
  const num = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
    return null
  }
  const unlockedUntilMs: number | null = num(r.unlockedUntilMs ?? r.unlocked_until_ms)
  const unlockDurationSecs = num(r.unlockDurationSecs ?? r.unlock_duration_secs) ?? 300
  const rawCmd = r.canManageDestructive ?? r.can_manage_destructive
  const canManageDestructive =
    typeof rawCmd === 'boolean' ? rawCmd : !hasLock
  return {
    hasLock,
    lockKind,
    unlockedUntilMs,
    unlockDurationSecs,
    canManageDestructive,
  }
}

export function useBlockingLock() {
  const [status, setStatus] = useState<BlockingLockStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const raw = await invoke<unknown>('blocking_lock_get_status')
      setStatus(normalizeBlockingLockStatus(raw))
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

  const setFrictionLock = useCallback(async () => {
    await invoke('blocking_lock_set_friction')
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

  const clearLock = useCallback(async (password?: string) => {
    await invoke('blocking_lock_clear', { password: password ?? null })
    await refresh()
  }, [refresh])

  const frictionStart = useCallback(async () => {
    return await invoke<FrictionChallengeStart>('blocking_lock_friction_start')
  }, [])

  const frictionSubmit = useCallback(
    async (challengeId: string, answers: number[]) => {
      await invoke('blocking_lock_friction_submit', {
        challengeId,
        answers,
      })
      await refresh()
    },
    [refresh]
  )

  return {
    status,
    loading,
    refresh,
    setPassword,
    setFrictionLock,
    unlock,
    relock,
    clearLock,
    frictionStart,
    frictionSubmit,
  }
}
