/**
 * Recency buckets for Tab Manager hygiene
 */

export type RecencyLane = 'active' | 'today' | 'idle'

/** Active: touched within the last hour */
export const ACTIVE_MS = 60 * 60 * 1000
/** Today: touched within 6h but not active; older → idle */
export const TODAY_MS = 6 * 60 * 60 * 1000

/** Soft nudge when a single window exceeds this many tabs */
export const WINDOW_TAB_THRESHOLD = 40

/**
 * Lanes (product 2026-08-02):
 * - active: last 1h
 * - today: 1h–6h (Chrome group → collapsed)
 * - idle: 6h+ (Chrome group → collapsed / “fermé”)
 */
export function laneForLastAccessed(lastAccessed: number | undefined, now = Date.now()): RecencyLane {
  if (lastAccessed == null || !Number.isFinite(lastAccessed)) return 'idle'
  const age = now - lastAccessed
  if (age <= ACTIVE_MS) return 'active'
  if (age <= TODAY_MS) return 'today'
  return 'idle'
}

export function formatAge(lastAccessed: number | undefined, now = Date.now()): string {
  if (lastAccessed == null || !Number.isFinite(lastAccessed)) return 'unknown'
  const age = Math.max(0, now - lastAccessed)
  const mins = Math.floor(age / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function urlKey(url: string): string {
  return url.split('#')[0]
}
