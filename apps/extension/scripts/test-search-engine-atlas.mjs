#!/usr/bin/env node
/**
 * Regression tests for search-engine atlas + hard-block / allowlist policy.
 * Mirrors apps/extension/src/shared/search-engine-atlas.ts + search-filter.ts
 *
 * Policy v2+: hard-block every atlas host except google.com / Gemini / ChatGPT.
 * Layer 2 isSearchEngine / extractSearchQuery apply only on the allowlist.
 *
 * Run: pnpm --filter @clarity/extension test:search-atlas
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXT_ROOT = path.resolve(__dirname, '..')
const ATLAS_PATH = path.join(EXT_ROOT, 'src/shared/data/search-engine-atlas.json')
const RULES_PATH = path.join(EXT_ROOT, 'public/rules.json')
const FIXTURE_PATH = path.join(EXT_ROOT, 'scripts/eval/fixtures/search-atlas/yandex-by.json')

const atlas = JSON.parse(fs.readFileSync(ATLAS_PATH, 'utf8'))
const rules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'))

let failed = 0
function assert(cond, msg) {
  if (!cond) {
    failed++
    console.error('FAIL:', msg)
  } else {
    console.log('ok:', msg)
  }
}

function hostMatchesListed(hostname, listedHost) {
  const h = hostname.toLowerCase()
  const listed = listedHost.toLowerCase()
  return h === listed || h.endsWith('.' + listed)
}

function isAllowlistedSearchHost(hostname) {
  const full = hostname.toLowerCase()
  const bare = full.replace(/^www\./, '')
  if (bare === 'google.com') return true
  if (bare === 'gemini.google.com' || bare === 'bard.google.com') return true
  if (bare === 'chatgpt.com' || bare === 'chat.openai.com') return true
  return false
}

function matchEngineByHostname(hostname) {
  const h = hostname.toLowerCase().replace(/^www\./, '')
  const full = hostname.toLowerCase()
  for (const engine of atlas.engines) {
    for (const host of engine.hosts) {
      if (hostMatchesListed(full, host) || hostMatchesListed(h, host)) return engine
    }
    if (engine.hostPrefix) {
      const prefix = engine.hostPrefix.toLowerCase()
      if (full === prefix.slice(0, -1) || full.startsWith(prefix) || full.includes('.' + prefix)) {
        return engine
      }
    }
  }
  return null
}

function pathAllowsQuery(engine, pathname) {
  if (!engine.pathIncludes.length) return true
  const pathName = pathname.toLowerCase()
  return engine.pathIncludes.some((p) => pathName.includes(p.toLowerCase()))
}

/** Layer 2: allowlist only (mirrors search-filter.ts). */
function isSearchEngine(url) {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()
    const pathname = urlObj.pathname.toLowerCase()
    if (hostname.includes('google.') && pathname === '/url') return false
    if ((hostname === 'bing.com' || hostname.endsWith('.bing.com')) && pathname.startsWith('/ck/')) {
      return false
    }
    return isAllowlistedSearchHost(hostname)
  } catch {
    return false
  }
}

function extractSearchQuery(url) {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()
    if (!isAllowlistedSearchHost(hostname)) return null
    const engine = matchEngineByHostname(hostname)
    if (!engine) return null
    if (!pathAllowsQuery(engine, urlObj.pathname)) return null
    for (const param of engine.queryParams) {
      const value = urlObj.searchParams.get(param)
      if (value && value.trim()) return value
    }
    return null
  } catch {
    return null
  }
}

function isHardBlockedHost(hostname) {
  const bare = hostname.toLowerCase().replace(/^www\./, '')
  return rules.some(
    (r) =>
      r.id >= 22000 &&
      r.id <= 22999 &&
      r.action?.type === 'redirect' &&
      Array.isArray(r.condition?.requestDomains) &&
      r.condition.requestDomains.includes(bare)
  )
}

// --- Atlas membership (still listed for DNR inventory) ---
assert(!!matchEngineByHostname('yandex.by'), 'yandex.by matches atlas engine')
assert(!!matchEngineByHostname('www.yandex.by'), 'www.yandex.by matches atlas engine')
assert(!!matchEngineByHostname('yandex.kz'), 'yandex.kz matches via hostPrefix/list')
assert(!matchEngineByHostname('notyandex.com'), 'notyandex.com is not a search engine')
assert(!matchEngineByHostname('fooyandex.com'), 'fooyandex.com is not a search engine')

// --- Fixtures (Layer 2 allowlist + hardBlock flags) ---
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'))

for (const case_ of fixture.cases) {
  const detected = isSearchEngine(case_.url)
  assert(
    detected === case_.isSearchEngine,
    `isSearchEngine ${case_.url} → ${detected} (want ${case_.isSearchEngine})`
  )
  if (case_.query !== undefined) {
    const q = extractSearchQuery(case_.url)
    assert(
      q === case_.query,
      `extractSearchQuery ${case_.url} → ${JSON.stringify(q)} (want ${JSON.stringify(case_.query)})`
    )
  }
  if (case_.hardBlock !== undefined) {
    const host = new URL(case_.url).hostname
    const blocked = isHardBlockedHost(host)
    assert(
      blocked === case_.hardBlock,
      `hardBlock ${host} → ${blocked} (want ${case_.hardBlock})`
    )
  }
}

assert(isHardBlockedHost('yandex.by'), 'Regression: yandex.by homepage host is DNR hard-blocked')
assert(!isHardBlockedHost('google.com'), 'google.com must not be hard-blocked')
assert(!isHardBlockedHost('gemini.google.com'), 'gemini must not be hard-blocked')
assert(!isHardBlockedHost('chatgpt.com'), 'chatgpt must not be hard-blocked')

// Google redirect still excluded from Layer 2
assert(!isSearchEngine('https://www.google.com/url?q=https://example.com'), 'google /url redirect excluded')

// DNR: SafeSearch only on google.com; no SafeSearch for yandex.by
const safeYandexBy = rules.filter(
  (r) => r.id < 1000 && r.condition?.urlFilter?.includes('yandex.by')
)
assert(safeYandexBy.length === 0, `No SafeSearch DNR for yandex.by (found ${safeYandexBy.length})`)

const googleSafe = rules.filter(
  (r) => r.id < 1000 && r.condition?.urlFilter?.includes('google.com/search')
)
assert(googleSafe.length > 0, `SafeSearch DNR keeps google.com/search (found ${googleSafe.length})`)

const allowlistedHard = rules.filter(
  (r) =>
    r.id >= 22000 &&
    r.id <= 22999 &&
    Array.isArray(r.condition?.requestDomains) &&
    r.condition.requestDomains.some((d) =>
      ['google.com', 'gemini.google.com', 'chatgpt.com', 'chat.openai.com'].includes(d)
    )
)
assert(allowlistedHard.length === 0, 'Allowlisted hosts must not appear in hard-block DNR rules')

const hostCount = new Set(atlas.engines.flatMap((e) => e.hosts)).size
const hardCount = rules.filter((r) => r.id >= 22000 && r.id <= 22999 && r.action?.type === 'redirect')
  .length
console.log(`\nAtlas hosts: ${hostCount}`)
console.log(`Engines: ${atlas.engines.length}`)
console.log(`Hard-block hosts (DNR redirect rules): ${hardCount}`)

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll search-engine atlas checks passed.')
