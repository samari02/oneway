#!/usr/bin/env node
/**
 * Cheap search-engine atlas expander + DNR sync.
 *
 * Policy (v2):
 *   - SafeSearch DNR (id < 1000): ONLY allowlisted Google SERP (google.com)
 *   - Hard-block DNR (id 22000–22999): every other atlas host → Clarity block screen
 *   - Allowlist: google.com / www.google.com, gemini.google.com / bard.google.com,
 *     chatgpt.com / chat.openai.com
 *
 * - Expands brands with expandCctlds using a bounded common-ccTLD list
 * - Regenerates SafeSearch + search hard-block rules in public/rules.json
 * - Optional --ct-stub: print future NRD/CT watch notes (does NOT crawl)
 *
 * Usage:
 *   node scripts/lib/expand-search-engine-atlas.mjs
 *   node scripts/lib/expand-search-engine-atlas.mjs --write
 *   node scripts/lib/expand-search-engine-atlas.mjs --sync-dnr
 *   node scripts/lib/expand-search-engine-atlas.mjs --write --sync-dnr
 *   node scripts/lib/expand-search-engine-atlas.mjs --ct-stub
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXT_ROOT = path.resolve(__dirname, '../..')
const ATLAS_PATH = path.join(EXT_ROOT, 'src/shared/data/search-engine-atlas.json')
const RULES_PATH = path.join(EXT_ROOT, 'public/rules.json')

const args = new Set(process.argv.slice(2))
const WRITE = args.has('--write')
const SYNC_DNR = args.has('--sync-dnr')
const CT_STUB = args.has('--ct-stub')

/** DNR id band for search-engine hard-blocks (avoid adult 1000+ and regex 12xxx). */
const SEARCH_BLOCK_ID_START = 22000
const SEARCH_BLOCK_ID_END = 22999

const BLOCK_REDIRECT =
  '/block-screen.html?reason=This%20search%20engine%20is%20blocked&type=content'

const DEFAULT_ALLOWLIST = [
  'google.com',
  'www.google.com',
  'gemini.google.com',
  'bard.google.com',
  'chatgpt.com',
  'chat.openai.com',
]

function loadAtlas() {
  return JSON.parse(fs.readFileSync(ATLAS_PATH, 'utf8'))
}

function getAllowlist(atlas) {
  const fromPolicy = atlas.policy?.allowlistHosts
  return Array.isArray(fromPolicy) && fromPolicy.length > 0
    ? fromPolicy.map((h) => h.toLowerCase())
    : DEFAULT_ALLOWLIST
}

/**
 * google.com / www.google.com only — NOT google.fr / google.co.jp.
 * Gemini + ChatGPT hosts (and their www.) allowed.
 */
function isAllowlistedSearchHost(hostname, allowlist) {
  const full = hostname.toLowerCase()
  const bare = full.replace(/^www\./, '')
  if (bare === 'google.com') return true
  if (bare === 'gemini.google.com' || bare === 'bard.google.com') return true
  if (bare === 'chatgpt.com' || bare === 'chat.openai.com') return true
  for (const listed of allowlist) {
    const listedBare = listed.replace(/^www\./, '')
    if (listedBare === 'google.com') continue // already handled exact
    if (full === listed || bare === listedBare) return true
  }
  return false
}

function expandHosts(atlas) {
  const cctlds = atlas.commonCctlds || []
  let added = 0
  for (const engine of atlas.engines) {
    if (!engine.expandCctlds || !engine.hostPrefix) continue
    const brand = engine.hostPrefix.replace(/\.$/, '') // yandex / google
    const existing = new Set(engine.hosts.map((h) => h.toLowerCase()))
    for (const tld of cctlds) {
      const host = `${brand}.${tld}`
      if (!existing.has(host)) {
        engine.hosts.push(host)
        existing.add(host)
        added++
      }
    }
  }
  return { atlas, added }
}

/**
 * SafeSearch redirect rules — allowlisted Google SERP only.
 * IDs stay in 1–99.
 */
function buildSafeSearchRules(atlas) {
  const rules = []
  let nextId = 1

  for (const engine of atlas.engines) {
    if (!engine.safeSearch) continue
    // Only google SafeSearch survives policy v2
    if (engine.id !== 'google' && engine.mode !== 'google-special') continue

    const { param, value, urlFilters, hostFilters } = engine.safeSearch
    const allowlist = getAllowlist(atlas)
    const hosts = (hostFilters?.length ? hostFilters : engine.hosts)
      .map((h) => h.toLowerCase())
      .filter((h) => isAllowlistedSearchHost(h, allowlist))

    const uniqueHosts = [...new Set(hosts.map((h) => h.replace(/^www\./, '')))]
    // Prefer explicit www + apex urlFilters so gemini.google.com is not matched
    const dnrHosts = uniqueHosts.includes('google.com')
      ? ['google.com', 'www.google.com']
      : uniqueHosts

    for (const host of dnrHosts) {
      for (const filter of urlFilters) {
        const pathPart = filter.startsWith('/') ? filter.slice(1) : filter
        const urlFilter = `||${host}/${pathPart}`
        rules.push({
          id: nextId++,
          priority: 1,
          action: {
            type: 'redirect',
            redirect: {
              transform: {
                queryTransform: {
                  addOrReplaceParams: [{ key: param, value }],
                },
              },
            },
          },
          condition: {
            urlFilter,
            resourceTypes: ['main_frame'],
          },
        })
      }
    }
  }

  return rules.sort((a, b) => a.id - b.id)
}

/**
 * Collect unique apex hosts to hard-block (expanded atlas minus allowlist).
 */
function listHardBlockedHosts(atlas) {
  const allowlist = getAllowlist(atlas)
  const set = new Set()
  for (const engine of atlas.engines) {
    for (const host of engine.hosts) {
      const h = host.toLowerCase()
      if (isAllowlistedSearchHost(h, allowlist)) continue
      set.add(h.replace(/^www\./, ''))
    }
  }
  // ya.ru is yandex-adjacent and listed; keep it
  return [...set].sort()
}

/**
 * Hard-block DNR pairs (main_frame redirect + sub_frame block), same shape as adult list.
 */
function buildSearchHardBlockRules(atlas) {
  const hosts = listHardBlockedHosts(atlas)
  const rules = []
  let nextId = SEARCH_BLOCK_ID_START

  for (const domain of hosts) {
    if (nextId + 1 > SEARCH_BLOCK_ID_END) {
      throw new Error(
        `Search hard-block ID band exhausted (${SEARCH_BLOCK_ID_START}-${SEARCH_BLOCK_ID_END}); need ${hosts.length} hosts`
      )
    }
    rules.push({
      id: nextId++,
      priority: 2,
      action: {
        type: 'redirect',
        redirect: { extensionPath: BLOCK_REDIRECT },
      },
      condition: {
        requestDomains: [domain],
        resourceTypes: ['main_frame'],
      },
    })
    rules.push({
      id: nextId++,
      priority: 2,
      action: { type: 'block' },
      condition: {
        requestDomains: [domain],
        resourceTypes: ['sub_frame'],
      },
    })
  }

  return { rules, hostCount: hosts.length }
}

function syncDnr(atlas) {
  const safeRules = buildSafeSearchRules(atlas)
  const { rules: hardRules, hostCount } = buildSearchHardBlockRules(atlas)
  const all = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'))

  // Drop prior SafeSearch (id < 1000) and prior search hard-blocks (22000–22999)
  const preserved = all.filter(
    (r) => r.id >= 1000 && (r.id < SEARCH_BLOCK_ID_START || r.id > SEARCH_BLOCK_ID_END)
  )

  const merged = [...safeRules, ...preserved, ...hardRules].sort((a, b) => a.id - b.id)
  fs.writeFileSync(RULES_PATH, JSON.stringify(merged, null, 2) + '\n')
  return {
    safeCount: safeRules.length,
    hardHostCount: hostCount,
    hardRuleCount: hardRules.length,
    total: merged.length,
  }
}

function printCtStub(atlas) {
  const brands = atlas.engines
    .filter((e) => e.hostPrefix || e.expandCctlds)
    .map((e) => e.hostPrefix || e.id)
  console.log(`
[CT/NRD stub — not implemented]
Future cheap watch (no Playwright farm):
  - Poll Certificate Transparency (e.g. crt.sh) for %yandex.% / brand markers
  - Diff against atlas.hosts; open review candidates only
  - Brands to watch: ${brands.join(', ')}
  - Bound: max N new hosts/week; human approve before atlas write
`)
}

function main() {
  let atlas = loadAtlas()
  const beforeHosts = new Set(atlas.engines.flatMap((e) => e.hosts)).size

  const { atlas: expanded, added } = expandHosts(structuredClone(atlas))
  atlas = expanded
  const afterHosts = new Set(atlas.engines.flatMap((e) => e.hosts)).size
  const allowlist = getAllowlist(atlas)
  const hardHosts = listHardBlockedHosts(atlas)

  console.log(`Atlas v${atlas.version} (${atlas.updated})`)
  console.log(`Hosts: ${beforeHosts} curated → ${afterHosts} after ccTLD expand (+${added})`)
  console.log(`Engines: ${atlas.engines.length}`)
  console.log(`Allowlist: ${allowlist.join(', ')}`)
  console.log(`Hard-block hosts: ${hardHosts.length}`)

  const yandex = atlas.engines.find((e) => e.id === 'yandex')
  if (yandex) {
    const hasBy = yandex.hosts.some((h) => h === 'yandex.by' || h.endsWith('.yandex.by'))
    console.log(`Regression gate yandex.by listed: ${hasBy ? 'OK' : 'MISSING'}`)
    console.log(
      `Regression gate yandex.by hard-block: ${hardHosts.includes('yandex.by') ? 'OK' : 'MISSING'}`
    )
  }

  if (WRITE) {
    atlas.updated = new Date().toISOString().slice(0, 10)
    fs.writeFileSync(ATLAS_PATH, JSON.stringify(atlas, null, 2) + '\n')
    console.log(`Wrote expanded atlas → ${ATLAS_PATH}`)
  } else {
    console.log('(dry-run; pass --write to persist expanded hosts)')
  }

  if (SYNC_DNR) {
    const source = WRITE ? atlas : loadAtlas()
    const { atlas: forDnr } = expandHosts(structuredClone(source))
    const { safeCount, hardHostCount, hardRuleCount, total } = syncDnr(forDnr)
    console.log(
      `Synced DNR: SafeSearch ${safeCount} (google.com only); hard-block ${hardHostCount} hosts / ${hardRuleCount} rules (rules.json total ${total})`
    )
  }

  if (CT_STUB) printCtStub(atlas)
}

main()
