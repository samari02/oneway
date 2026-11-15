#!/usr/bin/env node
/**
 * Cheap search-engine atlas expander + SafeSearch DNR sync.
 *
 * - Expands brands with expandCctlds using a bounded common-ccTLD list
 * - Regenerates SafeSearch rules (id < 1000) in public/rules.json from atlas
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

function loadAtlas() {
  return JSON.parse(fs.readFileSync(ATLAS_PATH, 'utf8'))
}

function expandHosts(atlas) {
  const cctlds = atlas.commonCctlds || []
  let added = 0
  for (const engine of atlas.engines) {
    if (!engine.expandCctlds || !engine.hostPrefix) continue
    const brand = engine.hostPrefix.replace(/\.$/, '') // yandex
    const existing = new Set(engine.hosts.map((h) => h.toLowerCase()))
    for (const tld of cctlds) {
      const host = `${brand}.${tld}`
      if (!existing.has(host)) {
        engine.hosts.push(host)
        existing.add(host)
        added++
      }
      const www = `www.${host}`
      if (!existing.has(www)) {
        // Skip mass www.* pollution for long compound TLDs — keep apex only from expand
      }
    }
  }
  return { atlas, added }
}

/**
 * Build DNR SafeSearch redirect rules from atlas engines that declare safeSearch.
 * IDs: google 1+, bing 100+, duckduckgo 200+, yahoo 300+, ecosia 400+,
 * qwant 500+, brave 600+, yandex 700+, other 800+.
 */
function buildSafeSearchRules(atlas) {
  const idBase = {
    google: 1,
    bing: 100,
    duckduckgo: 200,
    yahoo: 300,
    ecosia: 400,
    qwant: 500,
    brave: 600,
    yandex: 700,
  }
  let otherId = 800
  const rules = []

  for (const engine of atlas.engines) {
    if (!engine.safeSearch) continue
    const { param, value, urlFilters, hostFilters } = engine.safeSearch
    const hosts = hostFilters?.length
      ? hostFilters
      : [...new Set(engine.hosts.map((h) => h.replace(/^www\./, '')))]

    // Prefer unique apex hosts for DNR (avoid www duplicates)
    const uniqueHosts = [...new Set(hosts.map((h) => h.toLowerCase()))]
    let nextId = idBase[engine.id] ?? otherId

    for (const host of uniqueHosts) {
      for (const filter of urlFilters) {
        // urlFilter form: ||host/path*
        const pathPart = filter.startsWith('/') ? filter.slice(1) : filter
        const urlFilter = `||${host}/${pathPart}`
        rules.push({
          id: nextId,
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
        nextId++
        if (!(engine.id in idBase)) otherId = Math.max(otherId, nextId)
      }
    }
    if (!(engine.id in idBase)) otherId = Math.max(otherId, nextId)
  }

  // Ensure unique IDs (collision if expansion huge)
  const seen = new Set()
  let bump = 850
  for (const rule of rules) {
    if (seen.has(rule.id) || rule.id >= 1000) {
      while (seen.has(bump) || bump >= 1000) bump++
      rule.id = bump++
    }
    seen.add(rule.id)
  }

  return rules.sort((a, b) => a.id - b.id)
}

function syncDnr(atlas) {
  const safeRules = buildSafeSearchRules(atlas)
  const all = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'))
  const adultAndRest = all.filter((r) => r.id >= 1000)
  const merged = [...safeRules, ...adultAndRest]
  fs.writeFileSync(RULES_PATH, JSON.stringify(merged, null, 2) + '\n')
  return { safeCount: safeRules.length, total: merged.length }
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

  console.log(`Atlas v${atlas.version} (${atlas.updated})`)
  console.log(`Hosts: ${beforeHosts} curated → ${afterHosts} after ccTLD expand (+${added})`)
  console.log(`Engines: ${atlas.engines.length}`)

  const yandex = atlas.engines.find((e) => e.id === 'yandex')
  if (yandex) {
    const hasBy = yandex.hosts.some((h) => h === 'yandex.by' || h.endsWith('.yandex.by'))
    console.log(`Regression gate yandex.by: ${hasBy ? 'OK' : 'MISSING'}`)
  }

  if (WRITE) {
    atlas.updated = new Date().toISOString().slice(0, 10)
    fs.writeFileSync(ATLAS_PATH, JSON.stringify(atlas, null, 2) + '\n')
    console.log(`Wrote expanded atlas → ${ATLAS_PATH}`)
  } else {
    console.log('(dry-run; pass --write to persist expanded hosts)')
  }

  if (SYNC_DNR) {
    // Sync from on-disk atlas if not writing expansion, else use expanded
    const source = WRITE ? atlas : loadAtlas()
    // Always expand in-memory for DNR so yandex.* ccTLDs get SafeSearch even if JSON not rewritten
    const { atlas: forDnr } = expandHosts(structuredClone(source))
    const { safeCount, total } = syncDnr(forDnr)
    console.log(`Synced DNR SafeSearch: ${safeCount} rules (rules.json total ${total})`)
  }

  if (CT_STUB) printCtStub(atlas)
}

main()
