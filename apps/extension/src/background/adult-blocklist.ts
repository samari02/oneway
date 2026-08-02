/**
 * Adult system blocklist — bundled seed + remote sync merge.
 *
 * Static DNR (rules.json) remains the primary network block.
 * This list feeds service-worker `shouldBlock` for additive coverage
 * (new hosts before a rebuild, or remote updates via desktop).
 */

import { STORAGE_KEYS } from '../shared/constants'
import { log } from '../shared/utils'

export interface AdultBlocklistDocument {
  version?: number
  updatedAt?: string
  domains?: string[]
  hostnameSubstrings?: string[]
  policySensitive?: Array<{ domain: string; notes?: string }>
}

function uniqDomains(domains: string[]): string[] {
  const out = new Set<string>()
  for (const raw of domains) {
    if (typeof raw !== 'string') continue
    let s = raw.trim().toLowerCase()
    if (!s) continue
    s = s.replace(/^https?:\/\//, '').split('/')[0] || ''
    s = s.replace(/^www\./, '').replace(/^\.+|\.+$/g, '')
    if (s.includes('.')) out.add(s)
  }
  return [...out].sort()
}

/**
 * Load packaged `adult-blocklist.json` and merge into chrome.storage (additive).
 * Never clears existing domains if the package is missing/empty.
 */
export async function ensureBundledAdultBlocklistSeed(): Promise<void> {
  try {
    const url = chrome.runtime.getURL('adult-blocklist.json')
    const res = await fetch(url)
    if (!res.ok) {
      log('adult-blocklist.json not packaged (skip seed)')
      return
    }
    const doc = (await res.json()) as AdultBlocklistDocument
    const bundled = Array.isArray(doc.domains) ? doc.domains : []
    if (!bundled.length) return

    const stored = await chrome.storage.local.get([
      STORAGE_KEYS.ADULT_BLOCKLIST_DOMAINS,
      STORAGE_KEYS.ADULT_BLOCKLIST_VERSION
    ])
    const existing = Array.isArray(stored[STORAGE_KEYS.ADULT_BLOCKLIST_DOMAINS])
      ? (stored[STORAGE_KEYS.ADULT_BLOCKLIST_DOMAINS] as string[])
      : []

    const merged = uniqDomains([...existing, ...bundled])
    await chrome.storage.local.set({
      [STORAGE_KEYS.ADULT_BLOCKLIST_DOMAINS]: merged,
      [STORAGE_KEYS.ADULT_BLOCKLIST_VERSION]:
        doc.version ?? stored[STORAGE_KEYS.ADULT_BLOCKLIST_VERSION] ?? 1
    })
    log(`Adult blocklist seed ready (${merged.length} domains)`)
  } catch (e) {
    log('Failed to load bundled adult blocklist:', e)
  }
}

/**
 * Merge remote/synced domains additively. Empty remote must NOT wipe local seed.
 */
export async function mergeRemoteAdultDomains(remote: unknown): Promise<void> {
  if (!Array.isArray(remote) || remote.length === 0) {
    return
  }
  const stored = await chrome.storage.local.get(STORAGE_KEYS.ADULT_BLOCKLIST_DOMAINS)
  const existing = Array.isArray(stored[STORAGE_KEYS.ADULT_BLOCKLIST_DOMAINS])
    ? (stored[STORAGE_KEYS.ADULT_BLOCKLIST_DOMAINS] as string[])
    : []
  const merged = uniqDomains([...existing, ...(remote as string[])])
  await chrome.storage.local.set({
    [STORAGE_KEYS.ADULT_BLOCKLIST_DOMAINS]: merged
  })
  log(`Adult blocklist merged from desktop (${merged.length} domains)`)
}

export async function getAdultBlocklistDomains(): Promise<string[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.ADULT_BLOCKLIST_DOMAINS)
  const domains = stored[STORAGE_KEYS.ADULT_BLOCKLIST_DOMAINS]
  return Array.isArray(domains) ? (domains as string[]) : []
}
