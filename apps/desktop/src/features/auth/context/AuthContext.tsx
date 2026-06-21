import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { invoke } from '@tauri-apps/api/core'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const AUTH_SYNC_DEBOUNCE_MS = 300

let lastSyncedUserId: string | null = null
let lastSyncedAccessToken: string | null = null
let pendingAuthSync: ReturnType<typeof window.setTimeout> | null = null

async function doSyncAuthToBackend(
  userId: string | null,
  accessToken: string | null
) {
  if (userId === lastSyncedUserId && accessToken === lastSyncedAccessToken) {
    return
  }

  try {
    if (userId && accessToken) {
      await invoke('set_supabase_auth', { userId, accessToken })
      console.log('[auth] Synced auth to backend for user:', userId)
    } else {
      await invoke('clear_supabase_auth')
      console.log('[auth] Cleared backend auth')
    }
    lastSyncedUserId = userId
    lastSyncedAccessToken = accessToken
  } catch (e) {
    console.error('[auth] Failed to sync auth to backend:', e)
  }
}

// Sync auth state with Tauri backend for Supabase sync
async function syncAuthToBackend(
  userId: string | null,
  accessToken: string | null,
  options?: { immediate?: boolean }
) {
  const isLogout = !userId || !accessToken
  const immediate = options?.immediate ?? isLogout

  if (userId === lastSyncedUserId && accessToken === lastSyncedAccessToken) {
    return
  }

  if (immediate) {
    if (pendingAuthSync !== null) {
      window.clearTimeout(pendingAuthSync)
      pendingAuthSync = null
    }
    await doSyncAuthToBackend(userId, accessToken)
    return
  }

  if (pendingAuthSync !== null) {
    window.clearTimeout(pendingAuthSync)
  }

  await new Promise<void>((resolve) => {
    pendingAuthSync = window.setTimeout(() => {
      pendingAuthSync = null
      void doSyncAuthToBackend(userId, accessToken).then(resolve)
    }, AUTH_SYNC_DEBOUNCE_MS)
  })
}

const AUTH_INIT_TIMEOUT_MS = 12_000

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const applySession = (session: { user: User; access_token: string } | null) => {
      if (cancelled) return
      setUser(session?.user ?? null)
      setLoading(false)
      syncAuthToBackend(
        session?.user?.id ?? null,
        session?.access_token ?? null,
        { immediate: true }
      )
    }

    const timeoutId = window.setTimeout(() => {
      if (cancelled) return
      console.warn('[auth] getSession timed out — showing login')
      setLoading(false)
    }, AUTH_INIT_TIMEOUT_MS)

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        window.clearTimeout(timeoutId)
        applySession(session)
      })
      .catch((e) => {
        window.clearTimeout(timeoutId)
        console.error('[auth] getSession failed:', e)
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        
        // Sync to Tauri backend
        syncAuthToBackend(
          session?.user?.id ?? null,
          session?.access_token ?? null
        )
      }
    )

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      if (pendingAuthSync !== null) {
        window.clearTimeout(pendingAuthSync)
        pendingAuthSync = null
      }
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    await syncAuthToBackend(null, null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
