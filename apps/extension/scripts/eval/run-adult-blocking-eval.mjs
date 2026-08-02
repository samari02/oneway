#!/usr/bin/env node
/**
 * Offline adult-blocking eval (no Chrome session).
 *
 * Scores the current stack that can run without a browser:
 *   1) DNR exact requestDomains from public/rules.json
 *   2) DNR regexFilter rules from rules.json
 *   3) adult-blocklist.json domains (system seed / sync payload)
 *   4) hostname substring heuristics (adult-blocklist hostnameSubstrings
 *      + page-analyzer-equivalent patterns)
 *
 * Does NOT simulate Focus Mode DEFAULT_BLOCKLIST or full HTML page analysis.
 *
 * Usage:
 *   node apps/extension/scripts/eval/run-adult-blocking-eval.mjs
 *   pnpm --filter @clarity/extension eval:adult-blocking
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXT_ROOT = path.resolve(__dirname, '../..')
const RULES_PATH = path.join(EXT_ROOT, 'public/rules.json')
const BLOCKLIST_PATH = path.join(EXT_ROOT, 'public/adult-blocklist.json')
const CORPUS_PATH = path.join(__dirname, 'fixtures/adult-blocking-corpus.json')
const STRUCTURAL_CORPUS_PATH = path.join(
  __dirname,
  'fixtures/structural-blocking-corpus.json'
)

/** Compact known adult domains for offline structural scoring (mirrors page-analyzer). */
const KNOWN_ADULT_DOMAINS = [
  'pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com',
  'missav.com', 'javdb.com', 'javbus.com', 'avgle.com',
  'jable.tv', 'netflav.com', 'fanza.co.jp', 'xcolle.jp', 'pcolle.jp',
]

const ADULT_AD_NETWORKS = [
  'exoclick.com', 'juicyads.com', 'trafficjunky.net', 'trafficjunky.com',
  'popads.net', 'adsterra.com', 'tsyndicate.com', 'ero-advertising.com',
]

const ADULT_LINK_DOMAIN_THRESHOLD = 3

/** Mirrors page-analyzer DOMAIN_ADULT_PATTERNS (kept in sync manually / via blocklist). */
const FALLBACK_SUBSTRINGS = [
  'porn', 'xxx', 'sex', 'hentai', 'adult', 'erotic', 'nude',
  'nsfw', 'fetish', 'camgirl', 'escort', 'fap', 'jav', 'xnxx',
  'fanza', 'missav', 'javdb', 'javbus', 'avgle', 'njav', 'jable',
  'netflav', 'hpjav', '7mmtv', 'xcity', 'erovideo', 'fc2ppv',
  'sokmil', 'dxlive', 'chatpia', 'sukebei', 'tokyohot', 'tokyo-hot',
  '1pondo', 'caribbeancom', 'pacopaco', 'heyzo', 'mgstage',
  'eroterest', 'xcolle', 'pcolle', 'digiket', 'nyahentai', 'fc2live',
  'エロ', 'アダルト', '風俗', 'エロ動画', '無修正',
]

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function hostnameOf(urlOrDomain) {
  try {
    if (!/^https?:\/\//i.test(urlOrDomain)) {
      return urlOrDomain.toLowerCase().replace(/^www\./, '')
    }
    return new URL(urlOrDomain).hostname.toLowerCase()
  } catch {
    return String(urlOrDomain).toLowerCase()
  }
}

function registrableHints(host) {
  const parts = host.split('.').filter(Boolean)
  const out = new Set([host])
  if (parts.length >= 2) out.add(parts.slice(-2).join('.'))
  if (parts.length >= 3) out.add(parts.slice(-3).join('.'))
  out.add(host.replace(/^www\./, ''))
  return [...out]
}

/**
 * Chrome requestDomains matching (simplified): domain or any subdomain of listed domain.
 */
function matchesRequestDomain(host, listed) {
  const h = host.toLowerCase()
  const d = listed.toLowerCase()
  return h === d || h.endsWith('.' + d)
}

function buildMatcher({ rules, blocklist }) {
  const exactDomains = new Set()
  const regexes = []

  for (const r of rules) {
    for (const d of r.condition?.requestDomains || []) {
      exactDomains.add(d.toLowerCase())
    }
    if (r.condition?.regexFilter && r.action?.type === 'redirect') {
      try {
        regexes.push({
          id: r.id,
          re: new RegExp(r.condition.regexFilter, 'i'),
        })
      } catch (e) {
        console.warn('Invalid regex rule', r.id, e.message)
      }
    }
  }

  for (const d of blocklist.domains || []) {
    exactDomains.add(String(d).toLowerCase())
  }

  const substrings = [
    ...new Set([
      ...(blocklist.hostnameSubstrings || []),
      ...FALLBACK_SUBSTRINGS,
    ].map((s) => s.toLowerCase())),
  ]

  return function decide(url) {
    const host = hostnameOf(url)
    const reasons = []

    for (const listed of exactDomains) {
      if (matchesRequestDomain(host, listed)) {
        reasons.push(`exact-domain:${listed}`)
        break
      }
    }

    const absolute = /^https?:\/\//i.test(url) ? url : `https://${url}/`
    for (const { id, re } of regexes) {
      if (re.test(absolute)) {
        reasons.push(`dnr-regex:#${id}`)
        break
      }
    }

    // Domain heuristics (page-analyzer style). Ultra-generic Latin tokens only match
    // as a DNS label (or hyphenated label), not as a substring of "sexualhealth".
    const hostLower = host.toLowerCase()
    const GENERIC_HOST_TOKENS = new Set(['sex', 'adult', 'nude', 'ass'])
    for (const pat of substrings) {
      if (!pat) continue
      let hit = false
      if (GENERIC_HOST_TOKENS.has(pat)) {
        hit = hostLower.split('.').some((lab) => {
          if (lab === pat) return true
          return lab.split('-').includes(pat)
        })
      } else {
        hit = hostLower.includes(pat)
      }
      if (hit) {
        reasons.push(`hostname-substring:${pat}`)
        break
      }
    }

    return {
      blocked: reasons.length > 0,
      reasons,
      host,
    }
  }
}

function metrics(results) {
  let tp = 0
  let fp = 0
  let tn = 0
  let fn = 0
  const falsePositives = []
  const misses = []

  for (const r of results) {
    const shouldBlock = r.label === 'block'
    if (shouldBlock && r.blocked) tp++
    else if (!shouldBlock && r.blocked) {
      fp++
      falsePositives.push(r)
    } else if (!shouldBlock && !r.blocked) tn++
    else {
      fn++
      misses.push(r)
    }
  }

  const precision = tp + fp === 0 ? 0 : tp / (tp + fp)
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn)
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
  const n = results.length
  const positives = results.filter((r) => r.label === 'block').length
  const negatives = n - positives

  return {
    n,
    positives,
    negatives,
    tp,
    fp,
    tn,
    fn,
    precision,
    recall,
    f1,
    blockedPct: positives ? (tp / positives) * 100 : 0,
    missedPct: positives ? (fn / positives) * 100 : 0,
    falsePositivePct: negatives ? (fp / negatives) * 100 : 0,
    falsePositives,
    misses,
  }
}

function pct(x) {
  return `${(x * 100).toFixed(1)}%`
}

/**
 * Lightweight offline structural scorer (no DOM) — href/src/meta regex heuristics.
 */
function scoreStructuralHtml(html, extraAdultDomains = []) {
  const reasons = []
  let score = 0
  const known = new Set([
    ...KNOWN_ADULT_DOMAINS,
    ...extraAdultDomains.map((d) => String(d).toLowerCase()),
  ])

  if (/rating[^>]*content\s*=\s*["']adult/i.test(html) || /rta-5042/i.test(html)) {
    score += 100
    reasons.push('Adult rating / RTA meta')
  }

  const hrefHosts = [...html.matchAll(/href\s*=\s*["'](https?:\/\/[^"']+)["']/gi)].map(
    (m) => {
      try {
        return new URL(m[1]).hostname.replace(/^www\./, '').toLowerCase()
      } catch {
        return null
      }
    }
  ).filter(Boolean)

  const distinctAdult = new Set()
  for (const host of hrefHosts) {
    for (const d of known) {
      if (host === d || host.endsWith('.' + d)) {
        distinctAdult.add(host)
        break
      }
    }
  }
  if (distinctAdult.size >= ADULT_LINK_DOMAIN_THRESHOLD) {
    score += 75
    reasons.push(`Links to ≥${ADULT_LINK_DOMAIN_THRESHOLD} adult domains (${distinctAdult.size})`)
  } else if (distinctAdult.size >= 2) {
    score += 25
    reasons.push(`Links to known adult domains (${distinctAdult.size})`)
  } else if (distinctAdult.size === 1) {
    score += 10
    reasons.push('Link to known adult domain')
  }

  const srcHosts = [
    ...html.matchAll(/(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/gi),
  ].map((m) => {
    try {
      return new URL(m[1]).hostname.replace(/^www\./, '').toLowerCase()
    } catch {
      return null
    }
  }).filter(Boolean)

  const adHits = new Set()
  for (const host of srcHosts) {
    for (const n of ADULT_AD_NETWORKS) {
      if (host === n || host.endsWith('.' + n)) adHits.add(n)
    }
  }
  if (adHits.size >= 2) {
    score += 45
    reasons.push(`Adult ad networks: ${[...adHits].slice(0, 3).join(', ')}`)
  } else if (adHits.size === 1) {
    score += 30
    reasons.push(`Adult ad network: ${[...adHits][0]}`)
  }

  return {
    score,
    blocked: score >= 70,
    reasons,
  }
}

function runStructuralEval(blocklist) {
  if (!fs.existsSync(STRUCTURAL_CORPUS_PATH)) {
    console.log('\n(No structural corpus — skip)')
    return { hardNegFp: 0 }
  }
  const corpus = loadJson(STRUCTURAL_CORPUS_PATH)
  const extra = blocklist.domains || []
  console.log('\n=== Structural / self-improve HTML eval ===')
  console.log(`Fixtures: ${corpus.fixtures?.length ?? 0}`)

  let tp = 0
  let fp = 0
  let fn = 0
  const failures = []

  for (const f of corpus.fixtures || []) {
    const decision = scoreStructuralHtml(f.html || '', extra)
    const shouldBlock = f.label === 'block'
    const ok = shouldBlock === decision.blocked
    if (shouldBlock && decision.blocked) tp++
    else if (!shouldBlock && decision.blocked) {
      fp++
      failures.push({ ...f, ...decision, kind: 'FP' })
    } else if (shouldBlock && !decision.blocked) {
      fn++
      failures.push({ ...f, ...decision, kind: 'MISS' })
    }
    const mark = ok ? 'OK  ' : decision.blocked ? 'FP  ' : 'MISS'
    console.log(
      `  ${mark} ${f.id}  score=${decision.score}  [${f.category}]  ${decision.reasons.join('|') || '—'}`
    )
  }

  console.log(`Structural TP=${tp} FP=${fp} FN=${fn}`)
  const hardNegFp = failures.filter(
    (r) => r.kind === 'FP' && String(r.category || '').startsWith('hard_negative')
  )
  return { hardNegFp: hardNegFp.length, failures }
}

function main() {
  const rules = loadJson(RULES_PATH)
  const blocklist = loadJson(BLOCKLIST_PATH)
  const corpus = loadJson(CORPUS_PATH)
  const decide = buildMatcher({ rules, blocklist })

  const results = corpus.fixtures.map((f) => {
    const url = f.url || (f.domain ? `https://${f.domain}/` : '')
    const decision = decide(url)
    return {
      ...f,
      url,
      blocked: decision.blocked,
      reasons: decision.reasons,
      host: decision.host,
    }
  })

  const m = metrics(results)

  console.log('\n=== Clarity adult blocking offline eval ===')
  console.log(`Corpus: ${CORPUS_PATH}`)
  console.log(`Fixtures: ${m.n} (${m.positives} block / ${m.negatives} allow)`)
  console.log(`DNR+seed domains: ${blocklist.domains?.length ?? 0}`)
  console.log('')
  console.log(`Precision: ${pct(m.precision)}`)
  console.log(`Recall:    ${pct(m.recall)}`)
  console.log(`F1:        ${pct(m.f1)}`)
  console.log('')
  console.log(`Blocked% (of positives): ${m.blockedPct.toFixed(1)}%  (TP=${m.tp})`)
  console.log(`Missed%  (of positives): ${m.missedPct.toFixed(1)}%  (FN=${m.fn})`)
  console.log(`FP%      (of negatives): ${m.falsePositivePct.toFixed(1)}%  (FP=${m.fp})`)

  if (m.misses.length) {
    console.log(`\n--- Misses (should block, allowed) [${m.misses.length}] ---`)
    for (const r of m.misses.slice(0, 40)) {
      console.log(`  MISS  ${r.url}  [${r.category}]${r.notes ? ` — ${r.notes}` : ''}`)
    }
    if (m.misses.length > 40) console.log(`  … +${m.misses.length - 40} more`)
  }

  if (m.falsePositives.length) {
    console.log(`\n--- False positives (should allow, blocked) [${m.falsePositives.length}] ---`)
    for (const r of m.falsePositives.slice(0, 40)) {
      console.log(
        `  FP    ${r.url}  [${r.category}] reasons=${r.reasons.join('|')}${r.notes ? ` — ${r.notes}` : ''}`
      )
    }
    if (m.falsePositives.length > 40) console.log(`  … +${m.falsePositives.length - 40} more`)
  }

  if (!m.misses.length && !m.falsePositives.length) {
    console.log('\nNo domain-layer failures.')
  }

  const structural = runStructuralEval(blocklist)

  // Exit non-zero only on hard-negative FPs — keep informative for CI later
  const hardNegFp = m.falsePositives.filter((r) =>
    String(r.category || '').startsWith('hard_negative')
  )
  if (hardNegFp.length > 0) {
    console.error(`\nFAIL: ${hardNegFp.length} hard-negative false positive(s)`)
    process.exit(1)
  }
  if (structural.hardNegFp > 0) {
    console.error(`\nFAIL: ${structural.hardNegFp} structural hard-negative false positive(s)`)
    process.exit(1)
  }

  console.log('\nEval complete. Gate OK (no hard-negative FPs).')
  console.log('Promote loop: after promote:adult-candidates → generate:adult-blocklist → re-run this eval.')
}

main()
