/**
 * Search Query Filter
 * Detects and blocks searches for explicit content
 */

import { log } from '../shared/utils'

// Keywords that indicate explicit search intent
// Note: This list is intentionally broad to catch variations
const EXPLICIT_KEYWORDS = [
  // Direct terms (abbreviated/coded to avoid explicit content in source)
  'porn', 'porno', 'xxx', 'nsfw', 'hentai', 'rule34',
  'onlyfans', 'fansly', 'chaturbate', 'pornhub', 'xvideos', 'xnxx',
  'xhamster', 'redtube', 'youporn', 'brazzers', 'naughtyamerica',
  // French
  'pute', 'salope', 'beurette',
  // Common search patterns
  'nude', 'nudes', 'naked', 'sex video', 'sex tape',
  'leaked nudes', 'leaked video',
  // Cam sites
  'livejasmin', 'stripchat', 'bongacams', 'cam girl', 'camgirl',
]

// Regex patterns for more complex matching
const EXPLICIT_PATTERNS = [
  /\bfap\b/i,
  /\bjerk\s*off\b/i,
  /\bhot\s+(girl|guy|women|men|teen)s?\s+(nude|naked|video)/i,
  /\b(watch|free)\s+porn\b/i,
  /\badult\s+(video|content|site)/i,
]

/**
 * Check if a search query contains explicit content
 */
export function isExplicitSearch(query: string): { isExplicit: boolean; matchedTerm?: string } {
  const normalizedQuery = query.toLowerCase().trim()
  
  // Check keywords
  for (const keyword of EXPLICIT_KEYWORDS) {
    if (normalizedQuery.includes(keyword.toLowerCase())) {
      return { isExplicit: true, matchedTerm: keyword }
    }
  }
  
  // Check patterns
  for (const pattern of EXPLICIT_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      return { isExplicit: true, matchedTerm: 'pattern match' }
    }
  }
  
  return { isExplicit: false }
}

/**
 * Extract search query from URL
 * Supports all major search engines
 */
export function extractSearchQuery(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()
    
    // Google (all TLDs)
    if (hostname.includes('google.')) {
      return urlObj.searchParams.get('q')
    }
    
    // Bing
    if (hostname.includes('bing.com')) {
      return urlObj.searchParams.get('q')
    }
    
    // DuckDuckGo
    if (hostname.includes('duckduckgo.com')) {
      return urlObj.searchParams.get('q')
    }
    
    // Yahoo
    if (hostname.includes('yahoo.com') && urlObj.pathname.includes('search')) {
      return urlObj.searchParams.get('p')
    }
    
    // Ecosia
    if (hostname.includes('ecosia.org')) {
      return urlObj.searchParams.get('q')
    }
    
    // Qwant
    if (hostname.includes('qwant.com')) {
      return urlObj.searchParams.get('q')
    }
    
    // Brave Search
    if (hostname.includes('search.brave.com')) {
      return urlObj.searchParams.get('q')
    }
    
    // Yandex
    if (hostname.includes('yandex.com') || hostname.includes('yandex.ru')) {
      return urlObj.searchParams.get('text')
    }
    
    // StartPage
    if (hostname.includes('startpage.com')) {
      return urlObj.searchParams.get('query')
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * Check if URL is a search engine results page (NOT a redirect)
 */
export function isSearchEngine(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()
    const pathname = urlObj.pathname.toLowerCase()
    
    // Google redirect URLs are NOT search pages - they're click tracking
    // e.g., google.com/url?q=https://example.com
    if (hostname.includes('google.') && pathname === '/url') {
      return false
    }
    
    // Bing redirect URLs
    if (hostname.includes('bing.com') && pathname.startsWith('/ck/')) {
      return false
    }
    
    return (
      hostname.includes('google.') ||
      hostname.includes('bing.com') ||
      hostname.includes('duckduckgo.com') ||
      hostname.includes('yahoo.com') ||
      hostname.includes('ecosia.org') ||
      hostname.includes('qwant.com') ||
      hostname.includes('search.brave.com') ||
      hostname.includes('yandex.com') ||
      hostname.includes('yandex.ru') ||
      hostname.includes('startpage.com')
    )
  } catch {
    return false
  }
}

/**
 * Check if URL is a search engine redirect (click tracking URL)
 * Returns the destination URL if it is, null otherwise
 */
export function extractRedirectDestination(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()
    const pathname = urlObj.pathname.toLowerCase()
    
    // Google redirect: google.com/url?q=<destination>
    if (hostname.includes('google.') && pathname === '/url') {
      const destination = urlObj.searchParams.get('q') || urlObj.searchParams.get('url')
      if (destination) {
        return destination
      }
    }
    
    // Bing redirect: bing.com/ck/a?...&u=<encoded_destination>
    if (hostname.includes('bing.com') && pathname.startsWith('/ck/')) {
      const encoded = urlObj.searchParams.get('u')
      if (encoded) {
        // Bing uses a custom encoding, try to decode
        try {
          // Sometimes it's base64, sometimes URL-encoded
          const decoded = decodeURIComponent(encoded)
          if (decoded.startsWith('http')) {
            return decoded
          }
        } catch {
          // Ignore decode errors
        }
      }
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * Check if URL looks like an email tracking/redirect link
 * These often contain random characters that can trigger false positives
 */
export function isEmailTrackingUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    
    const trackingPatterns = [
      // Email service providers
      /\.mg\./,              // Mailgun (email.mg.*)
      /sendgrid\.net/,
      /mailchimp\.com/,
      /mailgun\.org/,
      /postmarkapp\.com/,
      /amazonses\.com/,
      /sparkpostmail\.com/,
      /mandrillapp\.com/,
      /constantcontact\.com/,
      /campaign-archive\.com/,  // Mailchimp archives
      /list-manage\.com/,       // Mailchimp
      /click\./,                // Generic click tracking
      /track\./,                // Generic tracking
      /email\./,                // Generic email subdomain
      /links\./,                // Link tracking
      /go\./,                   // Go redirects
    ]
    
    return trackingPatterns.some(pattern => pattern.test(hostname))
  } catch {
    return false
  }
}

/**
 * Get storage key for blocked searches count
 */
function getBlockedSearchesKey(): string {
  const today = new Date().toISOString().split('T')[0]
  return `blockedSearches_${today}`
}

/**
 * Increment blocked searches counter
 */
export async function incrementBlockedSearches(): Promise<void> {
  const key = getBlockedSearchesKey()
  const data = await chrome.storage.local.get(key)
  const count = (data[key] || 0) + 1
  await chrome.storage.local.set({ [key]: count })
  log('Blocked searches today:', count)
}

/**
 * Get blocked searches count for today
 */
export async function getBlockedSearchesToday(): Promise<number> {
  const key = getBlockedSearchesKey()
  const data = await chrome.storage.local.get(key)
  return data[key] || 0
}
