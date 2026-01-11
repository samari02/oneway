/**
 * Supabase Client for Extension
 *
 * Used for syncing navigation history to the cloud.
 * Privacy: All data is user-owned and protected by RLS.
 */
import { createClient } from '@supabase/supabase-js';
// Supabase configuration
// TODO: Move to shared package when bundler supports it
const SUPABASE_URL = 'https://yvftumjlqjddrduueneb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Tu3pL-oMVf9Dl7gtipXc9w_LZM2HyoN';
// Create Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        // Use chrome.storage for session persistence
        storage: {
            getItem: async (key) => {
                const result = await chrome.storage.local.get(key);
                return result[key] ?? null;
            },
            setItem: async (key, value) => {
                await chrome.storage.local.set({ [key]: value });
            },
            removeItem: async (key) => {
                await chrome.storage.local.remove(key);
            }
        },
        autoRefreshToken: true,
        persistSession: true
    }
});
/**
 * Get current authenticated user
 */
export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}
/**
 * Check if user is authenticated
 */
export async function isAuthenticated() {
    const user = await getCurrentUser();
    return user !== null;
}
/**
 * Sign in with email (magic link)
 */
export async function signInWithEmail(email) {
    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            emailRedirectTo: chrome.runtime.getURL('popup.html')
        }
    });
    return { error };
}
/**
 * Sign out
 */
export async function signOut() {
    await supabase.auth.signOut();
}
