// Defaults from Dashboard → Settings → API (Project URL + anon or publishable key).
// Override in apps/desktop via VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY if needed.
export const SUPABASE_URL = 'https://yvftumjlqjddrduueneb.supabase.co'
export const SUPABASE_ANON_KEY = 'sb_publishable_Tu3pL-oMVf9Dl7gtipXc9w_LZM2HyoN'

// Default blocked sites (can be customized per user)
export const DEFAULT_BLOCKED_PATTERNS = [
  '*://twitter.com/*',
  '*://x.com/*',
  '*://facebook.com/*',
  '*://instagram.com/*',
  '*://reddit.com/*',
  '*://youtube.com/*',
  '*://tiktok.com/*',
]
