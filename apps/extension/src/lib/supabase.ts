/**
 * Supabase Client for Extension
 * 
 * Used for syncing navigation history to the cloud.
 * Privacy: All data is user-owned and protected by RLS.
 */

import { createClient, SupabaseClient, User } from '@supabase/supabase-js'

// Supabase configuration
// TODO: Move to shared package when bundler supports it
const SUPABASE_URL = 'https://yvftumjlqjddrduueneb.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_Tu3pL-oMVf9Dl7gtipXc9w_LZM2HyoN'

// Create Supabase client
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Use chrome.storage for session persistence
    storage: {
      getItem: async (key: string) => {
        const result = await chrome.storage.local.get(key)
        return result[key] ?? null
      },
      setItem: async (key: string, value: string) => {
        await chrome.storage.local.set({ [key]: value })
      },
      removeItem: async (key: string) => {
        await chrome.storage.local.remove(key)
      }
    },
    autoRefreshToken: true,
    persistSession: true
  }
})

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser()
  return user !== null
}

/**
 * Sign in with email (magic link)
 */
export async function signInWithEmail(email: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: chrome.runtime.getURL('popup.html')
    }
  })
  return { error }
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
