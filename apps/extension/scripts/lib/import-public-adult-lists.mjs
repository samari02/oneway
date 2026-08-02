#!/usr/bin/env node
/**
 * Import community NSFW host lists as a COMPLEMENT to Clarity’s JP-heavy curated seed.
 *
 * Sources (adult-tagged only):
 *   - oisd NSFW Small (Tranco ∩ NSFW) — github mirror
 *   - StevenBlack hosts porn-only alternate
 *
 * Never replaces curated EXPANSION_DOMAINS / existing seed. Writes a durable sidecar
 * that generate:adult-blocklist unions additively (empty never wipes).
 *
 * Caps size for extension / DNR limits (default 1500 new domains). Prefers:
 *   1) domains present in BOTH sources
 *   2) adult-keyword hostnames
 *   3) shorter / apex-ish labels
 *
 * Skips policy-sensitive dual-use platforms and hard-negative allow hosts from the
 * offline eval corpus when available.
 *
 * Usage:
 *   node apps/extension/scripts/lib/import-public-adult-lists.mjs
 *   node apps/extension/scripts/lib/import-public-adult-lists.mjs --dry-run
 *   node apps/extension/scripts/lib/import-public-adult-lists.mjs --cap 1000
 *   pnpm --filter @clarity/extension import:public-adult-lists
 *
 * Then required:
 *   pnpm --filter @clarity/extension generate:adult-blocklist
 *   pnpm --filter @clarity/extension eval:adult-blocking
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXT_ROOT = path.resolve(__dirname, '../..')
const BLOCKLIST_PATH = path.join(EXT_ROOT, 'public/adult-blocklist.json')
const IMPORTED_PATH = path.join(__dirname, 'imported-public-adult-domains.json')
const CORPUS_PATH = path.join(
  EXT_ROOT,
  'scripts/eval/fixtures/adult-blocking-corpus.json'
)

/** Default max *new* complement domains written to the sidecar (DNR grows ~2 rules each). */
export const DEFAULT_IMPORT_CAP = 1500

const SOURCES = [
  {
    id: 'oisd_nsfw_small',
    url: 'https://raw.githubusercontent.com/sjhgvr/oisd/refs/heads/main/domainswild2_nsfw_small.txt',
    format: 'domains',
    adultTagged: true,
  },
  {
    id: 'stevenblack_porn_only',
    url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/porn-only/hosts',
    format: 'hosts',
    adultTagged: true,
  },
]

/** Dual-use / mixed platforms — never hard-seed from public lists. */
const POLICY_SENSITIVE = new Set([
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
  'instagram.com',
  'facebook.com',
  'tiktok.com',
  'youtube.com',
  'google.com',
  'wikipedia.org',
  'amazon.com',
  'ebay.com',
  'etsy.com',
  'github.com',
  'gitlab.com',
  'stackoverflow.com',
  'linkedin.com',
  'microsoft.com',
  'apple.com',
  'cloudflare.com',
])

/**
 * Prefer domains that look adult-specific. Public porn lists still contain noise;
 * keyword preference + multi-source intersection reduces non-adult bleed.
 */
const ADULT_TOKEN_RE =
  /(porn|xxx|sex|hentai|adult|erotic|nude|nsfw|fetish|camgirl|escort|fap|jav|xnxx|onlyfans|fansly|xhamster|xvideos|pornhub|spankbang|chaturbate|stripchat|camwhores|bongacam|missav|fanza|avgle|jable|netflav|fc2ppv|doujin|nhentai|rule34|e621|gelbooru|redtube|youporn|tube8|brazzers|bangbros|realitykings|livejasmin|myfreecams|cam4|manyvids|clips4sale|sukebei|tokyohot|caribbeancom|heyzo|mgstage|eroterest|xcolle|pcolle)/i

const FETCH_TIMEOUT_MS = 90_000

function parseArgs(argv) {
  const out = {
    dryRun: false,
    cap: DEFAULT_IMPORT_CAP,
    offline: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--offline') out.offline = true
    else if (a === '--cap') {
      const n = Number(argv[++i])
      if (Number.isFinite(n) && n > 0) out.cap = Math.floor(n)
    }
  }
  return out
}

function normalizeDomain(raw) {
  if (typeof raw !== 'string') return null
  let s = raw.trim().toLowerCase()
  if (!s || s.startsWith('#')) return null
  s = s.replace(/^https?:\/\//, '').split('/')[0] || ''
  s = s.replace(/^\*\./, '')
  s = s.replace(/^www\./, '')
  s = s.replace(/^\.+|\.+$/g, '')
  if (!s.includes('.')) return null
  if (s.length > 80) return null
  if (!/^[a-z0-9.-]+$/.test(s)) return null
  if (/^\d+\.\d+\.\d+\.\d+$/.test(s)) return null
  if (['localhost', 'local', 'broadcasthost', 'ip6-localhost'].includes(s)) return null
  // Drop ultra-deep CDN-ish labels (noise)
  if (s.split('.').length > 4) return null
  return s
}

function isPolicySensitive(domain) {
  const d = domain.toLowerCase()
  for (const p of POLICY_SENSITIVE) {
    if (d === p || d.endsWith('.' + p)) return true
  }
  return false
}

/** True if domain or any registrable suffix is in the eval allow / skip set. */
function hitsAllowSkip(domain, allowSkip) {
  if (allowSkip.has(domain)) return true
  const parts = domain.split('.')
  for (let i = 1; i < parts.length - 1; i++) {
    const suffix = parts.slice(i).join('.')
    if (allowSkip.has(suffix)) return true
  }
  return false
}

function parseDomainsList(text) {
  const out = new Set()
  for (const line of text.split(/\r?\n/)) {
    const d = normalizeDomain(line.trim())
    if (d) out.add(d)
  }
  return out
}

function parseHostsFile(text) {
  const out = new Set()
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const m = t.match(/^(?:0\.0\.0\.0|127\.0\.0\.1)\s+(\S+)/i)
    if (!m) continue
    const d = normalizeDomain(m[1])
    if (d) out.add(d)
  }
  return out
}

async function fetchText(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'clarity-adult-blocklist-import/1.0' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

function loadExistingSeedDomains() {
  const set = new Set()
  if (fs.existsSync(BLOCKLIST_PATH)) {
    try {
      const doc = JSON.parse(fs.readFileSync(BLOCKLIST_PATH, 'utf8'))
      for (const d of doc.domains || []) {
        const n = normalizeDomain(d)
        if (n) set.add(n)
      }
    } catch (e) {
      console.warn('Could not read adult-blocklist.json:', e.message)
    }
  }
  return set
}

function loadHardNegativeAllowHosts() {
  const set = new Set()
  if (!fs.existsSync(CORPUS_PATH)) return set
  try {
    const corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8'))
    for (const f of corpus.fixtures || []) {
      if (f.label !== 'allow') continue
      try {
        const host = new URL(f.url).hostname.toLowerCase().replace(/^www\./, '')
        set.add(host)
        const parts = host.split('.').filter(Boolean)
        if (parts.length >= 2) set.add(parts.slice(-2).join('.'))
        if (parts.length >= 3) set.add(parts.slice(-3).join('.'))
      } catch {
        /* ignore */
      }
    }
  } catch (e) {
    console.warn('Could not read eval corpus for allow skips:', e.message)
  }
  return set
}

function scoreDomain(domain, sourceCount) {
  let s = 0
  if (sourceCount >= 2) s += 100
  if (ADULT_TOKEN_RE.test(domain)) s += 50
  const labels = domain.split('.').length
  if (labels <= 2) s += 20
  else if (labels === 3) s += 10
  if (domain.length <= 18) s += 5
  else if (domain.length <= 28) s += 2
  return s
}

function isNoise(domain) {
  // Obvious non-content / infra leftovers sometimes present in hosts merges
  if (/\.(cloudfront|akamai|akamaiedge|fastly|edgekey|edgesuite)\./i.test(domain)) return true
  if (/(^|\.)(tracking|tracker|metrics|telemetry|cdn-cgi)(\.|$)/i.test(domain)) return true
  // Extremely random multi-digit hash hosts
  if (/^[a-z0-9]{20,}\./i.test(domain) && !ADULT_TOKEN_RE.test(domain)) return true
  return false
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  console.log('\n=== Import public adult lists (complement) ===')
  console.log(`Cap: ${args.cap} new domains (default ${DEFAULT_IMPORT_CAP})`)
  console.log('Curated JP seed is never replaced — this is additive only.\n')

  if (args.offline) {
    console.error('--offline is reserved; fetch is required for a fresh import.')
    process.exit(1)
  }

  const bySource = new Map()
  for (const src of SOURCES) {
    process.stdout.write(`Fetching ${src.id}… `)
    try {
      const text = await fetchText(src.url)
      const set =
        src.format === 'hosts' ? parseHostsFile(text) : parseDomainsList(text)
      bySource.set(src.id, set)
      console.log(`${set.size} domains`)
    } catch (e) {
      console.log('FAILED')
      console.error(`  ${e.message}`)
      process.exit(1)
    }
  }

  const existing = loadExistingSeedDomains()
  const allowSkip = loadHardNegativeAllowHosts()
  console.log(`\nExisting seed domains: ${existing.size}`)
  console.log(`Eval allow hosts skipped: ${allowSkip.size}`)

  /** domain → Set<sourceId> */
  const membership = new Map()
  for (const [id, set] of bySource) {
    for (const d of set) {
      if (!membership.has(d)) membership.set(d, new Set())
      membership.get(d).add(id)
    }
  }

  const skipped = { policy: 0, existing: 0, allow: 0, noise: 0 }
  const ranked = []

  for (const [domain, sources] of membership) {
    if (isPolicySensitive(domain)) {
      skipped.policy++
      continue
    }
    if (existing.has(domain)) {
      skipped.existing++
      continue
    }
    if (hitsAllowSkip(domain, allowSkip)) {
      skipped.allow++
      continue
    }
    if (isNoise(domain)) {
      skipped.noise++
      continue
    }
    const sourceCount = sources.size
    const score = scoreDomain(domain, sourceCount)
    // Require multi-source OR adult token — drops most non-adult bleed from a single list
    if (sourceCount < 2 && !ADULT_TOKEN_RE.test(domain)) continue
    ranked.push({
      domain,
      score,
      sourceCount,
      sources: [...sources].sort(),
    })
  }

  ranked.sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain))
  const selected = ranked.slice(0, args.cap)

  const multi = selected.filter((x) => x.sourceCount >= 2).length
  const keyword = selected.filter((x) => ADULT_TOKEN_RE.test(x.domain)).length

  console.log(`\nRanked candidates: ${ranked.length}`)
  console.log(
    `Selected: ${selected.length} (multi-source=${multi}, adult-token=${keyword})`
  )
  console.log(
    `Skipped: policy=${skipped.policy} existing=${skipped.existing} allow=${skipped.allow} noise=${skipped.noise}`
  )
  console.log('Sample:', selected.slice(0, 12).map((x) => x.domain).join(', '))

  const doc = {
    version: 1,
    updatedAt: new Date().toISOString().slice(0, 10),
    description:
      'Public NSFW list complement (oisd NSFW small ∩ StevenBlack porn-only, capped). generate:adult-blocklist unions this additively. Never replaces JP curated seed. Empty never wipes.',
    cap: args.cap,
    sources: SOURCES.map((s) => ({
      id: s.id,
      url: s.url,
      format: s.format,
      adultTagged: s.adultTagged,
      fetchedCount: bySource.get(s.id)?.size ?? 0,
    })),
    stats: {
      ranked: ranked.length,
      selected: selected.length,
      multiSource: multi,
      adultToken: keyword,
      skipped,
    },
    domains: selected.map((x) => x.domain).sort(),
  }

  if (args.dryRun) {
    console.log('\nDry run — no files written.')
    console.log('Re-run without --dry-run to write imported-public-adult-domains.json, then:')
    console.log('  pnpm --filter @clarity/extension generate:adult-blocklist')
    console.log('  pnpm --filter @clarity/extension eval:adult-blocking')
    process.exit(0)
  }

  fs.writeFileSync(IMPORTED_PATH, JSON.stringify(doc, null, 2) + '\n')
  console.log(
    `\nWrote ${doc.domains.length} complement domains → ${path.relative(EXT_ROOT, IMPORTED_PATH)}`
  )
  console.log('\nNext (required gate):')
  console.log('  pnpm --filter @clarity/extension generate:adult-blocklist')
  console.log('  pnpm --filter @clarity/extension eval:adult-blocking')
  console.log('Abort ship if hard-negative FPs appear; shrink --cap if needed.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
