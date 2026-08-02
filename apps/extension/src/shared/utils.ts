/**
 * Utility functions
 */

import { DOMAIN_REGEX } from './constants'

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  const match = url.match(DOMAIN_REGEX)
  return match ? match[1] : url
}

/**
 * Normalize URL for blocklist matching (host + path only — not query/hash).
 * Prevents false positives when blocked URLs appear in query params (e.g. block-screen.html?url=...).
 */
function urlForPatternMatch(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`
  } catch {
    return url.split(/[?#]/)[0]
  }
}

/**
 * Check if URL matches pattern (simple wildcard matching)
 */
export function matchesPattern(url: string, pattern: string): boolean {
  const target = urlForPatternMatch(url)
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')

  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(target)
}

/**
 * Get current timestamp
 */
export function now(): number {
  return Date.now()
}

/**
 * Format timestamp to readable date
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

/**
 * Log with timestamp (development helper)
 */
export function log(...args: any[]) {
  // Always log in development (chrome extension doesn't have process.env)
  console.log(`[Clarity ${new Date().toISOString()}]`, ...args)
}

/**
 * Check if hostname matches a listed adult domain (exact or subdomain).
 */
export function matchesAdultDomain(hostname: string, listedDomain: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, '')
  const listed = listedDomain.toLowerCase().replace(/^www\./, '')
  if (!listed) return false
  return host === listed || host.endsWith('.' + listed)
}

/**
 * True if URL host matches any domain in the adult system list.
 */
export function urlMatchesAdultDomainList(url: string, domains: string[]): boolean {
  if (!domains.length) return false
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    host = extractDomain(url)
  }
  return domains.some((d) => matchesAdultDomain(host, d))
}
