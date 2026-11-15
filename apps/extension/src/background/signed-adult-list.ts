/**
 * Signed dynamic adult list channel (cheap-agent scanner Étape 3).
 *
 * Verifies Ed25519-signed JSON (domains + adHosts), merges into
 * chrome.storage adult blocklist, and hot-applies DNR dynamic rules
 * so new hosts block without a Chrome Web Store republish.
 *
 * Sources (first success wins per refresh):
 *  1. Optional HTTPS fetchUrl (storage override or embedded default)
 *  2. Document pushed via native host CONFIG_UPDATE.signedAdultList
 *  3. Packaged public/signed-adult-list.json (bootstrap / offline)
 */

import { STORAGE_KEYS } from '../shared/constants'
import { log } from '../shared/utils'
import { mergeRemoteAdultDomains } from './adult-blocklist'

export const SIGNED_ADULT_LIST_FORMAT = 'clarity-signed-adult-list/v1'
export const SIGNED_ADULT_LIST_ALARM = 'refresh-signed-adult-list'
/** 6 hours */
export const SIGNED_ADULT_LIST_PERIOD_MINUTES = 360

/** Reserved DNR dynamic rule id range (avoid static rules.json ids). */
export const DYNAMIC_ADULT_DNR_ID_START = 900000
export const DYNAMIC_ADULT_DNR_ID_END = 909999

const BLOCK_REDIRECT =
  '/block-screen.html?reason=Adult%20content%20is%20blocked&type=dynamic'

/** Must match apps/extension/scripts/lib/dynamic-adult-list.public.json */
const KEY_ID = 'clarity-adult-list-2026'
const PUBLIC_KEY_SPKI_B64 =
  'MCowBQYDK2VwAyEA2aeZowEhbq9W/NQoTQ6ASRYkCv5GKY2tV04CtYVM78Y='

export type SignedAdultListPayload = {
  domains?: string[]
  adHosts?: string[]
}

export type SignedAdultListDocument = {
  format: string
  sequence: number
  issuedAt: string
  expiresAt: string
  keyId: string
  payload: SignedAdultListPayload
  signature: string
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

/** Canonical bytes that the signature covers — must match sign-dynamic-adult-list.mjs */
export function buildCanonicalMessage(doc: SignedAdultListDocument): string {
  const domains = uniqDomains(doc.payload?.domains || [])
  const adHosts = uniqDomains(doc.payload?.adHosts || [])
  const body = JSON.stringify({ domains, adHosts })
  return [
    doc.format || SIGNED_ADULT_LIST_FORMAT,
    String(doc.sequence ?? 0),
    String(doc.issuedAt || ''),
    String(doc.expiresAt || ''),
    String(doc.keyId || ''),
    body,
  ].join('\n')
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

let cachedVerifyKey: CryptoKey | null = null

async function getVerifyKey(): Promise<CryptoKey> {
  if (cachedVerifyKey) return cachedVerifyKey
  const spki = b64ToBytes(PUBLIC_KEY_SPKI_B64)
  cachedVerifyKey = await crypto.subtle.importKey(
    'spki',
    spki.buffer as ArrayBuffer,
    { name: 'Ed25519' },
    false,
    ['verify']
  )
  return cachedVerifyKey
}

export type VerifyResult =
  | { ok: true; domains: string[]; adHosts: string[]; sequence: number; doc: SignedAdultListDocument }
  | { ok: false; reason: string }

export async function verifySignedAdultList(raw: unknown): Promise<VerifyResult> {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'not_object' }
  const doc = raw as SignedAdultListDocument
  if (doc.format !== SIGNED_ADULT_LIST_FORMAT) return { ok: false, reason: 'bad_format' }
  if (typeof doc.signature !== 'string' || !doc.signature) {
    return { ok: false, reason: 'missing_signature' }
  }
  if (doc.keyId && doc.keyId !== KEY_ID) return { ok: false, reason: 'key_id_mismatch' }
  const exp = Date.parse(doc.expiresAt || '')
  if (!Number.isFinite(exp) || exp < Date.now()) return { ok: false, reason: 'expired' }

  try {
    const key = await getVerifyKey()
    const msg = new TextEncoder().encode(buildCanonicalMessage(doc))
    const sig = b64ToBytes(doc.signature)
    const ok = await crypto.subtle.verify({ name: 'Ed25519' }, key, sig, msg)
    if (!ok) return { ok: false, reason: 'bad_signature' }
    return {
      ok: true,
      domains: uniqDomains(doc.payload?.domains || []),
      adHosts: uniqDomains(doc.payload?.adHosts || []),
      sequence: Number(doc.sequence) || 0,
      doc,
    }
  } catch (e) {
    log('signed adult list verify error:', e)
    return { ok: false, reason: 'verify_error' }
  }
}

async function applyDynamicDnrRules(hosts: string[]): Promise<void> {
  if (!chrome.declarativeNetRequest?.updateDynamicRules) {
    log('DNR updateDynamicRules unavailable — storage merge only')
    return
  }

  const existing = await chrome.declarativeNetRequest.getDynamicRules()
  const removeRuleIds = existing
    .map((r) => r.id)
    .filter((id) => id >= DYNAMIC_ADULT_DNR_ID_START && id <= DYNAMIC_ADULT_DNR_ID_END)

  const unique = uniqDomains(hosts)
  const addRules: chrome.declarativeNetRequest.Rule[] = []
  let nextId = DYNAMIC_ADULT_DNR_ID_START
  const RT = chrome.declarativeNetRequest.ResourceType
  const AT = chrome.declarativeNetRequest.RuleActionType

  for (const domain of unique) {
    if (nextId + 1 > DYNAMIC_ADULT_DNR_ID_END) {
      log('Dynamic adult DNR id range exhausted; truncating')
      break
    }
    addRules.push({
      id: nextId++,
      priority: 2,
      action: {
        type: AT.REDIRECT,
        redirect: { extensionPath: BLOCK_REDIRECT },
      },
      condition: {
        requestDomains: [domain],
        resourceTypes: [RT.MAIN_FRAME],
      },
    })
    addRules.push({
      id: nextId++,
      priority: 2,
      action: { type: AT.BLOCK },
      condition: {
        requestDomains: [domain],
        resourceTypes: [RT.SUB_FRAME],
      },
    })
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules,
  })
  log(`Dynamic adult DNR applied (${addRules.length} rules for ${unique.length} hosts)`)
}

/**
 * Apply a verified list: merge storage + hot DNR. Skips if sequence <= last applied.
 */
export async function applyVerifiedSignedAdultList(
  result: Extract<VerifyResult, { ok: true }>
): Promise<{ applied: boolean; reason?: string }> {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.SIGNED_ADULT_LIST_SEQUENCE,
  ])
  const lastSeq = Number(stored[STORAGE_KEYS.SIGNED_ADULT_LIST_SEQUENCE] || 0)
  if (result.sequence > 0 && result.sequence <= lastSeq) {
    return { applied: false, reason: 'stale_sequence' }
  }

  const hosts = uniqDomains([...result.domains, ...result.adHosts])
  await mergeRemoteAdultDomains(hosts)
  await applyDynamicDnrRules(hosts)
  await chrome.storage.local.set({
    [STORAGE_KEYS.SIGNED_ADULT_LIST_SEQUENCE]: result.sequence,
    [STORAGE_KEYS.SIGNED_ADULT_LIST_UPDATED_AT]: new Date().toISOString(),
    [STORAGE_KEYS.SIGNED_ADULT_LIST_HOST_COUNT]: hosts.length,
  })
  log(
    `Signed adult list applied seq=${result.sequence} hosts=${hosts.length} (domains=${result.domains.length} ads=${result.adHosts.length})`
  )
  return { applied: true }
}

export async function ingestSignedAdultList(raw: unknown): Promise<VerifyResult & { applied?: boolean }> {
  const verified = await verifySignedAdultList(raw)
  if (!verified.ok) {
    log('Signed adult list rejected:', verified.reason)
    return verified
  }
  const { applied, reason } = await applyVerifiedSignedAdultList(verified)
  if (!applied) log('Signed adult list not applied:', reason)
  return { ...verified, applied }
}

async function loadPackagedSignedList(): Promise<unknown | null> {
  try {
    const url = chrome.runtime.getURL('signed-adult-list.json')
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function fetchRemoteSignedList(): Promise<unknown | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.SIGNED_ADULT_LIST_FETCH_URL)
  const url = String(stored[STORAGE_KEYS.SIGNED_ADULT_LIST_FETCH_URL] || '').trim()
  if (!url || !/^https:\/\//i.test(url)) return null
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      log('Signed adult list fetch HTTP', res.status)
      return null
    }
    return await res.json()
  } catch (e) {
    log('Signed adult list fetch failed:', e)
    return null
  }
}

/**
 * Refresh from HTTPS (if configured) then packaged bootstrap.
 * Native-host pushes call ingestSignedAdultList directly.
 */
export async function refreshSignedAdultList(): Promise<void> {
  const remote = await fetchRemoteSignedList()
  if (remote) {
    const r = await ingestSignedAdultList(remote)
    if (r.ok && r.applied) return
  }
  const packaged = await loadPackagedSignedList()
  if (packaged) {
    await ingestSignedAdultList(packaged)
  }
}

export async function ensureSignedAdultListAlarm(): Promise<void> {
  await chrome.alarms.create(SIGNED_ADULT_LIST_ALARM, {
    periodInMinutes: SIGNED_ADULT_LIST_PERIOD_MINUTES,
  })
}

export function isSignedAdultListAlarm(name: string): boolean {
  return name === SIGNED_ADULT_LIST_ALARM
}
