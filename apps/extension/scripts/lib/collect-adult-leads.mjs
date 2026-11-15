#!/usr/bin/env node
/**
 * Étape 6 — bounded, manual-first adult-lead collector.
 *
 * NOT an open-web crawl. Offline-first sources with configurable caps (~50–100 URLs/run).
 * Optional Playwright hydrate (`--playwright`) and optional live PeerTube (`--live`).
 * Emits 2–4 KB snapshots + discovery-compatible JSON/CSV for `review:candidates`.
 * Never auto-ships / never signs. No secrets.
 *
 * Usage:
 *   pnpm --filter @clarity/extension collect:adult-leads
 *   pnpm --filter @clarity/extension collect:adult-leads -- --max 80
 *   pnpm --filter @clarity/extension collect:adult-leads -- --playwright
 *   # manual only:
 *   # pnpm --filter @clarity/extension collect:adult-leads -- --live --max-probe 5
 *   # pnpm --filter @clarity/extension collect:adult-leads -- --search-live
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXT_ROOT = path.resolve(__dirname, '../..')
const SEEDS_PATH = path.join(__dirname, 'collector-seeds.json')
const BLOCKLIST_PATH = path.join(EXT_ROOT, 'public/adult-blocklist.json')
const FIXTURE_DIR = path.join(__dirname, '../eval/fixtures/collector')
const DISCOVERY_FIXTURE_DIR = path.join(__dirname, '../eval/fixtures/discovery')
const PAGE_FIXTURE_DIR = path.join(__dirname, '../eval/fixtures/page-analyzer')
const HTML_FIXTURE_DIR = path.join(FIXTURE_DIR, 'html')
const PUBLIC_SEED_SAMPLE = path.join(FIXTURE_DIR, 'public-seed-sample.txt')
const PARTNER_GOLD = path.join(FIXTURE_DIR, 'partner-outbound-gold.html')
const DEFAULT_OUT_DIR = path.join(__dirname, '../eval/out/collector')
const DISCOVERY_OUT = path.join(__dirname, '../eval/out/discovery/discovery-report.json')
const CLARITY_DISCOVERY = path.join(os.homedir(), '.clarity/discovery-candidates.json')

const MAX_SNAPSHOT_CHARS = 3500
const DEFAULT_MAX_URLS = 80
const PLAYWRIGHT_TIMEOUT_MS = 5000
const LIVE_TIMEOUT_MS = 6000
const USER_AGENT = 'ClarityCollector/0.1 (+bounded; no open crawl)'

/** Never emit these as block candidates. */
const SAFE_DENYLIST = new Set([
  'peertube.cpy.re',
  'peertube2.cpy.re',
  'framatube.org',
  'joinpeertube.org',
  'wikipedia.org',
  'en.wikipedia.org',
  'who.int',
  'cdc.gov',
  'github.com',
  'google.com',
  'youtube.com',
  'vimeo.com',
  'fantia.jp',
  'booth.pm',
  'fanbox.cc',
  'patreon.com',
])

const ADULT_AD_NETWORKS = new Set([
  'exoclick.com', 'juicyads.com', 'trafficjunky.net', 'trafficjunky.com',
  'popads.net', 'adsterra.com', 'tsyndicate.com', 'ero-advertising.com',
  'plugrush.com', 'clickadu.com', 'adcash.com', 'hilltopads.com',
  'magsrv.com', 'realsrv.com', 'cpmstar.com', 'adxpansion.com',
  'a.magsrv.com',
])

function parseArgs(argv) {
  const out = {
    max: DEFAULT_MAX_URLS,
    live: false,
    playwright: false,
    searchLive: false,
    wireReview: true,
    maxProbe: 5,
    outDir: DEFAULT_OUT_DIR,
    publicSeed: PUBLIC_SEED_SAMPLE,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') continue
    if (a === '--max') out.max = Math.max(1, Number(argv[++i]) || DEFAULT_MAX_URLS)
    else if (a === '--live') out.live = true
    else if (a === '--playwright') out.playwright = true
    else if (a === '--search-live') out.searchLive = true
    else if (a === '--no-wire-review') out.wireReview = false
    else if (a === '--max-probe') out.maxProbe = Number(argv[++i]) || 5
    else if (a === '--out') out.outDir = path.resolve(argv[++i])
    else if (a === '--public-seed') out.publicSeed = path.resolve(argv[++i])
    else if (a === '--help' || a === '-h') out.help = true
  }
  return out
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function normalizeHost(raw) {
  if (typeof raw !== 'string') return null
  let s = raw.trim().toLowerCase()
  s = s.replace(/^https?:\/\//, '').split('/')[0] || ''
  s = s.replace(/^www\./, '').replace(/:\d+$/, '').replace(/^\.+|\.+$/g, '')
  if (!s || !s.includes('.')) return null
  return s
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function loadClarityBlocklistHosts() {
  const hosts = new Set()
  try {
    const doc = loadJson(BLOCKLIST_PATH)
    for (const d of doc.domains || []) {
      const h = normalizeHost(d)
      if (h) hosts.add(h)
    }
  } catch (e) {
    console.warn('[warn] could not load adult-blocklist.json:', e.message)
  }
  return hosts
}

function loadPublicSeedHosts(filePath) {
  const hosts = []
  if (!fs.existsSync(filePath)) return hosts
  const text = fs.readFileSync(filePath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const h = normalizeHost(t)
    if (h) hosts.push(h)
  }
  return hosts
}

function loadSeedsDoc() {
  try {
    return loadJson(SEEDS_PATH)
  } catch {
    return { maxUrlsDefault: DEFAULT_MAX_URLS, peertubeSeeds: ['pigav.com'], searchSeeds: [] }
  }
}

function truncateSnapshot(html) {
  const compact = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, (m) =>
      /PeerTubeServerConfig|isNSFW|magsrv|exoclick/i.test(m) ? m.slice(0, 800) : ''
    )
    .replace(/\s+/g, ' ')
    .trim()
  if (compact.length <= MAX_SNAPSHOT_CHARS) return compact
  return compact.slice(0, MAX_SNAPSHOT_CHARS) + '…'
}

function extractOutboundHosts(html, pageUrl = '') {
  const hosts = new Set()
  const re = /href\s*=\s*["'](https?:\/\/[^"']+)["']/gi
  let m
  while ((m = re.exec(html))) {
    try {
      const u = new URL(m[1])
      const h = normalizeHost(u.hostname)
      if (!h) continue
      if (ADULT_AD_NETWORKS.has(h)) continue
      // skip same-host relative-ish absolute links back to page host
      if (pageUrl) {
        try {
          const ph = normalizeHost(new URL(pageUrl).hostname)
          if (ph && ph === h) continue
        } catch {
          /* ignore */
        }
      }
      hosts.add(h)
    } catch {
      /* ignore */
    }
  }
  return [...hosts]
}

function findOfflineHtml(host) {
  const candidates = [
    path.join(HTML_FIXTURE_DIR, `${host}.html`),
    path.join(PAGE_FIXTURE_DIR, `${host.replace(/\./g, '-')}.html`),
  ]
  // Known gold aliases
  const aliases = {
    'pigav.com': path.join(PAGE_FIXTURE_DIR, 'pigav-watch-peertube.html'),
    'globalinnovationdesign.org': path.join(
      PAGE_FIXTURE_DIR,
      'globalinnovationdesign-cloaked.html'
    ),
  }
  if (aliases[host] && fs.existsSync(aliases[host])) return aliases[host]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  // fuzzy: any file containing host stem
  if (fs.existsSync(HTML_FIXTURE_DIR)) {
    for (const f of fs.readdirSync(HTML_FIXTURE_DIR)) {
      if (!f.endsWith('.html')) continue
      if (f.includes(host) || f.replace(/\.html$/, '') === host) {
        return path.join(HTML_FIXTURE_DIR, f)
      }
    }
  }
  return null
}

async function tryPlaywrightHydrate(url) {
  let playwright
  try {
    playwright = await import('playwright')
  } catch {
    return {
      ok: false,
      reason: 'playwright_not_installed',
      note: 'Install optionally: pnpm add -D playwright && npx playwright install chromium',
    }
  }
  const { chromium } = playwright
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ userAgent: USER_AGENT })
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: PLAYWRIGHT_TIMEOUT_MS,
    })
    await page.waitForTimeout(Math.min(1500, PLAYWRIGHT_TIMEOUT_MS))
    const html = await page.content()
    return { ok: true, html, source: 'playwright' }
  } catch (e) {
    return { ok: false, reason: 'playwright_error', error: String(e.message || e).slice(0, 200) }
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}

async function fetchText(url, { timeoutMs = LIVE_TIMEOUT_MS } = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'text/html,application/json', 'User-Agent': USER_AGENT },
      redirect: 'follow',
    })
    const text = await res.text()
    return { ok: res.ok, status: res.status, text }
  } catch (e) {
    return { ok: false, reason: String(e.message || e).slice(0, 120) }
  } finally {
    clearTimeout(t)
  }
}

function loadPeerTubeFollowingFixture(seed) {
  const p = path.join(DISCOVERY_FIXTURE_DIR, `${seed}.following.json`)
  if (!fs.existsSync(p)) return { ok: false, reason: 'missing_fixture' }
  try {
    return { ok: true, json: loadJson(p), source: 'fixture' }
  } catch (e) {
    return { ok: false, reason: e.message }
  }
}

async function loadPeerTubeFollowingLive(seed) {
  const url = `https://${seed}/api/v1/server/following?count=20&start=0`
  const res = await fetchText(url)
  if (!res.ok) return { ok: false, reason: res.reason || `http_${res.status}` }
  try {
    return { ok: true, json: JSON.parse(res.text), source: 'live' }
  } catch {
    return { ok: false, reason: 'json_parse' }
  }
}

function hostsFromFollowing(json) {
  const out = []
  for (const row of json?.data || []) {
    const h = normalizeHost(row?.following?.host || row?.following?.url || '')
    if (h) out.push(h)
  }
  return out
}

function upsertLead(map, host, patch) {
  const d = normalizeHost(host)
  if (!d) return
  const cur = map.get(d) || {
    domain: d,
    sources: [],
    signals: {},
    status: 'review',
    urls: [],
  }
  for (const s of patch.sources || []) {
    if (!cur.sources.includes(s)) cur.sources.push(s)
  }
  cur.signals = { ...cur.signals, ...patch.signals }
  if (patch.status) cur.status = patch.status
  for (const u of patch.urls || []) {
    if (!cur.urls.includes(u)) cur.urls.push(u)
  }
  map.set(d, cur)
}

function classifyLead(c, blocklist) {
  if (SAFE_DENYLIST.has(c.domain)) {
    return { ...c, status: 'deny_safe_corpus' }
  }
  if (ADULT_AD_NETWORKS.has(c.domain) || c.signals?.role === 'ad_network') {
    return { ...c, status: 'ad_host' }
  }
  if (blocklist.has(c.domain)) {
    return { ...c, status: 'already_blocked', signals: { ...c.signals, onClarityBlocklist: true } }
  }
  if (c.signals?.isNSFW === true || (c.signals?.adHostsEmbedded || []).length > 0) {
    return { ...c, status: 'candidate_block' }
  }
  if (c.domain.endsWith('.example')) {
    return { ...c, status: 'review_fixture' }
  }
  return { ...c, status: 'review' }
}

function toCsv(candidates) {
  const header = ['domain', 'status', 'sources', 'snapshot', 'urls']
  const lines = [header.join(',')]
  for (const c of candidates) {
    lines.push(
      [
        c.domain,
        c.status,
        `"${(c.sources || []).join('|')}"`,
        c.snapshotFile || '',
        `"${(c.urls || []).slice(0, 3).join('|')}"`,
      ].join(',')
    )
  }
  return lines.join('\n') + '\n'
}

function buildDiscoveryCompatible(candidates, meta) {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode: meta.mode,
    source: 'collect-adult-leads',
    seeds: meta.seeds,
    counts: {
      total: candidates.length,
      candidate_block: candidates.filter((c) => c.status === 'candidate_block').length,
      review: candidates.filter((c) => String(c.status).startsWith('review')).length,
      denied: candidates.filter((c) => String(c.status).startsWith('deny')).length,
      already_blocked: candidates.filter((c) => c.status === 'already_blocked').length,
      ad_host: candidates.filter((c) => c.status === 'ad_host').length,
    },
    safeCorpusNote:
      'No auto-ship. Run eval:page-analyzer + eval:adult-blocking before signing/promoting.',
    candidates: candidates.map((c) => ({
      domain: c.domain,
      sources: c.sources,
      signals: c.signals,
      status: c.status,
      snapshotFile: c.snapshotFile || null,
      snapshotChars: c.snapshotChars || 0,
      urls: c.urls || [],
    })),
    collectorMeta: meta,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(`Usage: collect-adult-leads [options]
  Default = offline fixtures (bounded). Caps ~50–100 URLs via --max (default ${DEFAULT_MAX_URLS}).

  Sources:
    1) Diff public seed sample vs Clarity adult-blocklist (new hostnames only)
    2) 1-hop partner/outbound links from gold HTML fixtures
    3) Curated search query→URL list (offline); --search-live optional / not CI
    4) PeerTube following: fixtures default; --live manual only

  Options:
    --max N            Cap candidate URLs/hosts (default ${DEFAULT_MAX_URLS})
    --playwright       Optional ~5s hydrate per URL without offline HTML
    --live             Manual PeerTube following live (short timeout; not CI)
    --search-live      Attempt live search (stubbed; may captcha — not required)
    --no-wire-review   Do not copy report into discovery-report / ~/.clarity
    --public-seed PATH Alternate public seed file for diff
    --out DIR          Output directory
    --max-probe N      Live PeerTube host probe cap (default 5)`)
    process.exit(0)
  }

  if (args.live) {
    console.warn('[warn] --live is MANUAL/OPTIONAL — not used in CI. Prefer fixtures.')
  }
  if (args.searchLive) {
    console.warn('[warn] --search-live is OPTIONAL — curated offline seeds are the supported path.')
  }

  const seedsDoc = loadSeedsDoc()
  const blocklist = loadClarityBlocklistHosts()
  const leadMap = new Map()
  const runLog = []
  const snapshotDir = path.join(args.outDir, 'snapshots')
  fs.mkdirSync(snapshotDir, { recursive: true })

  const max = args.max || seedsDoc.maxUrlsDefault || DEFAULT_MAX_URLS
  console.log(`Collector Étape 6 — max=${max} mode=${args.live ? 'live+offline' : 'offline'} playwright=${args.playwright}`)

  // --- Source 1: public seed diff (new hostnames only) ---
  const publicHosts = loadPublicSeedHosts(args.publicSeed)
  let newFromDiff = 0
  for (const h of publicHosts) {
    if (blocklist.has(h)) {
      runLog.push({ source: 'public_diff', host: h, result: 'already_blocked' })
      continue
    }
    upsertLead(leadMap, h, {
      sources: ['public_seed_diff'],
      urls: [`https://${h}/`],
    })
    newFromDiff++
  }
  console.log(`  public_seed_diff: ${publicHosts.length} seeds → ${newFromDiff} new vs Clarity blocklist`)

  // --- Source 2: 1-hop partner/outbound from gold HTML ---
  const partnerHtmlPaths = [PARTNER_GOLD]
  if (fs.existsSync(PAGE_FIXTURE_DIR)) {
    for (const f of fs.readdirSync(PAGE_FIXTURE_DIR)) {
      if (f.endsWith('.html') && !f.startsWith('safe-')) {
        partnerHtmlPaths.push(path.join(PAGE_FIXTURE_DIR, f))
      }
    }
  }
  let partnerAdds = 0
  for (const htmlPath of partnerHtmlPaths) {
    if (!fs.existsSync(htmlPath)) continue
    const html = fs.readFileSync(htmlPath, 'utf8')
    const hosts = extractOutboundHosts(html)
    for (const h of hosts) {
      if (blocklist.has(h) && !h.endsWith('.example')) continue
      upsertLead(leadMap, h, {
        sources: [`partner_outbound:${path.basename(htmlPath)}`],
        urls: [`https://${h}/`],
      })
      partnerAdds++
    }
  }
  console.log(`  partner_outbound: scanned ${partnerHtmlPaths.length} HTML → ${partnerAdds} host refs`)

  // --- Source 3: curated search seeds (offline) ---
  let searchAdds = 0
  for (const entry of seedsDoc.searchSeeds || []) {
    const q = entry.query || ''
    for (const url of entry.urls || []) {
      const h = normalizeHost(url)
      if (!h) continue
      upsertLead(leadMap, h, {
        sources: [`search_seed:${q}`],
        urls: [url],
        signals: { searchQuery: q },
      })
      searchAdds++
    }
  }
  if (args.searchLive) {
    runLog.push({
      source: 'search_live',
      result: 'stubbed',
      note: 'Live search not implemented (captcha-heavy). Use curated searchSeeds.',
    })
    console.log('  search_live: stubbed (use curated offline searchSeeds)')
  }
  console.log(`  search_seeds: ${searchAdds} curated URL→host mappings`)

  // --- Source 4: PeerTube following (fixtures / optional live) ---
  const peertubeSeeds = (seedsDoc.peertubeSeeds || ['pigav.com']).map(normalizeHost).filter(Boolean)
  for (const seed of peertubeSeeds) {
    let graph
    if (args.live) {
      graph = await loadPeerTubeFollowingLive(seed)
      if (!graph.ok) {
        console.warn(`  ! peertube live ${seed}:`, graph.reason)
        graph = loadPeerTubeFollowingFixture(seed)
      }
    } else {
      graph = loadPeerTubeFollowingFixture(seed)
    }
    runLog.push({ source: 'peertube_following', seed, ok: graph.ok, via: graph.source, reason: graph.reason })
    if (!graph.ok) {
      console.warn(`  ! peertube ${seed}:`, graph.reason)
      continue
    }
    const hosts = hostsFromFollowing(graph.json).slice(0, args.maxProbe)
    console.log(`  peertube_following ${seed}: ${hosts.length} hosts (${graph.source})`)
    for (const h of hosts) {
      upsertLead(leadMap, h, {
        sources: [`peertube_following:${seed}:${graph.source}`],
        urls: [`https://${h}/`],
      })
    }
  }

  // Cap hosts — prefer richer leads (offline HTML, multi-source, partner/search) over bulk public-diff stubs
  function leadPriority(host) {
    const c = leadMap.get(host)
    let score = 0
    if (findOfflineHtml(host)) score += 100
    if ((c?.sources || []).some((s) => String(s).startsWith('partner_outbound'))) score += 40
    if ((c?.sources || []).some((s) => String(s).startsWith('search_seed'))) score += 30
    if ((c?.sources || []).some((s) => String(s).startsWith('peertube_'))) score += 20
    score += Math.min(10, (c?.sources || []).length)
    // de-prioritize pure batch stubs from public diff
    if ((c?.sources || []).length === 1 && c.sources[0] === 'public_seed_diff' && host.includes('collector-batch-')) {
      score -= 50
    }
    return score
  }
  let hosts = [...leadMap.keys()].sort((a, b) => {
    const d = leadPriority(b) - leadPriority(a)
    return d !== 0 ? d : a.localeCompare(b)
  })
  if (hosts.length > max) {
    console.log(`  cap: trimming ${hosts.length} → ${max} (priority: fixtures/partner/search first)`)
    hosts = hosts.slice(0, max)
  }

  // --- Snapshots: offline HTML preferred; optional Playwright ---
  let offlineSnaps = 0
  let pwSnaps = 0
  let emptySnaps = 0
  const playwrightNote = []

  for (const host of hosts) {
    const lead = leadMap.get(host)
    const url = (lead.urls && lead.urls[0]) || `https://${host}/`
    let html = null
    let snapSource = null

    const offlinePath = findOfflineHtml(host)
    if (offlinePath) {
      html = fs.readFileSync(offlinePath, 'utf8')
      snapSource = `fixture:${path.basename(offlinePath)}`
      offlineSnaps++
    } else if (args.playwright) {
      const pw = await tryPlaywrightHydrate(url)
      if (pw.ok) {
        html = pw.html
        snapSource = 'playwright'
        pwSnaps++
      } else {
        playwrightNote.push({ host, ...pw })
        if (pw.reason === 'playwright_not_installed' && playwrightNote.length === 1) {
          console.warn('[warn] Playwright not installed — continuing without hydrate.')
          console.warn('       Optional: pnpm add -D playwright && npx playwright install chromium')
        }
      }
    }

    if (!html) {
      // Minimal synthetic stub so judge can still see hostname + sources
      html = `<html><head><title>${host}</title></head><body data-clarity-collector="stub"><p>No offline HTML; sources=${(lead.sources || []).join(',')}</p></body></html>`
      snapSource = 'stub'
      emptySnaps++
    }

    const snapshot = truncateSnapshot(html)
    const snapFile = path.join(snapshotDir, `${host.replace(/[^a-z0-9.-]/gi, '_')}.html`)
    fs.writeFileSync(snapFile, snapshot + '\n')

    // Light signal extraction for review
    const signals = { ...lead.signals, snapshotSource: snapSource }
    if (/isNSFW\s*:\s*true/i.test(html) || /"isNSFW"\s*:\s*true/i.test(html)) {
      signals.isNSFW = true
    }
    const adHits = [...ADULT_AD_NETWORKS].filter((a) => html.toLowerCase().includes(a))
    if (adHits.length) signals.adHostsEmbedded = adHits.slice(0, 8)

    upsertLead(leadMap, host, {
      signals,
      urls: [url],
    })
    const updated = leadMap.get(host)
    updated.snapshotFile = path.relative(args.outDir, snapFile)
    updated.snapshotChars = snapshot.length
  }

  console.log(`  snapshots: offline=${offlineSnaps} playwright=${pwSnaps} stub=${emptySnaps}`)

  let candidates = hosts.map((h) => classifyLead(leadMap.get(h), blocklist))
  candidates.sort((a, b) => a.domain.localeCompare(b.domain))

  const meta = {
    mode: args.live ? 'live+offline' : 'offline',
    playwright: args.playwright,
    searchLive: args.searchLive,
    max,
    seeds: peertubeSeeds,
    publicSeedFile: path.relative(EXT_ROOT, args.publicSeed),
    playwrightNote: playwrightNote.slice(0, 5),
    caps: { maxUrls: max, maxProbe: args.maxProbe },
    note: 'Bounded collector. No auto-prod. Feed review:candidates then human approve + FP gate + sign.',
  }

  const report = buildDiscoveryCompatible(candidates, meta)
  report.runLog = runLog

  fs.mkdirSync(args.outDir, { recursive: true })
  const jsonPath = path.join(args.outDir, 'collector-report.json')
  const csvPath = path.join(args.outDir, 'collector-candidates.csv')
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n')
  fs.writeFileSync(csvPath, toCsv(candidates))
  console.log(`\nWrote ${jsonPath}`)
  console.log(`Wrote ${csvPath}`)
  console.log('Counts:', report.counts)

  if (args.wireReview) {
    fs.mkdirSync(path.dirname(DISCOVERY_OUT), { recursive: true })
    fs.writeFileSync(DISCOVERY_OUT, JSON.stringify(report, null, 2) + '\n')
    fs.mkdirSync(path.dirname(CLARITY_DISCOVERY), { recursive: true })
    fs.writeFileSync(CLARITY_DISCOVERY, JSON.stringify(report, null, 2) + '\n')
    console.log(`Wired review: ${DISCOVERY_OUT}`)
    console.log(`Wired review: ${CLARITY_DISCOVERY}`)
  }

  // Offline smoke (default path)
  if (!args.live && !args.searchLive) {
    const okDiff = newFromDiff >= 1
    const okPartner = partnerAdds >= 1
    const okSnap = offlineSnaps + pwSnaps + emptySnaps >= 1
    const okReview = candidates.some((c) =>
      ['review', 'review_fixture', 'candidate_block'].includes(c.status)
    )
    if (!okDiff || !okPartner || !okSnap || !okReview) {
      console.error('FAIL collector fixture smoke:', { okDiff, okPartner, okSnap, okReview, counts: report.counts })
      process.exit(1)
    }
    console.log('PASS collector fixture smoke (diff + partner + snapshot + reviewable)')
  }

  console.log('\nNext: pnpm --filter @clarity/extension judge:misses')
  console.log('      pnpm --filter @clarity/extension review:candidates -- --list')
  console.log('      # or: review:candidates -- --from', jsonPath)
  console.log('Gate: do NOT promote/sign without human review + safe-corpus evals.')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e)
    process.exit(2)
  })
}
