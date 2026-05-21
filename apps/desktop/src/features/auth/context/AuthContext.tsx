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

// Sync auth state with Tauri backend for Supabase sync
async function syncAuthToBackend(userId: string | null, accessToken: string | null) {
  try {
    if (userId && accessToken) {
      await invoke('set_supabase_auth', { userId, accessToken })
      console.log('[auth] Synced auth to backend for user:', userId)
    } else {
      await invoke('clear_supabase_auth')
      console.log('[auth] Cleared backend auth')
    }
  } catch (e) {
    console.error('[auth] Failed to sync auth to backend:', e)
  }
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
        session?.access_token ?? null
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
