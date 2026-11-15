#!/usr/bin/env node
/**
 * Regression tests for search-engine atlas + Layer 2 host/query matching.
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
    return matchEngineByHostname(hostname) !== null
  } catch {
    return false
  }
}

function extractSearchQuery(url) {
  try {
    const urlObj = new URL(url)
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

// --- Fixtures ---
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'))

assert(!!matchEngineByHostname('yandex.by'), 'yandex.by matches atlas engine')
assert(!!matchEngineByHostname('www.yandex.by'), 'www.yandex.by matches atlas engine')
assert(!!matchEngineByHostname('yandex.kz'), 'yandex.kz matches via hostPrefix/list')
assert(!matchEngineByHostname('notyandex.com'), 'notyandex.com is not a search engine')
assert(!matchEngineByHostname('fooyandex.com'), 'fooyandex.com is not a search engine')

for (const case_ of fixture.cases) {
  const detected = isSearchEngine(case_.url)
  assert(detected === case_.isSearchEngine, `isSearchEngine ${case_.url} → ${detected} (want ${case_.isSearchEngine})`)
  if (case_.query !== undefined) {
    const q = extractSearchQuery(case_.url)
    assert(q === case_.query, `extractSearchQuery ${case_.url} → ${JSON.stringify(q)} (want ${JSON.stringify(case_.query)})`)
  }
}

// Legacy miss: only .com/.ru used to match — .by must work now
assert(
  isSearchEngine('https://yandex.by/search/?text=test'),
  'Layer2 treats yandex.by/search as search engine (regression)'
)
assert(
  extractSearchQuery('https://yandex.by/search/?text=porn') === 'porn',
  'extractSearchQuery reads text= on yandex.by'
)

// AI search
assert(isSearchEngine('https://www.perplexity.ai/?q=hello'), 'perplexity.ai is Layer2 search host')
assert(extractSearchQuery('https://www.perplexity.ai/?q=hello') === 'hello', 'perplexity q=')

// Google redirect still excluded
assert(!isSearchEngine('https://www.google.com/url?q=https://example.com'), 'google /url redirect excluded')

// DNR SafeSearch must include yandex.by
const rules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'))
const yandexByRules = rules.filter(
  (r) => r.id < 1000 && r.condition?.urlFilter?.includes('yandex.by')
)
assert(yandexByRules.length > 0, `DNR SafeSearch has yandex.by rules (found ${yandexByRules.length})`)
assert(
  yandexByRules.some((r) => r.action?.redirect?.transform?.queryTransform?.addOrReplaceParams?.some(
    (p) => p.key === 'family' && p.value === 'yes'
  )),
  'yandex.by DNR sets family=yes'
)

const hostCount = new Set(atlas.engines.flatMap((e) => e.hosts)).size
console.log(`\nAtlas hosts curated: ${hostCount}`)
console.log(`Engines: ${atlas.engines.length}`)

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll search-engine atlas checks passed.')
