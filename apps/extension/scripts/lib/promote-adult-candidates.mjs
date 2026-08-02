#!/usr/bin/env node
/**
 * Promote adult-block candidates → seed / DNR pipeline (additive).
 *
 * Reads candidates from (first found):
 *   1) --candidates <path>
 *   2) ~/.clarity/adult-blocklist-candidates.json  (native host sync)
 *   3) apps/extension/scripts/eval/fixtures/sample-adult-candidates.json (dev)
 *
 * Eligible when: hits >= MIN_HITS OR maxScore >= MIN_SCORE
 * Skips policy-sensitive dual-use platforms.
 * Never wipes existing lists on empty input.
 *
 * Writes additively to:
 *   - scripts/lib/promoted-adult-domains.json  (durable; generate unions this)
 *   - public/adult-blocklist.json domains       (immediate seed update)
 *
 * Then you MUST run eval:
 *   pnpm --filter @clarity/extension generate:adult-blocklist
 *   pnpm --filter @clarity/extension eval:adult-blocking
 *
 * Usage:
 *   node apps/extension/scripts/lib/promote-adult-candidates.mjs
 *   node apps/extension/scripts/lib/promote-adult-candidates.mjs --dry-run
 *   node apps/extension/scripts/lib/promote-adult-candidates.mjs --candidates ./dump.json
 *   pnpm --filter @clarity/extension promote:adult-candidates
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXT_ROOT = path.resolve(__dirname, '../..')
const BLOCKLIST_PATH = path.join(EXT_ROOT, 'public/adult-blocklist.json')
const PROMOTED_PATH = path.join(__dirname, 'promoted-adult-domains.json')
const SAMPLE_PATH = path.join(
  EXT_ROOT,
  'scripts/eval/fixtures/sample-adult-candidates.json'
)
const CLARITY_CANDIDATES = path.join(
  os.homedir(),
  '.clarity/adult-blocklist-candidates.json'
)

const MIN_HITS = 2
const MIN_SCORE = 70

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
])

function parseArgs(argv) {
  const out = {
    dryRun: false,
    candidates: null,
    useSample: false,
    minHits: MIN_HITS,
    minScore: MIN_SCORE,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--use-sample') out.useSample = true
    else if (a === '--candidates') out.candidates = argv[++i]
    else if (a === '--min-hits') out.minHits = Number(argv[++i]) || MIN_HITS
    else if (a === '--min-score') out.minScore = Number(argv[++i]) || MIN_SCORE
  }
  return out
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function normalizeDomain(raw) {
  if (typeof raw !== 'string') return null
  let s = raw.trim().toLowerCase()
  if (!s) return null
  s = s.replace(/^https?:\/\//, '').split('/')[0] || ''
  s = s.replace(/^www\./, '').replace(/^\.+|\.+$/g, '')
  if (!s.includes('.')) return null
  return s
}

function isPolicySensitive(domain) {
  const d = domain.toLowerCase()
  for (const p of POLICY_SENSITIVE) {
    if (d === p || d.endsWith('.' + p)) return true
  }
  return false
}

function extractCandidates(doc) {
  if (!doc) return []
  if (Array.isArray(doc)) return doc
  if (Array.isArray(doc.candidates)) return doc.candidates
  return []
}

function resolveCandidatesPath(cliPath, useSample) {
  if (cliPath) {
    if (!fs.existsSync(cliPath)) {
      throw new Error(`Candidates file not found: ${cliPath}`)
    }
    return cliPath
  }
  if (fs.existsSync(CLARITY_CANDIDATES)) return CLARITY_CANDIDATES
  if (useSample && fs.existsSync(SAMPLE_PATH)) return SAMPLE_PATH
  return null
}

function loadPromoted() {
  if (!fs.existsSync(PROMOTED_PATH)) {
    return { version: 1, updatedAt: new Date().toISOString().slice(0, 10), domains: [] }
  }
  const doc = loadJson(PROMOTED_PATH)
  const domains = Array.isArray(doc.domains)
    ? doc.domains
    : Array.isArray(doc)
      ? doc
      : []
  return {
    version: doc.version ?? 1,
    updatedAt: doc.updatedAt ?? new Date().toISOString().slice(0, 10),
    description: doc.description,
    domains: domains.map(normalizeDomain).filter(Boolean),
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const srcPath = resolveCandidatesPath(args.candidates, args.useSample)

  if (!srcPath) {
    console.log('No candidates file found.')
    console.log(`  Expected: ${CLARITY_CANDIDATES}`)
    console.log(`  Or pass --candidates <path>`)
    console.log(`  Or --use-sample for fixtures/sample-adult-candidates.json`)
    console.log('Nothing to promote (empty input never wipes).')
    process.exit(0)
  }

  const raw = loadJson(srcPath)
  const candidates = extractCandidates(raw)
  console.log(`\n=== Promote adult candidates ===`)
  console.log(`Source: ${srcPath}`)
  console.log(`Candidates: ${candidates.length}`)
  console.log(`Thresholds: hits>=${args.minHits} OR maxScore>=${args.minScore}`)

  if (!candidates.length) {
    console.log('Empty candidate list — no changes (never wipe).')
    process.exit(0)
  }

  const blocklist = loadJson(BLOCKLIST_PATH)
  const existing = new Set(
    (blocklist.domains || []).map((d) => normalizeDomain(d)).filter(Boolean)
  )
  const promotedDoc = loadPromoted()
  for (const d of promotedDoc.domains) existing.add(d)

  const proposed = []
  const skipped = []

  for (const c of candidates) {
    const domain = normalizeDomain(c.domain)
    if (!domain) {
      skipped.push({ domain: c.domain, why: 'invalid' })
      continue
    }
    if (isPolicySensitive(domain)) {
      skipped.push({ domain, why: 'policy_sensitive' })
      continue
    }
    const hits = Number(c.hits) || 0
    const maxScore = Number(c.maxScore ?? c.max_score) || 0
    if (hits < args.minHits && maxScore < args.minScore) {
      skipped.push({ domain, why: `below_threshold hits=${hits} score=${maxScore}` })
      continue
    }
    if (existing.has(domain)) {
      skipped.push({ domain, why: 'already_listed' })
      continue
    }
    proposed.push({
      domain,
      hits,
      maxScore,
      source: c.source || 'content_analysis',
      reasons: Array.isArray(c.reasons) ? c.reasons.slice(0, 3) : [],
    })
  }

  console.log(`\nProposed additions: ${proposed.length}`)
  for (const p of proposed.slice(0, 40)) {
    console.log(
      `  + ${p.domain}  (hits=${p.hits}, score=${p.maxScore}, source=${p.source})`
    )
  }
  if (proposed.length > 40) console.log(`  … +${proposed.length - 40} more`)

  const skipSensitive = skipped.filter((s) => s.why === 'policy_sensitive')
  if (skipSensitive.length) {
    console.log(`\nSkipped policy-sensitive: ${skipSensitive.map((s) => s.domain).join(', ')}`)
  }

  if (!proposed.length) {
    console.log('\nNo domains eligible for promotion.')
    process.exit(0)
  }

  if (args.dryRun) {
    console.log('\nDry run — no files written.')
    console.log('Re-run without --dry-run to apply, then:')
    console.log('  pnpm --filter @clarity/extension generate:adult-blocklist')
    console.log('  pnpm --filter @clarity/extension eval:adult-blocking')
    process.exit(0)
  }

  // Additive merge into promoted sidecar
  const newDomains = proposed.map((p) => p.domain)
  const mergedPromoted = [...new Set([...promotedDoc.domains, ...newDomains])].sort()
  const nextPromoted = {
    version: 1,
    updatedAt: new Date().toISOString().slice(0, 10),
    description:
      'Domains promoted from observe→learn candidates. generate:adult-blocklist unions this additively. Empty never wipes seed.',
    domains: mergedPromoted,
  }
  fs.writeFileSync(PROMOTED_PATH, JSON.stringify(nextPromoted, null, 2) + '\n')
  console.log(`\nWrote ${mergedPromoted.length} promoted domains → ${path.relative(EXT_ROOT, PROMOTED_PATH)}`)

  // Additive merge into public adult-blocklist.json (never wipe)
  const blDomains = [
    ...new Set([
      ...(blocklist.domains || []).map(normalizeDomain).filter(Boolean),
      ...newDomains,
    ]),
  ].sort()
  const nextBl = {
    ...blocklist,
    updatedAt: new Date().toISOString().slice(0, 10),
    domains: blDomains,
  }
  fs.writeFileSync(BLOCKLIST_PATH, JSON.stringify(nextBl, null, 2) + '\n')
  console.log(
    `Merged +${newDomains.length} into adult-blocklist.json (now ${blDomains.length} domains)`
  )

  console.log('\nNext (required gate):')
  console.log('  pnpm --filter @clarity/extension generate:adult-blocklist')
  console.log('  pnpm --filter @clarity/extension eval:adult-blocking')
  console.log('Fail the ship if hard-negative FPs appear.')
}

main()
