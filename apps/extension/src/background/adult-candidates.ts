/**
 * Adult block candidates — observe → learn loop (v1).
 *
 * When Layer 3 / strong structural signals block a page (not static DNR alone),
 * record the registrable domain locally and sync to desktop when connected.
 * Never auto-promote policy-sensitive dual-use platforms.
 */

import { STORAGE_KEYS } from '../shared/constants'
import { log } from '../shared/utils'
import { sendAdultCandidate } from './native-messaging'

/** Cap stored candidates (FIFO by lastSeen when over cap). */
export const ADULT_CANDIDATE_CAP = 200

/** Dual-use / mixed platforms — never auto-hard-block from candidates. */
export const POLICY_SENSITIVE_DOMAINS = [
  'fantia.jp',
  'ci-en.net',
  'ci-en.jp',
  'booth.pm',
  'fanbox.cc',
  'patreon.com',
  'pixiv.net',
  'twitter.com',
  'x.com',
  'reddit.com',
  'discord.com',
  'tumblr.com',
] as const

export type AdultCandidateSource = 'content_analysis' | 'structural'

export interface AdultBlockCandidate {
  domain: string
  hits: number
  firstSeenAt: number
  lastSeenAt: number
  maxScore: number
  reasons: string[]
  source: AdultCandidateSource
}

export interface RecordAdultCandidateInput {
  domain: string
  score: number
  reasons: string[]
  source?: AdultCandidateSource
  /** When false, skip native sync (default true). */
  syncToDesktop?: boolean
}

/** Approximate registrable domain: strip www + keep last 2–3 labels for common ccTLDs. */
export function toRegistrableDomain(hostOrUrl: string): string | null {
  let host = hostOrUrl.trim().toLowerCase()
  if (!host) return null
  try {
    if (/^https?:\/\//i.test(host)) {
      host = new URL(host).hostname
    }
  } catch {
    return null
  }
  host = host.replace(/^www\./, '').replace(/^\.+|\.+$/g, '')
  if (!host.includes('.')) return null

  const parts = host.split('.').filter(Boolean)
  if (parts.length <= 2) return parts.join('.')

  // Common multi-part public suffixes we care about for JP/UK/etc.
  const multi = new Set([
    'co.jp',
    'ne.jp',
    'or.jp',
    'go.jp',
    'ac.jp',
    'co.uk',
    'org.uk',
    'com.au',
    'co.kr',
    'com.tw',
    'com.cn',
  ])
  const lastTwo = parts.slice(-2).join('.')
  if (multi.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.')
  }
  return lastTwo
}

export function isPolicySensitiveDomain(domain: string): boolean {
  const d = domain.toLowerCase().replace(/^www\./, '')
  return POLICY_SENSITIVE_DOMAINS.some(
    (p) => d === p || d.endsWith('.' + p)
  )
}

function inferSource(reasons: string[]): AdultCandidateSource {
  const structuralHints = [
    'known adult domain',
    'adult ad network',
    'adult rating',
    'rta label',
    'age restriction',
    'links to known adult',
    'adult blocklist domains',
  ]
  const joined = reasons.join(' ').toLowerCase()
  if (structuralHints.some((h) => joined.includes(h))) return 'structural'
  return 'content_analysis'
}

function uniqReasons(existing: string[], incoming: string[], cap = 8): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const r of [...incoming, ...existing]) {
    const key = r.slice(0, 160)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key)
    if (out.length >= cap) break
  }
  return out
}

/**
 * Record a candidate after a content-analysis / structural block.
 * Skips policy-sensitive domains. Caps list size.
 */
export async function recordAdultBlockCandidate(
  input: RecordAdultCandidateInput
): Promise<AdultBlockCandidate | null> {
  const domain = toRegistrableDomain(input.domain)
  if (!domain) return null
  if (isPolicySensitiveDomain(domain)) {
    log(`Adult candidate skipped (policy-sensitive): ${domain}`)
    return null
  }

  const now = Date.now()
  const source = input.source ?? inferSource(input.reasons)
  const stored = await chrome.storage.local.get(STORAGE_KEYS.ADULT_BLOCK_CANDIDATES)
  let list: AdultBlockCandidate[] = Array.isArray(
    stored[STORAGE_KEYS.ADULT_BLOCK_CANDIDATES]
  )
    ? (stored[STORAGE_KEYS.ADULT_BLOCK_CANDIDATES] as AdultBlockCandidate[])
    : []

  const idx = list.findIndex((c) => c.domain === domain)
  let entry: AdultBlockCandidate
  if (idx >= 0) {
    const prev = list[idx]
    entry = {
      ...prev,
      hits: prev.hits + 1,
      lastSeenAt: now,
      maxScore: Math.max(prev.maxScore, input.score),
      reasons: uniqReasons(prev.reasons, input.reasons),
      source: prev.source === 'structural' || source === 'structural' ? 'structural' : source,
    }
    list[idx] = entry
  } else {
    entry = {
      domain,
      hits: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      maxScore: input.score,
      reasons: uniqReasons([], input.reasons),
      source,
    }
    list.push(entry)
  }

  // Cap: drop oldest by lastSeenAt
  if (list.length > ADULT_CANDIDATE_CAP) {
    list = [...list]
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      .slice(0, ADULT_CANDIDATE_CAP)
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.ADULT_BLOCK_CANDIDATES]: list,
  })
  log(`Adult candidate recorded: ${domain} (hits=${entry.hits}, score=${entry.maxScore})`)

  if (input.syncToDesktop !== false) {
    sendAdultCandidate({
      domain: entry.domain,
      hits: entry.hits,
      firstSeenAt: entry.firstSeenAt,
      lastSeenAt: entry.lastSeenAt,
      maxScore: entry.maxScore,
      reasons: entry.reasons,
      source: entry.source,
    })
  }

  return entry
}

export async function getAdultBlockCandidates(): Promise<AdultBlockCandidate[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.ADULT_BLOCK_CANDIDATES)
  const list = stored[STORAGE_KEYS.ADULT_BLOCK_CANDIDATES]
  return Array.isArray(list) ? (list as AdultBlockCandidate[]) : []
}
