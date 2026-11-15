/**
 * Search-engine atlas — curated hosts for Layer 2 (allowlist) + DNR hard-block (everyone else).
 * Source of truth: ./data/search-engine-atlas.json (cheap inventory, no crawler).
 *
 * Policy (v2): hard-block every atlas host except:
 *   google.com / www.google.com, gemini.google.com / bard.google.com,
 *   chatgpt.com / chat.openai.com
 */

import atlasJson from './data/search-engine-atlas.json'

export type SearchEngineMode =
  | 'safesearch+filter'
  | 'filter-only'
  | 'google-special'
  | 'hard-block'

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
  policy: {
    defaultMode: string
    notes: string[]
    allowlistHosts: string[]
  }
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
 * Explicit navigation allowlist for search engines.
 * google.com (not google.fr / google.co.jp), Gemini, ChatGPT only.
 */
export function getAllowlistedSearchHosts(): string[] {
  const fromPolicy = searchEngineAtlas.policy?.allowlistHosts
  if (Array.isArray(fromPolicy) && fromPolicy.length > 0) {
    return fromPolicy.map((h) => h.toLowerCase())
  }
  return [
    'google.com',
    'www.google.com',
    'gemini.google.com',
    'bard.google.com',
    'chatgpt.com',
    'chat.openai.com',
  ]
}

/**
 * True if hostname is an allowlisted search host.
 * Special-case: only exact google.com / www.google.com — NOT other google.* ccTLDs
 * (those are hard-blocked even though they share the brand).
 */
export function isAllowlistedSearchHost(hostname: string): boolean {
  const full = hostname.toLowerCase()
  const bare = full.replace(/^www\./, '')

  // Google SERP: exact apex only (user: sauf google.com)
  if (bare === 'google.com') return true

  // Gemini closely-related hosts
  if (bare === 'gemini.google.com' || bare === 'bard.google.com') return true

  // ChatGPT
  if (bare === 'chatgpt.com' || bare === 'chat.openai.com') return true

  // Fallback: exact match against policy list (covers www. variants listed explicitly)
  for (const listed of getAllowlistedSearchHosts()) {
    if (full === listed || bare === listed.replace(/^www\./, '')) {
      // Re-check google: listed www.google.com / google.com already handled;
      // do not allow google.fr via generic hostMatchesListed on "google.com"
      if (listed === 'google.com' || listed === 'www.google.com') {
        return bare === 'google.com'
      }
      if (hostMatchesListed(full, listed) || hostMatchesListed(bare, listed)) {
        return true
      }
    }
  }
  return false
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

/** Atlas hosts that must be DNR hard-blocked (not on allowlist). */
export function listHardBlockedSearchHosts(): string[] {
  const set = new Set<string>()
  for (const host of listAtlasHosts()) {
    if (!isAllowlistedSearchHost(host)) {
      set.add(host.replace(/^www\./, ''))
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

/**
 * Layer 2 applies only on allowlisted search hosts.
 * Other atlas engines are hard-blocked at DNR before navigation completes.
 */
export function isLayer2SearchHost(hostname: string): boolean {
  return isAllowlistedSearchHost(hostname)
}
