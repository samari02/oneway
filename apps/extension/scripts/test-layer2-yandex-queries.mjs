#!/usr/bin/env node
/**
 * Focused Layer 2 scoring tests for soft/coded queries observed on yandex.by.
 * Atlas host matching is covered by test-search-engine-atlas.mjs; this catches
 * lexicon gaps that let adult SERPs through after SafeSearch (family=yes).
 *
 * Run: node apps/extension/scripts/test-layer2-yandex-queries.mjs
 */

import esbuild from 'esbuild'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXT_ROOT = path.resolve(__dirname, '..')
const outfile = path.join(os.tmpdir(), `clarity-layer2-score-${process.pid}.mjs`)

await esbuild.build({
  entryPoints: [path.join(EXT_ROOT, 'src/shared/keywords/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  // also pull normalizer via a thin wrapper — build keywords only; normalize inline
})

const {
  getExplicitKeywordScore,
  analyzeSuspiciousCombinations,
  checkMultilangKeywords,
} = await import(pathToFileURL(outfile).href)

function normalizeLite(q) {
  return q.toLowerCase().trim().replace(/\s+/g, ' ')
}

function scoreQuery(query) {
  const normalized = normalizeLite(query)
  const ex = getExplicitKeywordScore(normalized)
  const sus = analyzeSuspiciousCombinations(normalized)
  const ml = checkMultilangKeywords(query)
  const total =
    (ex.found ? ex.score : 0) +
    (sus.isSuspicious ? sus.score : 0) +
    (ml.found ? ml.score : 0)
  const action = total >= 50 ? 'block' : total >= 20 ? 'warn' : 'allow'
  return { total, action, ex: ex.matchedTerms, sus: sus.matchedCombination, ml: ml.matchedTerms }
}

let failed = 0
function assert(cond, msg) {
  if (!cond) {
    failed++
    console.error('FAIL:', msg)
  } else {
    console.log('ok:', msg)
  }
}

// Hard explicit — baseline (atlas path already verified live)
assert(scoreQuery('porn').action === 'block', 'porn → block')

// Soft/coded yandex.by SERP queries from real Chrome history
const softBlock = [
  'JKの反応検査 video',
  'jap pcolle',
  'pcolle',
  'medical check jap ero vid',
  'エロ',
]
for (const q of softBlock) {
  const r = scoreQuery(q)
  assert(r.action === 'block', `${JSON.stringify(q)} → block (got ${r.action}, score ${r.total}, ${JSON.stringify(r)})`)
}

// Combination warn/block: jap + video / colle
const combo = scoreQuery('jap closeup 4k colle')
assert(
  combo.action === 'block' || combo.action === 'warn',
  `jap closeup 4k colle → warn|block (got ${combo.action}, score ${combo.total})`
)
// Prefer block when jap + colle
assert(combo.total >= 30, `jap closeup 4k colle score >= 30 (got ${combo.total})`)

// Benign must stay allow
for (const q of ['weather tokyo', 'cancer treatment research', 'university history course']) {
  const r = scoreQuery(q)
  assert(r.action === 'allow', `${JSON.stringify(q)} stays allow (got ${r.action})`)
}

try {
  fs.unlinkSync(outfile)
} catch {
  /* ignore */
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll Layer 2 yandex soft-query checks passed.')
