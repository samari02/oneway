#!/usr/bin/env node
/**
 * Étape 5 — cheap judge on analyzer *miss* snapshots (2–4 KB).
 *
 * Default = OFFLINE heuristic (no network).
 * Optional LLM when CLARITY_JUDGE_API_KEY is set AND --llm is passed.
 *
 * Env (LLM only):
 *   CLARITY_JUDGE_API_KEY   required for --llm
 *   CLARITY_JUDGE_BASE_URL  default https://api.openai.com/v1
 *   CLARITY_JUDGE_MODEL     default gpt-4o-mini
 *
 * Usage:
 *   pnpm --filter @clarity/extension judge:misses
 *   pnpm --filter @clarity/extension judge:misses -- --llm
 *   pnpm --filter @clarity/extension judge:misses -- --in path/to.html --url https://x.example/
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIR = path.join(__dirname, '../eval/fixtures/misses')
const MANIFEST = path.join(FIXTURE_DIR, 'misses-manifest.json')
const DEFAULT_OUT = path.join(__dirname, '../eval/out/review/judge-results.json')

const MAX_SNAPSHOT_CHARS = 3500

const ADULT_AD_HINTS = [
  'magsrv.com', 'realsrv.com', 'exoclick.com', 'juicyads.com',
  'trafficjunky', 'tsyndicate.com', 'adxpansion.com',
]
const ADULT_LEXICON = [
  'fc2ppv', 'fc2', '無碼', 'av線上', 'isnsfw', 'peertube', 'avx-', 'porn', 'xxx', 'nsfw',
]
const SAFE_LEXICON = [
  'wikipedia', 'who.int', 'cdc.gov', 'medical students', 'reproductive health',
  'public-health', 'contraception', 'educational',
]

function parseArgs(argv) {
  const out = { llm: false, inFiles: [], url: '', out: DEFAULT_OUT, manifest: true }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') continue
    if (a === '--llm') out.llm = true
    else if (a === '--in') out.inFiles.push(argv[++i])
    else if (a === '--url') out.url = argv[++i]
    else if (a === '--out') out.out = path.resolve(argv[++i])
    else if (a === '--no-manifest') out.manifest = false
    else if (a === '--help' || a === '-h') out.help = true
  }
  return out
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

function offlineHeuristic({ id, url, snapshot }) {
  const text = `${url}\n${snapshot}`.toLowerCase()
  const hints = []
  let score = 0

  for (const ad of ADULT_AD_HINTS) {
    if (text.includes(ad)) {
      score += 25
      hints.push(`ad:${ad}`)
    }
  }
  for (const w of ADULT_LEXICON) {
    if (text.includes(w)) {
      score += 12
      hints.push(`lex:${w}`)
    }
  }
  for (const w of SAFE_LEXICON) {
    if (text.includes(w)) {
      score -= 15
      hints.push(`safe:${w}`)
    }
  }
  if (/data-pt-theme\s*=\s*["'][^"']*avx/i.test(snapshot)) {
    score += 20
    hints.push('fingerprint:avx-theme')
  }
  if (/peertube-container/i.test(snapshot)) {
    score += 10
    hints.push('fingerprint:peertube-shell')
  }

  let label = 'unclear'
  if (score >= 35) label = 'adult_likely'
  else if (score <= 0 && hints.some((h) => h.startsWith('safe:'))) label = 'safe_likely'
  else if (score <= 5) label = 'safe_likely'

  return {
    id,
    url,
    mode: 'offline_heuristic',
    label,
    confidence: Math.min(0.95, Math.max(0.35, Math.abs(score) / 80)),
    fingerprintHints: [...new Set(hints)].slice(0, 12),
    recommendBlock: label === 'adult_likely',
    snapshotChars: snapshot.length,
    notes: 'Offline heuristic — enable --llm + CLARITY_JUDGE_API_KEY for model judge',
  }
}

async function llmJudge({ id, url, snapshot }) {
  const key = process.env.CLARITY_JUDGE_API_KEY || ''
  if (!key) {
    throw new Error('CLARITY_JUDGE_API_KEY missing — LLM disabled')
  }
  const base = (process.env.CLARITY_JUDGE_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = process.env.CLARITY_JUDGE_MODEL || 'gpt-4o-mini'

  const system = `You classify short HTML snapshots for an adult-content blocker.
Return ONLY compact JSON:
{"label":"adult_likely"|"safe_likely"|"unclear","confidence":0-1,"fingerprintHints":["..."],"recommendBlock":bool,"engineGuess":"peertube|tube|ads|unknown"}
No prose. Prefer safe_likely when educational/medical.`

  const user = `URL: ${url}\nSNAPSHOT (${snapshot.length} chars):\n${snapshot}`

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`LLM HTTP ${res.status}: ${t.slice(0, 200)}`)
  }
  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content || '{}'
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = { label: 'unclear', confidence: 0.3, fingerprintHints: [], recommendBlock: false }
  }
  return {
    id,
    url,
    mode: 'llm',
    model,
    label: parsed.label || 'unclear',
    confidence: Number(parsed.confidence) || 0.4,
    fingerprintHints: Array.isArray(parsed.fingerprintHints) ? parsed.fingerprintHints.slice(0, 12) : [],
    engineGuess: parsed.engineGuess || 'unknown',
    recommendBlock: Boolean(parsed.recommendBlock),
    snapshotChars: snapshot.length,
  }
}

function loadJobs(args) {
  const jobs = []
  if (args.inFiles.length) {
    for (const f of args.inFiles) {
      const full = path.resolve(f)
      jobs.push({
        id: path.basename(full, path.extname(full)),
        file: full,
        url: args.url || `https://fixture.local/${path.basename(full)}`,
      })
    }
    return jobs
  }
  if (!args.manifest) return jobs
  const man = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  for (const fx of man.fixtures || []) {
    jobs.push({
      id: fx.id,
      file: path.join(FIXTURE_DIR, fx.file),
      url: fx.url,
      expectedOfflineLabel: fx.expectedOfflineLabel,
    })
  }
  return jobs
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(`Usage: judge-analyzer-misses [--llm] [--in file.html] [--url url] [--out path]
Default offline. --llm requires CLARITY_JUDGE_API_KEY (never committed).`)
    process.exit(0)
  }

  const wantLlm = args.llm
  if (wantLlm && !process.env.CLARITY_JUDGE_API_KEY) {
    console.warn('[warn] --llm requested but CLARITY_JUDGE_API_KEY unset → offline heuristic')
  }
  const useLlm = wantLlm && Boolean(process.env.CLARITY_JUDGE_API_KEY)

  const jobs = loadJobs(args)
  if (!jobs.length) {
    console.error('No miss fixtures found')
    process.exit(2)
  }

  const results = []
  for (const job of jobs) {
    const html = fs.readFileSync(job.file, 'utf8')
    const snapshot = truncateSnapshot(html)
    let judged
    if (useLlm) {
      try {
        judged = await llmJudge({ id: job.id, url: job.url, snapshot })
      } catch (e) {
        console.warn(`[warn] LLM failed for ${job.id}:`, e.message, '→ offline')
        judged = offlineHeuristic({ id: job.id, url: job.url, snapshot })
        judged.llmError = String(e.message || e)
      }
    } else {
      judged = offlineHeuristic({ id: job.id, url: job.url, snapshot })
    }
    if (job.expectedOfflineLabel && judged.mode === 'offline_heuristic') {
      judged.expectedOfflineLabel = job.expectedOfflineLabel
      judged.matchesExpected = judged.label === job.expectedOfflineLabel
    }
    results.push(judged)
    console.log(
      `  ${job.id}: ${judged.label} block=${judged.recommendBlock} [${judged.mode}] hints=${(judged.fingerprintHints || []).slice(0, 4).join(',')}`
    )
  }

  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode: useLlm ? 'llm' : 'offline_heuristic',
    llmEnabled: useLlm,
    safeNote: 'Judge never auto-ships. Feed hints into review:candidates after human approve + FP gate.',
    results,
  }

  fs.mkdirSync(path.dirname(args.out), { recursive: true })
  fs.writeFileSync(args.out, JSON.stringify(report, null, 2) + '\n')
  console.log(`Wrote ${args.out}`)

  // Offline smoke: expected labels must match when not using LLM
  if (!useLlm) {
    const bad = results.filter((r) => r.expectedOfflineLabel && r.matchesExpected === false)
    if (bad.length) {
      console.error('FAIL judge offline smoke:', bad.map((b) => b.id))
      process.exit(1)
    }
    console.log('PASS judge offline smoke')
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e)
    process.exit(2)
  })
}
