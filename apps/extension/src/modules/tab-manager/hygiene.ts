/**
 * Shared hygiene helpers (manager page + service worker badge)
 */

import { laneForLastAccessed, TODAY_MS, urlKey, WINDOW_TAB_THRESHOLD } from './buckets'
import { getModuleEnabled } from './storage'

function isManagerUrl(url: string | undefined): boolean {
  return Boolean(url?.includes('tab-manager.html'))
}

export function countDuplicateClosures(
  tabs: Array<{ url?: string; pinned?: boolean }>
): number {
  const seen = new Set<string>()
  let count = 0
  for (const tab of tabs) {
    if (!tab.url || tab.pinned) continue
    const key = urlKey(tab.url)
    if (seen.has(key)) count += 1
    else seen.add(key)
  }
  return count
}

export function pickDuplicateTabIds(
  tabs: Array<{ id?: number; url?: string; pinned?: boolean; lastAccessed?: number }>
): number[] {
  const best = new Map<string, { id: number; lastAccessed: number }>()
  const extras: number[] = []

  for (const tab of tabs) {
    if (typeof tab.id !== 'number' || !tab.url || tab.pinned) continue
    const key = urlKey(tab.url)
    const accessed = tab.lastAccessed ?? 0
    const existing = best.get(key)
    if (!existing) {
      best.set(key, { id: tab.id, lastAccessed: accessed })
      continue
    }
    // Keep the more recently accessed; close the other
    if (accessed >= existing.lastAccessed) {
      extras.push(existing.id)
      best.set(key, { id: tab.id, lastAccessed: accessed })
    } else {
      extras.push(tab.id)
    }
  }

  return extras
}

export async function collectHygieneSnapshot(windowId?: number): Promise<{
  enabled: boolean
  openCount: number
  idleCount: number
  duplicateCount: number
  overThreshold: boolean
}> {
  const enabled = await getModuleEnabled()
  if (!enabled) {
    return { enabled: false, openCount: 0, idleCount: 0, duplicateCount: 0, overThreshold: false }
  }

  const query = windowId != null ? { windowId } : {}
  const tabs = await chrome.tabs.query(query)
  const usable = tabs.filter((t) => !isManagerUrl(t.url))
  const now = Date.now()
  const idleCount = usable.filter((t) => {
    if (t.pinned) return false
    return laneForLastAccessed(t.lastAccessed, now) === 'idle'
  }).length
  const duplicateCount = countDuplicateClosures(usable)
  const openCount = usable.length
  const overThreshold = openCount >= WINDOW_TAB_THRESHOLD

  return { enabled, openCount, idleCount, duplicateCount, overThreshold }
}

export async function refreshTabManagerBadge(windowId?: number): Promise<void> {
  // Badge ownership: search-intelligence uses chrome.action badge for heightened mode.
  // Tab Manager surfaces idle via popup CTA instead to avoid clobbering protection UX.
  void windowId
}


export { TODAY_MS, WINDOW_TAB_THRESHOLD }
