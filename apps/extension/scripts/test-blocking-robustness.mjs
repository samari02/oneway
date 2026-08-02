#!/usr/bin/env node
/**
 * Minimal robustness checks for Clarity blocking (P2).
 * Run: node apps/extension/scripts/test-blocking-robustness.mjs
 */

function isCjkKeyword(keyword) {
  return /[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]/.test(keyword)
}

function isShortLatinToken(keyword) {
  return keyword.length <= 3 && /^[a-z0-9]+$/i.test(keyword)
}

/** Mirrors page-analyzer keywordMatchesInText */
function keywordMatchesInText(text, keyword) {
  const keywordLower = keyword.toLowerCase()
  if (isCjkKeyword(keyword) || !/^[\x00-\x7F]*$/.test(keyword)) {
    return text.includes(keywordLower)
  }
  if (isShortLatinToken(keywordLower)) {
    const escaped = keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`\\b${escaped}\\b`, 'i').test(text)
  }
  return text.includes(keywordLower)
}

/** Extracted decision: would isExplicit (or score block) trigger redirect? */
function shouldIssueRedirect(result, blockThreshold = 70) {
  const signalCount = result.reasons.length
  const hasStrongAdultSignal = result.reasons.some(
    (r) => r.includes('Adult keyword in domain') || r.includes('Explicit keyword in title')
  )
  if (result.isExplicit) return true
  if (result.score >= blockThreshold && (signalCount >= 2 || hasStrongAdultSignal)) return true
  return false
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

// (a) JP keywords match without \b
const jpSample = '無料動画 人妻 エロ フェラ 中出し アダルトビデオ'
for (const kw of ['エロ', '人妻', 'フェラ', '中出し', 'アダルト']) {
  assert(keywordMatchesInText(jpSample, kw), `JP keyword "${kw}" matches in sample text`)
}

// Old broken behavior: short CJK with \b must NOT be required
assert(
  !new RegExp(`\\b${'エロ'}\\b`, 'i').test(jpSample),
  'control: \\b still fails for エロ (why we need script-aware matching)'
)

// Short Latin still uses boundaries (false-positive guard)
assert(!keywordMatchesInText('classical music class', 'ass'), 'short Latin "ass" does not match inside "class"')
assert(keywordMatchesInText('hot ass video', 'ass'), 'short Latin "ass" matches as a word')

// (b) isExplicit path would redirect
assert(
  shouldIssueRedirect({
    isExplicit: true,
    score: 100,
    reasons: ['Adult rating meta tag detected']
  }),
  'isExplicit=true issues redirect even with a single reason'
)
assert(
  shouldIssueRedirect({
    isExplicit: false,
    score: 80,
    reasons: ['Adult keyword in domain: "missav" found in missav123.jp']
  }),
  'strong adult domain signal + high score issues redirect'
)
assert(
  !shouldIssueRedirect({
    isExplicit: false,
    score: 75,
    reasons: ['Elevated media/text ratio: 9.0']
  }),
  'single weak signal does not redirect'
)

// DNR-style hostname substring (missav123.jp)
const missavRe = /^https?:\/\/[^/]*(missav|pornhub|xvideos)/
assert(missavRe.test('https://missav123.jp/'), 'DNR regex matches missav123.jp')
assert(!missavRe.test('https://en.wikipedia.org/wiki/Java'), 'DNR regex does not match wikipedia')

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll blocking robustness checks passed.')
