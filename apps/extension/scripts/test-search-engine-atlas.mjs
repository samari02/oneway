#!/usr/bin/env node
/**
 * Regression tests for search-engine atlas allowlist + DNR hard-block.
 * Mirrors apps/extension/src/shared/search-engine-atlas.ts + search-filter.ts
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

const SEARCH_BLOCK_ID_START = 22000
const SEARCH_BLOCK_ID_END = 22999

const atlas = JSON.parse(fs.readFileSync(ATLAS_PATH, 'utf8'))

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

function getAllowlist() {
  return (atlas.policy?.allowlistHosts || []).map((h) => h.toLowerCase())
}

function isAllowlistedSearchHost(hostname) {
  const full = hostname.toLowerCase()
  const bare = full.replace(/^www\./, '')
  if (bare === 'google.com') return true
  if (bare === 'gemini.google.com' || bare === 'bard.google.com') return true
  if (bare === 'chatgpt.com' || bare === 'chat.openai.com') return true
  for (const listed of getAllowlist()) {
    const listedBare = listed.replace(/^www\./, '')
    if (listedBare === 'google.com') continue
    if (full === listed || bare === listedBare) return true
  }
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
    if (!isAllowlistedSearchHost(urlObj.hostname.toLowerCase())) return null
    const engine = matchEngineByHostname(urlObj.hostname.toLowerCase())
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

function dnrHardBlocksHost(rules, host) {
  const apex = host.toLowerCase().replace(/^www\./, '')
  return rules.some(
    (r) =>
      r.id >= SEARCH_BLOCK_ID_START &&
      r.id <= SEARCH_BLOCK_ID_END &&
      r.action?.type === 'redirect' &&
      r.action?.redirect?.extensionPath?.includes('block-screen') &&
      (r.condition?.requestDomains || []).some((d) => d.toLowerCase() === apex)
  )
}

// --- Fixtures ---
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'))
const rules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'))

assert(!!matchEngineByHostname('yandex.by'), 'yandex.by still listed in atlas inventory')
assert(!!matchEngineByHostname('www.yandex.by'), 'www.yandex.by listed in atlas')
assert(!isAllowlistedSearchHost('yandex.by'), 'yandex.by is NOT allowlisted')
assert(isAllowlistedSearchHost('google.com'), 'google.com is allowlisted')
assert(isAllowlistedSearchHost('www.google.com'), 'www.google.com is allowlisted')
assert(!isAllowlistedSearchHost('google.fr'), 'google.fr is NOT allowlisted')
assert(isAllowlistedSearchHost('gemini.google.com'), 'gemini.google.com is allowlisted')
assert(isAllowlistedSearchHost('chatgpt.com'), 'chatgpt.com is allowlisted')
assert(isAllowlistedSearchHost('chat.openai.com'), 'chat.openai.com is allowlisted')
assert(!isAllowlistedSearchHost('perplexity.ai'), 'perplexity.ai is NOT allowlisted')
assert(!matchEngineByHostname('notyandex.com'), 'notyandex.com is not a search engine')
assert(!matchEngineByHostname('fooyandex.com'), 'fooyandex.com is not a search engine')

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
  if (case_.hardBlock === true) {
    const host = new URL(case_.url).hostname
    assert(dnrHardBlocksHost(rules, host), `DNR hard-blocks ${host}`)
  }
  if (case_.hardBlock === false && case_.isSearchEngine) {
    const host = new URL(case_.url).hostname
    assert(!dnrHardBlocksHost(rules, host), `DNR does NOT hard-block allowlisted ${host}`)
  }
}

// Google redirect still excluded
assert(!isSearchEngine('https://www.google.com/url?q=https://example.com'), 'google /url redirect excluded')

// DNR: yandex.by must hard-block (NOT family=yes SafeSearch)
assert(dnrHardBlocksHost(rules, 'yandex.by'), 'DNR hard-blocks yandex.by')
const yandexBySafe = rules.filter(
  (r) => r.id < 1000 && r.condition?.urlFilter?.includes('yandex.by')
)
assert(yandexBySafe.length === 0, 'No SafeSearch/family=yes DNR rules for yandex.by')

// Google SafeSearch still present
const googleSafe = rules.filter(
  (r) =>
    r.id < 1000 &&
    r.condition?.urlFilter?.includes('google.com/search') &&
    r.action?.redirect?.transform?.queryTransform?.addOrReplaceParams?.some(
      (p) => p.key === 'safe' && p.value === 'active'
    )
)
assert(googleSafe.length > 0, `Google SafeSearch DNR present (found ${googleSafe.length})`)

// Bing / perplexity hard-blocked
assert(dnrHardBlocksHost(rules, 'bing.com'), 'DNR hard-blocks bing.com')
assert(dnrHardBlocksHost(rules, 'perplexity.ai'), 'DNR hard-blocks perplexity.ai')
assert(dnrHardBlocksHost(rules, 'google.fr'), 'DNR hard-blocks google.fr')
assert(!dnrHardBlocksHost(rules, 'google.com'), 'DNR does not hard-block google.com')
assert(!dnrHardBlocksHost(rules, 'gemini.google.com'), 'DNR does not hard-block gemini.google.com')
assert(!dnrHardBlocksHost(rules, 'chatgpt.com'), 'DNR does not hard-block chatgpt.com')

const hardRedirects = rules.filter(
  (r) =>
    r.id >= SEARCH_BLOCK_ID_START &&
    r.id <= SEARCH_BLOCK_ID_END &&
    r.action?.type === 'redirect'
)
const hostCount = new Set(atlas.engines.flatMap((e) => e.hosts)).size
console.log(`\nAtlas hosts curated: ${hostCount}`)
console.log(`Engines: ${atlas.engines.length}`)
console.log(`Allowlist: ${getAllowlist().join(', ')}`)
console.log(`DNR hard-block hosts (redirect rules): ${hardRedirects.length}`)

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll search-engine atlas checks passed.')
