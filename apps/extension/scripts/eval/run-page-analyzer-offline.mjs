#!/usr/bin/env node
/**
 * Offline Clarity page-analyzer runner (cheap-agent scanner MVP — Étape 1).
 *
 * Bundles src/content/page-analyzer.ts with esbuild, loads HTML fixtures into
 * linkedom, and scores them with the same analyzePage() used in the extension.
 *
 * Also acts as a minimal safe-corpus smoke gate (Étape 2): any hard_negative*
 * fixture labeled "allow" that scores >= blockThreshold fails the process.
 *
 * Usage:
 *   node apps/extension/scripts/eval/run-page-analyzer-offline.mjs
 *   pnpm --filter @clarity/extension eval:page-analyzer
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseHTML } from 'linkedom'
import esbuild from 'esbuild'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXT_ROOT = path.resolve(__dirname, '../..')
const CORPUS_PATH = path.join(__dirname, 'fixtures/page-analyzer-corpus.json')
const BUNDLE_PATH = path.join(__dirname, '.cache/page-analyzer.bundle.mjs')
const ENTRY = path.join(EXT_ROOT, 'src/content/page-analyzer.ts')

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

async function bundleAnalyzer() {
  fs.mkdirSync(path.dirname(BUNDLE_PATH), { recursive: true })
  await esbuild.build({
    entryPoints: [ENTRY],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: ['es2022'],
    outfile: BUNDLE_PATH,
    logLevel: 'silent',
  })
  return import(pathToFileURL(BUNDLE_PATH).href + `?t=${Date.now()}`)
}

function installDomGlobals(html, pageUrl) {
  const { window, document } = parseHTML(html)

  // linkedom often lacks innerText — page-analyzer relies on it.
  const proto = window.Element?.prototype
  if (proto && !Object.getOwnPropertyDescriptor(proto, 'innerText')) {
    Object.defineProperty(proto, 'innerText', {
      configurable: true,
      get() {
        return this.textContent || ''
      },
      set(v) {
        this.textContent = v == null ? '' : String(v)
      },
    })
  }

  let loc
  try {
    loc = new URL(pageUrl)
  } catch {
    loc = new URL('https://example.invalid/')
  }

  // Minimal Location-like object (linkedom Location can be awkward to assign).
  const locationLike = {
    href: loc.href,
    protocol: loc.protocol,
    host: loc.host,
    hostname: loc.hostname,
    port: loc.port,
    pathname: loc.pathname,
    search: loc.search,
    hash: loc.hash,
    origin: loc.origin,
    toString() {
      return this.href
    },
  }

  try {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: locationLike,
    })
  } catch {
    window.location = locationLike
  }

  globalThis.window = window
  globalThis.document = document
  globalThis.HTMLElement = window.HTMLElement
  globalThis.Element = window.Element
  globalThis.Node = window.Node
  if (typeof globalThis.performance === 'undefined') {
    globalThis.performance = { now: () => Date.now() }
  }

  return { window, document }
}

function clearDomGlobals() {
  try {
    delete globalThis.window
    delete globalThis.document
  } catch {
    /* ignore */
  }
}

function predictBlock(result, threshold) {
  return Boolean(result?.isExplicit) || Number(result?.score || 0) >= threshold
}

async function main() {
  const corpus = loadJson(CORPUS_PATH)
  const threshold = Number(corpus.blockThreshold ?? 70)
  const fixtures = corpus.fixtures || []

  if (!fs.existsSync(ENTRY)) {
    console.error('Missing page-analyzer entry:', ENTRY)
    process.exit(2)
  }

  console.log('Bundling page-analyzer for Node…')
  const mod = await bundleAnalyzer()
  if (typeof mod.analyzePage !== 'function') {
    console.error('Bundle did not export analyzePage()')
    process.exit(2)
  }

  let tp = 0
  let tn = 0
  let fp = 0
  let fn = 0
  let hardNegFp = 0
  const rows = []

  for (const fix of fixtures) {
    const htmlPath = path.join(__dirname, 'fixtures', fix.file)
    if (!fs.existsSync(htmlPath)) {
      console.error('Missing fixture file:', htmlPath)
      process.exit(2)
    }
    const html = fs.readFileSync(htmlPath, 'utf8')
    installDomGlobals(html, fix.url)
    let result
    try {
      result = mod.analyzePage()
    } finally {
      clearDomGlobals()
    }

    const blocked = predictBlock(result, threshold)
    const expectBlock = fix.label === 'block'
    let verdict = 'ok'
    if (expectBlock && blocked) tp += 1
    else if (!expectBlock && !blocked) tn += 1
    else if (!expectBlock && blocked) {
      fp += 1
      verdict = 'FP'
      if (String(fix.category || '').startsWith('hard_negative')) {
        hardNegFp += 1
      }
    } else {
      fn += 1
      verdict = 'MISS'
    }

    rows.push({
      id: fix.id,
      label: fix.label,
      score: result?.score ?? 0,
      isExplicit: Boolean(result?.isExplicit),
      blocked,
      verdict,
      reasons: (result?.reasons || []).slice(0, 4).join(' | '),
    })
  }

  console.log('\nOffline page-analyzer results')
  console.log('threshold=', threshold, 'fixtures=', fixtures.length)
  console.table(
    rows.map((r) => ({
      id: r.id,
      label: r.label,
      score: r.score,
      blocked: r.blocked,
      verdict: r.verdict,
      reasons: r.reasons.slice(0, 80),
    }))
  )

  const precision = tp + fp === 0 ? 1 : tp / (tp + fp)
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn)
  console.log(
    `\nTP=${tp} TN=${tn} FP=${fp} FN=${fn}  precision=${precision.toFixed(3)} recall=${recall.toFixed(3)}`
  )

  // Étape 3 stub marker (not implemented yet — keep visible in CI logs).
  console.log(
    '\n[stub] dynamic signed domain/ad list channel — not implemented (Étape 3)'
  )

  if (hardNegFp > 0) {
    console.error(
      `\nFAIL: ${hardNegFp} safe-corpus hard-negative false positive(s)`
    )
    process.exit(1)
  }

  if (fn > 0) {
    console.error(`\nFAIL: ${fn} gold positive miss(es)`)
    process.exit(1)
  }

  console.log('\nPASS: offline page-analyzer + safe-corpus smoke')
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
