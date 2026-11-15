#!/usr/bin/env node
/**
 * Targeted adult-lead discovery (cheap-agent scanner Étape 4).
 *
 * Supported path = FIXTURES ONLY (offline / CI). No open-web crawl.
 *   1) PeerTube graph from fixtures: following + followers + config
 *   2) Ad/CDN pivots: scan known HTML for adult ad/CDN fingerprints
 *
 * Live PeerTube HTTP (`--live`) is OPTIONAL / MANUAL only — not part of
 * smoke/CI (CF, slow graphs, SIGTERM). Do not rely on it in automation.
 *
 * Outputs reviewable JSON + CSV. Never auto-ships to production signed list.
 * Optional --emit-sign-payload → unsigned payload for `sign:adult-list --in …`
 *
 * Usage:
 *   pnpm --filter @clarity/extension discover:adult-leads
 *   pnpm --filter @clarity/extension discover:adult-leads -- --emit-sign-payload
 *   # manual only: --live --seeds <host> --max-probe 5
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXT_ROOT = path.resolve(__dirname, '../..')
const SEEDS_PATH = path.join(__dirname, 'discovery-seeds.json')
const FIXTURE_DIR = path.join(__dirname, '../eval/fixtures/discovery')
const PAGE_FIXTURE_DIR = path.join(__dirname, '../eval/fixtures/page-analyzer')
const DEFAULT_OUT_DIR = path.join(__dirname, '../eval/out/discovery')
const CLARITY_DISCOVERY = path.join(os.homedir(), '.clarity/discovery-candidates.json')

/** Mirrors page-analyzer ADULT_AD_NETWORKS + PORN_IMAGE_CDN_HOSTS (keep in sync manually). */
const ADULT_AD_NETWORKS = [
  'exoclick.com', 'juicyads.com', 'trafficjunky.net', 'trafficjunky.com',
  'popads.net', 'adsterra.com', 'tsyndicate.com', 'ero-advertising.com',
  'plugrush.com', 'clickadu.com', 'adcash.com', 'hilltopads.com',
  'magsrv.com', 'realsrv.com', 'cpmstar.com', 'adxpansion.com',
]

const PORN_IMAGE_CDN_HOSTS = [
  'fpo.xxx', 'xgroovy.com', 'manyvids.com', 'blacked.com', 'jav.sb',
  'phncdn.com', 'xhcdn.com', 'pixhost.to', 'imagetwist.com', 'imagebam.com',
  'imgbox.com', 'erome.com',
]

/** Never emit these as signed-list domain candidates (safe / dual-use / demos). */
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

const USER_AGENT = 'ClarityDiscovery/0.1 (+targeted; no open crawl)'

function parseArgs(argv) {
  const out = {
    seeds: [],
    fixtures: false,
    live: false,
    probeConfig: true,
    emitSignPayload: false,
    outDir: DEFAULT_OUT_DIR,
    maxPages: 3,
    pageSize: 50,
    delayMs: 250,
    maxProbe: 20,
    probeFollowers: false,
    adHtmlDir: PAGE_FIXTURE_DIR,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') continue
    if (a === '--seeds') {
      out.seeds = String(argv[++i] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    } else if (a === '--fixtures') out.fixtures = true
    else if (a === '--live') out.live = true
    else if (a === '--no-probe-config') out.probeConfig = false
    else if (a === '--probe-followers') out.probeFollowers = true
    else if (a === '--emit-sign-payload') out.emitSignPayload = true
    else if (a === '--out') out.outDir = path.resolve(argv[++i])
    else if (a === '--max-pages') out.maxPages = Number(argv[++i]) || 3
    else if (a === '--page-size') out.pageSize = Number(argv[++i]) || 50
    else if (a === '--delay-ms') out.delayMs = Number(argv[++i]) || 0
    else if (a === '--max-probe') out.maxProbe = Number(argv[++i]) || 20
    else if (a === '--ad-html-dir') out.adHtmlDir = path.resolve(argv[++i])
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

function loadDefaultSeeds() {
  try {
    const doc = JSON.parse(fs.readFileSync(SEEDS_PATH, 'utf8'))
    return (doc.peertubeSeeds || []).map(normalizeHost).filter(Boolean)
  } catch {
    return ['pigav.com']
  }
}

async function fetchJson(url, { timeoutMs = 6000 } = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      redirect: 'follow',
    })
    const text = await res.text()
    if (!res.ok) {
      return { ok: false, status: res.status, reason: `http_${res.status}`, text: text.slice(0, 200) }
    }
    if (/^\s*</.test(text)) {
      return { ok: false, status: res.status, reason: 'html_not_json', text: text.slice(0, 120) }
    }
    try {
      return { ok: true, status: res.status, json: JSON.parse(text) }
    } catch {
      return { ok: false, status: res.status, reason: 'invalid_json' }
    }
  } catch (e) {
    return { ok: false, reason: e.name === 'AbortError' ? 'timeout' : 'network', error: String(e.message || e) }
  } finally {
    clearTimeout(t)
  }
}

function readFixture(seedHost, kind) {
  const p = path.join(FIXTURE_DIR, `${seedHost}.${kind}.json`)
  if (!fs.existsSync(p)) return null
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function fixturesOnly(args) {
  return Boolean(args.fixtures) && !args.live
}

async function loadPeerTubeList(seedHost, kind, args) {
  const fix = readFixture(seedHost, kind)
  if (fixturesOnly(args)) {
    if (fix) return { ok: true, source: 'fixture', json: fix }
    return { ok: false, reason: 'no_fixture' }
  }

  // Live (optional fixture fallback on failure)
  const pages = []
  let start = 0
  for (let page = 0; page < args.maxPages; page++) {
    const url = `https://${seedHost}/api/v1/server/${kind}?start=${start}&count=${args.pageSize}&sort=-createdAt`
    const res = await fetchJson(url)
    if (!res.ok) {
      if (pages.length === 0) {
        if (fix) return { ok: true, source: 'fixture_fallback', json: fix, liveError: res }
        return res
      }
      break
    }
    pages.push(res.json)
    const data = res.json?.data || []
    const total = Number(res.json?.total ?? data.length)
    start += data.length
    if (!data.length || start >= total) break
    if (args.delayMs) await sleep(args.delayMs)
  }

  if (!pages.length) {
    if (fix) return { ok: true, source: 'fixture_fallback', json: fix }
    return { ok: false, reason: 'empty' }
  }
  const merged = {
    total: pages[0].total ?? pages.reduce((n, p) => n + (p.data?.length || 0), 0),
    data: pages.flatMap((p) => p.data || []),
  }
  return { ok: true, source: 'live', json: merged }
}

async function loadPeerTubeConfig(host, args) {
  const fix = readFixture(host, 'config')
  if (fixturesOnly(args)) {
    if (fix) return { ok: true, source: 'fixture', json: fix }
    return { ok: false, reason: 'no_fixture' }
  }
  const url = `https://${host}/api/v1/config`
  const res = await fetchJson(url)
  if (!res.ok) {
    if (fix) return { ok: true, source: 'fixture_fallback', json: fix, liveError: res }
  }
  return res
}

function hostsFromFollowGraph(json, edge) {
  const out = []
  for (const row of json?.data || []) {
    const node = edge === 'following' ? row.following : row.follower
    const host = normalizeHost(node?.host || node?.url)
    if (host) out.push(host)
  }
  return out
}

function extractConfigSignals(cfg) {
  const instance = cfg?.instance || cfg || {}
  return {
    isNSFW: typeof instance.isNSFW === 'boolean' ? instance.isNSFW : null,
    defaultNSFWPolicy:
      typeof instance.defaultNSFWPolicy === 'string' ? instance.defaultNSFWPolicy : null,
    shortDescription:
      typeof instance.shortDescription === 'string' ? instance.shortDescription : null,
    name: typeof instance.name === 'string' ? instance.name : null,
  }
}

function matchKnownFingerprint(host, catalog) {
  for (const apex of catalog) {
    if (host === apex || host.endsWith('.' + apex)) return apex
  }
  return null
}

function scanHtmlForAdPivots(html, pageUrl) {
  const foundAds = new Set()
  const foundCdns = new Set()
  const pageHost = normalizeHost(pageUrl || '')

  const urlRe = /https?:\/\/([a-z0-9.-]+\.[a-z]{2,})(?::\d+)?/gi
  let m
  while ((m = urlRe.exec(html))) {
    const host = normalizeHost(m[1])
    if (!host) continue
    const ad = matchKnownFingerprint(host, ADULT_AD_NETWORKS)
    if (ad) foundAds.add(ad)
    const cdn = matchKnownFingerprint(host, PORN_IMAGE_CDN_HOSTS)
    if (cdn) foundCdns.add(cdn)
  }

  // Also catch protocol-relative / bare host in script src
  for (const ad of ADULT_AD_NETWORKS) {
    if (html.toLowerCase().includes(ad)) foundAds.add(ad)
  }

  return {
    pageHost,
    adHosts: [...foundAds].sort(),
    cdnHosts: [...foundCdns].sort(),
    hit: foundAds.size > 0 || foundCdns.size > 0,
  }
}

function scanAdHtmlDir(dir) {
  const pivots = []
  if (!fs.existsSync(dir)) return pivots
  for (const name of fs.readdirSync(dir)) {
    if (!/\.html?$/i.test(name)) continue
    const full = path.join(dir, name)
    const html = fs.readFileSync(full, 'utf8')
    // Infer URL from filename conventions when possible
    let pageUrl = `https://fixture.local/${name}`
    if (name.includes('pigav')) pageUrl = 'https://pigav.com/'
    if (name.includes('globalinnovation')) pageUrl = 'https://globalinnovationdesign.org/'
    const hit = scanHtmlForAdPivots(html, pageUrl)
    if (hit.hit) {
      pivots.push({
        file: name,
        pageHost: hit.pageHost,
        adHosts: hit.adHosts,
        cdnHosts: hit.cdnHosts,
        source: 'ad_cdn_html_pivot',
      })
    }
  }
  return pivots
}

function upsertCandidate(map, domain, patch) {
  const d = normalizeHost(domain)
  if (!d) return
  const cur = map.get(d) || {
    domain: d,
    sources: [],
    signals: {},
    status: 'review',
  }
  for (const s of patch.sources || []) {
    if (!cur.sources.includes(s)) cur.sources.push(s)
  }
  cur.signals = { ...cur.signals, ...patch.signals }
  if (patch.status) cur.status = patch.status
  map.set(d, cur)
}

function classifyCandidate(c) {
  if (SAFE_DENYLIST.has(c.domain)) {
    return { ...c, status: 'deny_safe_corpus' }
  }
  if (c.signals?.isNSFW === false) {
    return { ...c, status: 'deny_peertube_sfw' }
  }
  if (c.signals?.isNSFW === true) {
    return { ...c, status: 'candidate_block' }
  }
  if ((c.signals?.adHostsEmbedded || []).length > 0) {
    return { ...c, status: 'candidate_block' }
  }
  if (c.domain.endsWith('.example')) {
    // Fixture placeholders stay review-only unless isNSFW probed true
    return { ...c, status: c.signals?.isNSFW === true ? 'candidate_block' : 'review_fixture' }
  }
  return { ...c, status: 'review' }
}

function toCsv(candidates) {
  const header = ['domain', 'status', 'sources', 'isNSFW', 'adHosts', 'cdnHosts']
  const lines = [header.join(',')]
  for (const c of candidates) {
    const row = [
      c.domain,
      c.status,
      `"${(c.sources || []).join('|')}"`,
      c.signals?.isNSFW === null || c.signals?.isNSFW === undefined
        ? ''
        : String(c.signals.isNSFW),
      `"${(c.signals?.adHostsEmbedded || []).join('|')}"`,
      `"${(c.signals?.cdnHostsEmbedded || []).join('|')}"`,
    ]
    lines.push(row.join(','))
  }
  return lines.join('\n') + '\n'
}

function buildSignPayload(candidates) {
  const domains = []
  const adHosts = new Set()
  for (const c of candidates) {
    if (c.status !== 'candidate_block') continue
    if (SAFE_DENYLIST.has(c.domain)) continue
    if (c.domain.endsWith('.example')) continue // never ship fixture placeholders
    domains.push(c.domain)
    for (const a of c.signals?.adHostsEmbedded || []) adHosts.add(a)
  }
  return {
    domains: [...new Set(domains)].sort(),
    adHosts: [...adHosts].sort(),
    _meta: {
      note: 'REVIEW THEN sign — not auto-prod. Run: pnpm --filter @clarity/extension sign:adult-list -- --sign --in <this-file>',
      safeCorpusGate: 'Required before promote/sign: eval:page-analyzer + eval:adult-blocking',
    },
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(`Usage: discover-adult-leads [--seeds host1,host2] [--emit-sign-payload]
  Default = fixtures only (offline). --live is manual/optional, not for CI.`)
    process.exit(0)
  }

  // Default: fixtures mode (offline smoke / CI). --live is manual opt-in only.
  if (!args.live && !args.fixtures) args.fixtures = true
  if (args.live) {
    console.warn(
      '[warn] --live is MANUAL/OPTIONAL — not used in CI. Prefer fixtures. Bounding probes with --max-probe.'
    )
  }

  const seeds = (args.seeds.length ? args.seeds : loadDefaultSeeds())
    .map(normalizeHost)
    .filter(Boolean)

  const candidateMap = new Map()
  const runLog = []

  console.log(`Discovery Étape 4 — seeds=${seeds.join(',')} mode=${args.live ? 'live(manual)' : 'fixtures'}`)

  for (const seed of seeds) {
    upsertCandidate(candidateMap, seed, {
      sources: ['seed'],
      signals: {},
    })

    for (const kind of ['following', 'followers']) {
      const list = await loadPeerTubeList(seed, kind, args)
      runLog.push({ seed, kind, ok: list.ok, source: list.source, reason: list.reason })
      if (!list.ok) {
        console.warn(`  ! ${seed} ${kind}:`, list.reason || list.status, list.liveError?.reason || '')
        continue
      }
      const hosts = hostsFromFollowGraph(list.json, kind === 'following' ? 'following' : 'follower')
      console.log(`  ${seed} ${kind}: ${hosts.length} hosts (${list.source})`)
      for (const h of hosts) {
        upsertCandidate(candidateMap, h, {
          sources: [`peertube_${kind}:${seed}`],
        })
      }
    }

    if (args.probeConfig) {
      const cfg = await loadPeerTubeConfig(seed, args)
      if (cfg.ok) {
        const sig = extractConfigSignals(cfg.json)
        upsertCandidate(candidateMap, seed, {
          sources: [`peertube_config:${cfg.source}`],
          signals: sig,
        })
        console.log(`  ${seed} config isNSFW=${sig.isNSFW} (${cfg.source})`)
      } else {
        console.warn(`  ! ${seed} config:`, cfg.reason || cfg.status)
      }
    }
  }

  // Probe config for discovered PeerTube sisters (bounded — only graph hosts, not open crawl).
  // Default: prefer hosts reached via *following* (higher signal); followers need --probe-followers.
  if (args.probeConfig) {
    const allDiscovered = [...candidateMap.keys()].filter((h) => !seeds.includes(h))
    const followingHosts = allDiscovered.filter((h) => {
      const c = candidateMap.get(h)
      return (c?.sources || []).some((s) => String(s).startsWith('peertube_following:'))
    })
    const toProbe = args.probeFollowers ? allDiscovered : followingHosts
    const probeCap = Math.max(0, args.maxProbe)
    const probeList = toProbe.slice(0, probeCap)
    if (toProbe.length > probeList.length || (!args.probeFollowers && allDiscovered.length > followingHosts.length)) {
      console.log(
        `  probe set: ${probeList.length} hosts (following-priority, --max-probe ${probeCap}; use --probe-followers to include follower graph)`
      )
    }
    for (const host of probeList) {
      if (args.delayMs && args.live) await sleep(args.delayMs)
      const cfg = await loadPeerTubeConfig(host, args)
      if (!cfg.ok) {
        console.warn(`  ! probe ${host}:`, cfg.reason || cfg.status)
        continue
      }
      const sig = extractConfigSignals(cfg.json)
      upsertCandidate(candidateMap, host, {
        sources: [`peertube_config:${cfg.source || 'live'}`],
        signals: sig,
      })
      console.log(`  probe ${host} isNSFW=${sig.isNSFW} (${cfg.source || 'live'})`)
    }
  }

  // Ad / CDN pivots from known HTML fixtures (ingest domains that embed fingerprints)
  const pivots = scanAdHtmlDir(args.adHtmlDir)
  console.log(`  ad/CDN HTML pivots: ${pivots.length} files with hits`)
  for (const p of pivots) {
    if (p.pageHost && !p.pageHost.includes('fixture.local')) {
      upsertCandidate(candidateMap, p.pageHost, {
        sources: [`ad_cdn_html:${p.file}`],
        signals: {
          adHostsEmbedded: p.adHosts,
          cdnHostsEmbedded: p.cdnHosts,
        },
      })
    }
    // Structure to ingest: any page embedding adult ads becomes a review lead
    for (const ad of p.adHosts) {
      upsertCandidate(candidateMap, ad, {
        sources: [`ad_network_fingerprint:${p.file}`],
        signals: { role: 'ad_network' },
        status: 'ad_network_known',
      })
    }
  }

  let candidates = [...candidateMap.values()].map(classifyCandidate)
  candidates.sort((a, b) => a.domain.localeCompare(b.domain))

  // Ad networks themselves are not "block domain" candidates in the same sense —
  // keep them listed but tagged; signed payload uses adHosts field.
  candidates = candidates.map((c) => {
    if (c.signals?.role === 'ad_network' || ADULT_AD_NETWORKS.includes(c.domain)) {
      return { ...c, status: 'ad_host' }
    }
    return c
  })

  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode: args.live ? 'live' : 'fixtures',
    seeds,
    runLog,
    counts: {
      total: candidates.length,
      candidate_block: candidates.filter((c) => c.status === 'candidate_block').length,
      review: candidates.filter((c) => c.status.startsWith('review')).length,
      denied: candidates.filter((c) => c.status.startsWith('deny')).length,
      ad_host: candidates.filter((c) => c.status === 'ad_host').length,
    },
    safeCorpusNote:
      'No auto-ship. Run eval:page-analyzer + eval:adult-blocking before signing/promoting.',
    candidates,
    adPivots: pivots,
  }

  fs.mkdirSync(args.outDir, { recursive: true })
  const jsonPath = path.join(args.outDir, 'discovery-report.json')
  const csvPath = path.join(args.outDir, 'discovery-candidates.csv')
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n')
  fs.writeFileSync(csvPath, toCsv(candidates))

  fs.mkdirSync(path.dirname(CLARITY_DISCOVERY), { recursive: true })
  fs.writeFileSync(CLARITY_DISCOVERY, JSON.stringify(report, null, 2) + '\n')

  console.log(`\nWrote ${jsonPath}`)
  console.log(`Wrote ${csvPath}`)
  console.log(`Wrote ${CLARITY_DISCOVERY}`)
  console.log('Counts:', report.counts)

  if (args.emitSignPayload) {
    const payload = buildSignPayload(candidates)
    const payloadPath = path.join(args.outDir, 'sign-payload.candidates.json')
    fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2) + '\n')
    console.log(`Wrote ${payloadPath} (domains=${payload.domains.length} adHosts=${payload.adHosts.length})`)
    console.log('NOT signed — review, then: pnpm --filter @clarity/extension sign:adult-list -- --sign --in', payloadPath)
    if (payload.domains.length === 0) {
      console.log('(No non-fixture candidate_block domains yet — expected under --fixtures with *.example hosts.)')
    }
  }

  console.log('\nGate: do NOT promote/sign without human review + safe-corpus evals.')

  // Offline smoke assertions (fixtures mode only)
  if (fixturesOnly(args)) {
    const okGraph = runLog.some((r) => r.ok && r.kind === 'following')
    const okPivot = pivots.length >= 1
    const okBlock = report.counts.candidate_block >= 1
    if (!okGraph || !okPivot || !okBlock) {
      console.error('FAIL fixture smoke:', { okGraph, okPivot, okBlock, counts: report.counts })
      process.exit(1)
    }
    console.log('PASS fixture smoke (graph + ad pivot + candidate_block)')
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e)
    process.exit(2)
  })
}
