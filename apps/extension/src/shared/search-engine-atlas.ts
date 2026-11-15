/**
 * Search-engine atlas — curated hosts for Layer 2 + SafeSearch DNR.
 * Source of truth: ./data/search-engine-atlas.json (cheap inventory, no crawler).
 */

import atlasJson from './data/search-engine-atlas.json'

export type SearchEngineMode = 'safesearch+filter' | 'filter-only' | 'google-special'

export type SearchEngineSafeSearch = {
  param: string
  value: string
  urlFilters: string[]
  hostFilters?: string[]
}

export type SearchEngineEntry = {
  id: string
  brand: string
  mode: SearchEngineMode
  category?: string
  queryParams: string[]
  pathIncludes: string[]
  hosts: string[]
  hostPrefix?: string
  expandCctlds?: boolean
  safeSearch?: SearchEngineSafeSearch
  notes?: string
}

export type SearchEngineAtlas = {
  version: number
  updated: string
  description: string
  policy: { defaultMode: string; notes: string[] }
  commonCctlds: string[]
  engines: SearchEngineEntry[]
}

export const searchEngineAtlas = atlasJson as SearchEngineAtlas

/** Exact host or subdomain match (avoids fooyandex.com false positives). */
export function hostMatchesListed(hostname: string, listedHost: string): boolean {
  const h = hostname.toLowerCase()
  const listed = listedHost.toLowerCase()
  return h === listed || h.endsWith('.' + listed)
}

/**
 * Match hostname against atlas entry (listed hosts and optional hostPrefix).
 * hostPrefix e.g. "yandex." matches yandex.by / www.yandex.kz safely.
 */
export function matchEngineByHostname(hostname: string): SearchEngineEntry | null {
  const h = hostname.toLowerCase().replace(/^www\./, '')
  const full = hostname.toLowerCase()

  for (const engine of searchEngineAtlas.engines) {
    for (const host of engine.hosts) {
      if (hostMatchesListed(full, host) || hostMatchesListed(h, host)) {
        return engine
      }
    }
    if (engine.hostPrefix) {
      const prefix = engine.hostPrefix.toLowerCase()
      // Require label boundary: start or after a dot, then prefix
      if (full === prefix.slice(0, -1) || full.startsWith(prefix) || full.includes('.' + prefix)) {
        return engine
      }
    }
  }
  return null
}

/** All unique hosts from the atlas (for docs / sync / whitelist). */
export function listAtlasHosts(): string[] {
  const set = new Set<string>()
  for (const engine of searchEngineAtlas.engines) {
    for (const host of engine.hosts) {
      set.add(host.toLowerCase())
    }
  }
  return [...set].sort()
}

/** Substrings / prefixes used for coarse UI detection (status panel). */
export function listAtlasDetectionNeedles(): string[] {
  const needles = new Set<string>()
  for (const engine of searchEngineAtlas.engines) {
    if (engine.hostPrefix) {
      needles.add(engine.hostPrefix.toLowerCase())
    }
    for (const host of engine.hosts) {
      // Prefer registrable-ish needles; keep short brands usable with includes()
      const parts = host.toLowerCase().split('.')
      if (parts.length >= 2) {
        needles.add(parts.slice(-2).join('.'))
      } else {
        needles.add(host.toLowerCase())
      }
    }
  }
  // Stable extras used historically in service-worker status
  needles.add('brave.com')
  needles.add('yandex.')
  return [...needles]
}

export function isAtlasSearchHost(hostname: string): boolean {
  return matchEngineByHostname(hostname) !== null
}
