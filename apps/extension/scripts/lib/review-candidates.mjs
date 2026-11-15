#!/usr/bin/env node
/**
 * Étape 5 — dev review surface for discovery / judge candidates.
 *
 * Practical CLI (primary) + writes a static review-board.json for the minimal HTML UI.
 * Approve → unsigned sign-payload (still requires human sign:adult-list).
 * Reject → recorded, never shipped.
 *
 * Never auto-prod. FP gate still required before promote/sign.
 *
 * Usage:
 *   pnpm --filter @clarity/extension review:candidates -- --list
 *   pnpm --filter @clarity/extension review:candidates -- --approve globalinnovationdesign.org,pigav.com
 *   pnpm --filter @clarity/extension review:candidates -- --reject avx-skin.example
 *   pnpm --filter @clarity/extension review:candidates -- --board
 *   pnpm --filter @clarity/extension review:candidates -- --serve   # 127.0.0.1 only
 */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_DISCOVERY = path.join(__dirname, '../eval/out/discovery/discovery-report.json')
const COLLECTOR_REPORT = path.join(__dirname, '../eval/out/collector/collector-report.json')
const FALLBACK_DISCOVERY = path.join(os.homedir(), '.clarity/discovery-candidates.json')
const DEFAULT_JUDGE = path.join(__dirname, '../eval/out/review/judge-results.json')
const OUT_DIR = path.join(__dirname, '../eval/out/review')
const STATE_PATH = path.join(OUT_DIR, 'review-state.json')
const BOARD_PATH = path.join(__dirname, '../eval/review/review-board.json')
const UI_PATH = path.join(__dirname, '../eval/review/index.html')
const APPROVED_PAYLOAD = path.join(OUT_DIR, 'approved-sign-payload.json')

function parseArgs(argv) {
  const out = {
    list: false,
    board: false,
    serve: false,
    port: 8765,
    approve: [],
    reject: [],
    from: null,
    judge: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') continue
    if (a === '--list') out.list = true
    else if (a === '--board') out.board = true
    else if (a === '--serve') out.serve = true
    else if (a === '--port') out.port = Number(argv[++i]) || 8765
    else if (a === '--approve') {
      out.approve = String(argv[++i] || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    } else if (a === '--reject') {
      out.reject = String(argv[++i] || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    } else if (a === '--from') out.from = path.resolve(argv[++i])
    else if (a === '--judge') out.judge = path.resolve(argv[++i])
    else if (a === '--help' || a === '-h') out.help = true
  }
  return out
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function resolveDiscovery(args) {
  if (args.from && fs.existsSync(args.from)) return args.from
  if (fs.existsSync(DEFAULT_DISCOVERY)) return DEFAULT_DISCOVERY
  if (fs.existsSync(COLLECTOR_REPORT)) return COLLECTOR_REPORT
  if (fs.existsSync(FALLBACK_DISCOVERY)) return FALLBACK_DISCOVERY
  return null
}

function loadState() {
  if (!fs.existsSync(STATE_PATH)) {
    return { version: 1, approved: [], rejected: [], updatedAt: null }
  }
  return loadJson(STATE_PATH)
}

function saveState(state) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  state.updatedAt = new Date().toISOString()
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n')
}

function mergeRows(discovery, judge, state) {
  const judgeByHost = new Map()
  for (const r of judge?.results || []) {
    try {
      const host = new URL(r.url).hostname.replace(/^www\./, '')
      judgeByHost.set(host, r)
    } catch {
      /* ignore */
    }
  }

  const approved = new Set(state.approved || [])
  const rejected = new Set(state.rejected || [])

  return (discovery.candidates || []).map((c) => {
    const j = judgeByHost.get(c.domain)
    let decision = 'pending'
    if (approved.has(c.domain)) decision = 'approved'
    if (rejected.has(c.domain)) decision = 'rejected'
    return {
      domain: c.domain,
      status: c.status,
      sources: c.sources || [],
      signals: c.signals || {},
      decision,
      judge: j
        ? {
            label: j.label,
            recommendBlock: j.recommendBlock,
            fingerprintHints: j.fingerprintHints || [],
            mode: j.mode,
          }
        : null,
    }
  })
}

function buildApprovedPayload(rows) {
  const domains = []
  const adHosts = new Set()
  for (const r of rows) {
    if (r.decision !== 'approved') continue
    if (r.domain.endsWith('.example')) continue
    if (String(r.status || '').startsWith('deny')) continue
    if (r.status === 'ad_host') {
      adHosts.add(r.domain)
      continue
    }
    domains.push(r.domain)
    for (const a of r.signals?.adHostsEmbedded || []) adHosts.add(a)
  }
  return {
    domains: [...new Set(domains)].sort(),
    adHosts: [...adHosts].sort(),
    _meta: {
      note: 'Human-approved only. Still run eval:page-analyzer + eval:adult-blocking before sign:adult-list.',
      fpGateRequired: true,
      autoProd: false,
    },
  }
}

function writeBoard(rows, meta) {
  const board = {
    version: 1,
    generatedAt: new Date().toISOString(),
    ...meta,
    rows,
    instructions:
      'Use CLI --approve/--reject to update. Then sign:adult-list --sign --in approved-sign-payload.json after FP gate.',
  }
  fs.mkdirSync(path.dirname(BOARD_PATH), { recursive: true })
  fs.writeFileSync(BOARD_PATH, JSON.stringify(board, null, 2) + '\n')
  return BOARD_PATH
}

function ensureUiHtml() {
  if (fs.existsSync(UI_PATH)) return
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Clarity — candidate review</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 24px; max-width: 960px; color: #111; }
    h1 { font-size: 1.25rem; margin: 0 0 8px; }
    .meta { color: #555; font-size: 0.9rem; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
    th, td { border-bottom: 1px solid #ddd; padding: 8px 6px; text-align: left; vertical-align: top; }
    th { color: #333; font-weight: 600; }
    .approved { color: #0a7; }
    .rejected { color: #a33; }
    .pending { color: #888; }
    code { font-size: 0.85em; }
  </style>
</head>
<body>
  <h1>Clarity candidate review (dev)</h1>
  <p class="meta">Read-only board. Approve/reject via CLI <code>review:candidates --approve/--reject</code>. No auto-prod.</p>
  <div id="meta" class="meta"></div>
  <table>
    <thead><tr><th>Domain</th><th>Decision</th><th>Status</th><th>Judge</th><th>Sources</th></tr></thead>
    <tbody id="tbody"></tbody>
  </table>
  <script>
    fetch('./review-board.json').then(r => r.json()).then(board => {
      document.getElementById('meta').textContent =
        (board.generatedAt || '') + ' · ' + (board.rows || []).length + ' rows · approved payload after CLI';
      const tb = document.getElementById('tbody');
      for (const row of board.rows || []) {
        const tr = document.createElement('tr');
        const j = row.judge ? (row.judge.label + (row.judge.recommendBlock ? ' / block' : '')) : '—';
        tr.innerHTML = '<td><code>' + row.domain + '</code></td>' +
          '<td class="' + row.decision + '">' + row.decision + '</td>' +
          '<td>' + row.status + '</td>' +
          '<td>' + j + '</td>' +
          '<td>' + (row.sources || []).slice(0, 3).join(', ') + '</td>';
        tb.appendChild(tr);
      }
    }).catch(e => { document.getElementById('meta').textContent = 'Load review-board.json failed: ' + e; });
  </script>
</body>
</html>
`
  fs.mkdirSync(path.dirname(UI_PATH), { recursive: true })
  fs.writeFileSync(UI_PATH, html)
}

function serveBoard(port) {
  ensureUiHtml()
  const root = path.dirname(UI_PATH)
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    let rel = url.pathname === '/' ? '/index.html' : url.pathname
    const file = path.normalize(path.join(root, rel))
    if (!file.startsWith(root)) {
      res.writeHead(403)
      res.end('forbidden')
      return
    }
    if (!fs.existsSync(file)) {
      res.writeHead(404)
      res.end('not found')
      return
    }
    const ext = path.extname(file)
    const type =
      ext === '.html' ? 'text/html' : ext === '.json' ? 'application/json' : 'text/plain'
    res.writeHead(200, { 'Content-Type': type })
    res.end(fs.readFileSync(file))
  })
  server.listen(port, '127.0.0.1', () => {
    console.log(`Review UI http://127.0.0.1:${port}/  (Ctrl+C to stop)`)
  })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(`Usage: review-candidates [--list] [--approve a,b] [--reject c] [--board] [--serve]
  --from discovery-report.json  --judge judge-results.json`)
    process.exit(0)
  }

  const discoveryPath = resolveDiscovery(args)
  if (!discoveryPath) {
    console.error(
      'No discovery/collector report. Run: pnpm --filter @clarity/extension collect:adult-leads\n' +
        '  (or discover:adult-leads)'
    )
    process.exit(2)
  }
  const discovery = loadJson(discoveryPath)
  const judgePath = args.judge || (fs.existsSync(DEFAULT_JUDGE) ? DEFAULT_JUDGE : null)
  const judge = judgePath ? loadJson(judgePath) : null

  let state = loadState()
  let changed = false
  for (const d of args.approve) {
    state.approved = [...new Set([...(state.approved || []), d])]
    state.rejected = (state.rejected || []).filter((x) => x !== d)
    changed = true
    console.log('approved', d)
  }
  for (const d of args.reject) {
    state.rejected = [...new Set([...(state.rejected || []), d])]
    state.approved = (state.approved || []).filter((x) => x !== d)
    changed = true
    console.log('rejected', d)
  }
  if (changed) saveState(state)

  const rows = mergeRows(discovery, judge, state)
  const payload = buildApprovedPayload(rows)
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(APPROVED_PAYLOAD, JSON.stringify(payload, null, 2) + '\n')

  if (args.list || args.board || args.approve.length || args.reject.length || !args.serve) {
    console.log(`Discovery: ${discoveryPath}`)
    if (judgePath) console.log(`Judge: ${judgePath}`)
    console.log(`State: ${STATE_PATH}`)
    for (const r of rows) {
      const j = r.judge ? ` judge=${r.judge.label}` : ''
      console.log(`  [${r.decision}] ${r.domain} (${r.status})${j}`)
    }
    console.log(
      `Approved payload domains=${payload.domains.length} adHosts=${payload.adHosts.length} → ${APPROVED_PAYLOAD}`
    )
    console.log('Gate: run eval:page-analyzer + eval:adult-blocking before sign:adult-list')
  }

  const boardPath = writeBoard(rows, {
    discoveryPath,
    judgePath,
    approvedCount: rows.filter((r) => r.decision === 'approved').length,
    rejectedCount: rows.filter((r) => r.decision === 'rejected').length,
  })
  ensureUiHtml()
  if (args.board || args.serve) {
    console.log(`Board: ${boardPath}`)
    console.log(`UI: ${UI_PATH}`)
  }

  if (args.serve) {
    serveBoard(args.port)
    return // keep process alive
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e)
    process.exit(2)
  })
}
