/**
 * Page Content Analyzer — Layer 3
 * 
 * Analyzes HTML content of pages to detect explicit material.
 * Runs in content script context.
 * 
 * See docs/blocking/content-analysis.md for full algorithm documentation.
 */

import type { ContentAnalysisResult } from '../shared/types'

// ============================================================================
// KEYWORD LISTS (duplicated here since content scripts can't import from shared)
// ============================================================================

const EXPLICIT_KEYWORDS = [
  // English — instant block
  'porn', 'porno', 'xxx', 'hentai', 'pornhub', 'xvideos', 'xhamster',
  'redtube', 'youporn', 'brazzers', 'onlyfans', 'chaturbate',
  // English — high suspicion
  'nsfw', 'nude', 'naked', 'sex video', 'adult video', 'erotic',
  'camgirl', 'camboy', 'livecam', 'webcam sex', 'stripchat',
  'escort', 'stripper', 'fansly',
  // English — medium
  'boobs', 'tits', 'ass', 'pussy', 'dick', 'cock', 'milf', 'teen porn',
  'dilf', 'threesome', 'gangbang', 'anal', 'blowjob', 'handjob',
  'creampie', 'facial', 'cumshot', 'deepthroat', 'bondage', 'bdsm',
  'fetish', 'dominatrix', 'mistress', 'submissive', 'cuckold',
  'swinger', 'orgy', 'voyeur', 'exhibitionist', 'pegging',

  // French
  'érotique', 'pornographie', 'sexe', 'nudité', 'porno',
  'seins', 'bite', 'chatte', 'salope', 'putain', 'baise', 'baiser',
  'jouir', 'orgasme', 'sodomie', 'fellation', 'cunnilingus', 'sextoy',
  'webcam adulte', 'libertinage', 'libertin', 'échangisme', 'masturbation',

  // Japanese
  'ポルノ', 'アダルト', 'エロ', 'エッチ', 'セックス', '無修正',
  'オナニー', '巨乳', '美乳', '痴女', '熟女', '素人',
  'ロリ', 'フェラ', 'パイズリ', '中出し', '顔射', '潮吹き',
  '乱交', '痴漢', 'レイプ', '近親相姦', '人妻', '不倫',
  '緊縛', '調教', '風俗', 'ソープランド', 'デリヘル', 'ヘルス',
  'キャバクラ', 'おっぱい', 'まんこ', 'ちんこ', '裏ビデオ',
  '無料動画', 'アダルトビデオ', '同人', '18禁',
  'R18', 'R-18', 'FANZA', 'ecchi',
] as const

const DOMAIN_ADULT_PATTERNS = [
  'porn', 'xxx', 'sex', 'hentai', 'adult', 'erotic', 'nude',
  'nsfw', 'fetish', 'camgirl', 'escort', 'fap', 'jav', 'xnxx',
  // JP / Asia adult long-tail (keep specific to limit false positives)
  'fanza', 'missav', 'javdb', 'javbus', 'avgle', 'njav', 'jable',
  'netflav', 'hpjav', '7mmtv', 'xcity', 'erovideo', 'fc2ppv',
  'sokmil', 'dxlive', 'chatpia', 'sukebei', 'tokyohot', 'tokyo-hot',
  '1pondo', 'caribbeancom', 'pacopaco', 'heyzo', 'mgstage',
  'eroterest',

  'エロ', 'アダルト', '風俗', 'エロ動画', '無修正',
] as const

/** Compact allowlist of known adult registrable domains (link / host signals) */
const KNOWN_ADULT_DOMAINS = [
  'pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com',
  'redtube.com', 'youporn.com', 'brazzers.com', 'onlyfans.com',
  'chaturbate.com', 'stripchat.com', 'fansly.com',
  'missav.com', 'missav.ws', 'javdb.com', 'javbus.com', 'avgle.com',
  'jable.tv', 'netflav.com', 'hpjav.tv', 'supjav.com',
  'fanza.co.jp', 'tokyomotion.net',
  'spankbang.com', 'hqporner.com', 'rule34.xxx',
] as const

/** Curated adult ad / affiliate network hosts */
const ADULT_AD_NETWORKS = [
  'exoclick.com', 'juicyads.com', 'trafficjunky.net', 'trafficjunky.com',
  'popads.net', 'adsterra.com', 'tsyndicate.com', 'ero-advertising.com',
  'plugrush.com', 'clickadu.com', 'adcash.com', 'hilltopads.com',
] as const

const SAFE_CONTEXT_INDICATORS = [
  'wikipedia', 'education', 'educational', 'medical', 'health',
  'research', 'documentary', 'news', 'article', 'study', 'academic',
  'cancer', 'disease', 'anatomy', 'biology', 'history', 'science',
  'museum', 'encyclopedia', 'dictionary', 'reference'
] as const

const SAFE_DOMAINS = [
  'wikipedia.org', 'webmd.com', 'mayoclinic.org', 'healthline.com',
  'nih.gov', 'cdc.gov', 'britannica.com', 'khanacademy.org',
  'google.com', 'youtube.com', 'github.com', 'stackoverflow.com'
] as const

const WHITELISTED_DOMAINS = [
  // Search engines (handled by Layer 2)
  'google.com', 'bing.com', 'duckduckgo.com', 'yahoo.com',
  'ecosia.org', 'qwant.com', 'startpage.com',
  // Social (may have explicit content but handled separately)
  'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
  'reddit.com', 'tiktok.com', 'linkedin.com',
  // Work tools
  'github.com', 'gitlab.com', 'stackoverflow.com', 'notion.so',
  'slack.com', 'discord.com', 'figma.com', 'linear.app',
  'trello.com', 'asana.com', 'jira.atlassian.com',
  // Email
  'gmail.com', 'mail.google.com', 'outlook.com', 'outlook.live.com',
  // Shopping (legitimate)
  'amazon.com', 'amazon.co.jp', 'amazon.fr', 'amazon.de',
  'ebay.com', 'etsy.com', 'aliexpress.com',
  // Banking / Finance (often have minimal text, lots of UI elements)
  'paypal.com', 'stripe.com', 'wise.com',
  // Japanese banks & services
  'smbc.co.jp', 'mufg.jp', 'mizuhobank.co.jp', 'rakuten-bank.co.jp',
  'japannetbank.co.jp', 'aeonbank.co.jp', 'sbigroup.co.jp',
  // Health & supplements (legitimate)
  'iherb.com', 'jp.iherb.com',
  // Video (handled elsewhere)
  'youtube.com', 'netflix.com', 'twitch.tv', 'vimeo.com',
  // News
  'nytimes.com', 'bbc.com', 'cnn.com', 'reuters.com',
  // Cloud services
  'dropbox.com', 'drive.google.com', 'onedrive.live.com'
] as const

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Main analysis function — analyzes the current page
 */
export function analyzePage(): ContentAnalysisResult {
  const startTime = performance.now()
  
  let score = 0
  const reasons: string[] = []
  const detectedMeta: string[] = []
  
  // 1. Check if domain is whitelisted (skip analysis)
  const domain = window.location.hostname.replace(/^www\./, '')
  if (isWhitelistedDomain(domain)) {
    return {
      score: 0,
      isExplicit: false,
      reasons: ['Domain whitelisted'],
      detectedMeta: [],
      keywordMatches: 0,
      imageTextRatio: 0,
      hasSafeContext: false,
      analysisTimeMs: performance.now() - startTime
    }
  }
  
  // 1b. Check if domain name itself contains adult keywords
  const domainResult = analyzeDomainName(domain)
  score += domainResult.score
  if (domainResult.score > 0) {
    reasons.push(...domainResult.reasons)
  }

  // 2. Check meta tags (highest priority)
  const metaResult = analyzeMetaTags()
  score += metaResult.score
  reasons.push(...metaResult.reasons)
  detectedMeta.push(...metaResult.detected)
  
  // If meta tag indicates adult content, instant block
  if (metaResult.score >= 80) {
    return {
      score,
      isExplicit: true,
      reasons,
      detectedMeta,
      keywordMatches: 0,
      imageTextRatio: 0,
      hasSafeContext: false,
      analysisTimeMs: performance.now() - startTime
    }
  }
  
  // 3. Check title
  const titleResult = analyzeTitle()
  score += titleResult.score
  if (titleResult.score > 0) {
    reasons.push(...titleResult.reasons)
  }
  
  // 4. Check body content
  const bodyResult = analyzeBodyContent()
  score += bodyResult.score
  if (bodyResult.score > 0) {
    reasons.push(...bodyResult.reasons)
  }
  
  // 5. Check image/text ratio
  const ratioResult = analyzeMediaRatio()
  score += ratioResult.score
  if (ratioResult.score > 0) {
    reasons.push(ratioResult.reason)
  }
  
  // 6. Check URL path
  const urlResult = analyzeUrlPath()
  score += urlResult.score
  if (urlResult.score > 0) {
    reasons.push(...urlResult.reasons)
  }
  
  // 7. Check links (keyword + known adult domains)
  const linkResult = analyzeLinkHrefs()
  score += linkResult.score
  if (linkResult.score > 0) {
    reasons.push(linkResult.reason)
  }

  // 8. Known adult domain links (language-independent)
  const adultLinkResult = analyzeAdultDomainLinks()
  score += adultLinkResult.score
  if (adultLinkResult.score > 0) {
    reasons.push(adultLinkResult.reason)
  }

  // 9. Adult ad-network hosts in scripts/iframes/links
  const adNetworkResult = analyzeAdultAdNetworks()
  score += adNetworkResult.score
  if (adNetworkResult.score > 0) {
    reasons.push(adNetworkResult.reason)
  }
  
  // 10. Check safe context (reduces score)
  const hasSafeContext = checkSafeContext(domain)
  if (hasSafeContext && score > 0) {
    const originalScore = score
    score = Math.floor(score / 3)
    reasons.push(`Safe context detected: score reduced from ${originalScore} to ${score}`)
  }
  
  const analysisTimeMs = performance.now() - startTime
  
  return {
    score,
    isExplicit: score >= 70,
    reasons,
    detectedMeta,
    keywordMatches: bodyResult.matchCount,
    imageTextRatio: ratioResult.ratio,
    hasSafeContext,
    analysisTimeMs
  }
}

/**
 * Analyze domain name for adult keywords (e.g. "porn" in hostname → high score)
 */
function analyzeDomainName(domain: string): { score: number; reasons: string[] } {
  const domainLower = domain.toLowerCase()
  let score = 0
  const reasons: string[] = []

  for (const pattern of DOMAIN_ADULT_PATTERNS) {
    if (domainLower.includes(pattern.toLowerCase())) {
      score = 80
      reasons.push(`Adult keyword in domain: "${pattern}" found in ${domain}`)
      break
    }
  }

  return { score, reasons }
}

/**
 * Analyze meta tags for adult indicators
 */
function analyzeMetaTags(): { score: number; reasons: string[]; detected: string[] } {
  let score = 0
  const reasons: string[] = []
  const detected: string[] = []
  
  // Check rating meta tag (case-insensitive name)
  const ratingMeta =
    document.querySelector('meta[name="rating" i]') ||
    document.querySelector('meta[name="Rating"]') ||
    document.querySelector('meta[name="RATING"]')
  const ratingContent = ratingMeta?.getAttribute('content')?.toLowerCase() || ''
  
  if (ratingContent === 'adult' || ratingContent.includes('rta-5042')) {
    score += 100
    reasons.push('Adult rating meta tag detected')
    detected.push(`rating=${ratingContent}`)
  } else if (ratingContent === 'mature') {
    score += 50
    reasons.push('Mature rating meta tag detected')
    detected.push(`rating=${ratingContent}`)
  }

  // RTA label link (common age-gate signal)
  const rtaLink = document.querySelector('a[href*="rtalabel.org"], link[href*="rtalabel.org"]')
  if (rtaLink && score < 100) {
    score += 80
    reasons.push('RTA label link detected')
    detected.push('rtalabel.org')
  }
  
  // Check Open Graph age restriction
  const ogAge = document.querySelector('meta[property="og:restrictions:age"]')
  const ageContent = ogAge?.getAttribute('content') || ''
  
  if (ageContent === '18+' || ageContent === '21+') {
    score += 80
    reasons.push(`Age restriction meta tag: ${ageContent}`)
    detected.push(`og:restrictions:age=${ageContent}`)
  }
  
  // Check Twitter card age gate
  const twitterAge = document.querySelector('meta[name="twitter:card"][content*="adult"]')
  if (twitterAge) {
    score += 60
    reasons.push('Twitter adult card detected')
    detected.push('twitter:card=adult')
  }
  
  return { score, reasons, detected }
}

/**
 * Analyze page title for explicit keywords
 */
function analyzeTitle(): { score: number; reasons: string[] } {
  const title = document.title.toLowerCase()
  let score = 0
  const reasons: string[] = []
  
  for (const keyword of EXPLICIT_KEYWORDS) {
    if (title.includes(keyword.toLowerCase())) {
      score += 60
      reasons.push(`Explicit keyword in title: "${keyword}"`)
      break // One match is enough for title
    }
  }
  
  return { score, reasons }
}

/**
 * True for CJK (Hiragana/Katakana/Han) — `\b` word boundaries do not work for these scripts.
 */
function isCjkKeyword(keyword: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]/.test(keyword)
}

/**
 * True when keyword is short Latin (ASCII letters/digits) where `\b` avoids false positives
 * (e.g. "ass" in "class", "sex" in "sexton").
 */
function isShortLatinToken(keyword: string): boolean {
  return keyword.length <= 3 && /^[a-z0-9]+$/i.test(keyword)
}

/**
 * Script-aware keyword match:
 * - CJK / non-Latin: substring includes (no word boundaries)
 * - Short Latin tokens: `\b` boundaries to limit false positives
 * - Longer Latin / multi-word: substring includes
 */
export function keywordMatchesInText(text: string, keyword: string): boolean {
  const keywordLower = keyword.toLowerCase()

  if (isCjkKeyword(keyword) || !/^[\x00-\x7F]*$/.test(keyword)) {
    // CJK and accented/non-ASCII keywords: includes (boundaries break JP/CJK)
    return text.includes(keywordLower)
  }

  if (isShortLatinToken(keywordLower)) {
    const escaped = keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`\\b${escaped}\\b`, 'i').test(text)
  }

  return text.includes(keywordLower)
}

/**
 * Analyze body text for explicit keywords
 */
function analyzeBodyContent(): { score: number; reasons: string[]; matchCount: number } {
  // Sample first 10000 characters to avoid performance issues
  const bodyText = document.body?.innerText?.slice(0, 10000).toLowerCase() || ''
  
  let matchCount = 0
  const matchedKeywords: string[] = []
  
  for (const keyword of EXPLICIT_KEYWORDS) {
    if (keywordMatchesInText(bodyText, keyword)) {
      matchCount++
      matchedKeywords.push(keyword)
    }
  }
  
  // Score based on match count
  let score = 0
  const reasons: string[] = []
  
  if (matchCount >= 10) {
    score = 50
    reasons.push(`High explicit keyword density: ${matchCount} matches`)
  } else if (matchCount >= 6) {
    score = 40
    reasons.push(`Multiple explicit keywords: ${matchCount} matches`)
  } else if (matchCount >= 3) {
    score = 25
    reasons.push(`Several explicit keywords: ${matchedKeywords.slice(0, 3).join(', ')}`)
  } else if (matchCount >= 1) {
    score = 10
    reasons.push(`Explicit keyword found: ${matchedKeywords[0]}`)
  }
  
  return { score, reasons, matchCount }
}

/**
 * Analyze media to text ratio
 * 
 * NOTE: Media ratio alone should NOT be able to block a page.
 * It's a supporting signal, not a primary indicator.
 * Max score is 25 so it can't trigger block alone even in heightened mode (threshold 35).
 */
function analyzeMediaRatio(): { score: number; reason: string; ratio: number } {
  const images = document.querySelectorAll('img').length
  const videos = document.querySelectorAll('video').length
  const iframes = document.querySelectorAll('iframe').length
  
  // Videos and iframes count more (often embedded video players)
  const mediaCount = images + (videos * 3) + (iframes * 2)
  
  // Get text length (excluding scripts, styles)
  const textLength = document.body?.innerText?.length || 0
  
  // Avoid division by zero
  if (textLength < 100) {
    // Very little text with many images could be a login page, app, etc.
    // Don't score too high to avoid false positives on legitimate apps/dashboards
    if (mediaCount > 20) {
      return {
        score: 20,  // Reduced from 40 - can't block alone
        reason: `High media count (${mediaCount}) with minimal text`,
        ratio: mediaCount
      }
    }
    return { score: 0, reason: '', ratio: 0 }
  }
  
  // Calculate ratio (media per 1000 chars of text)
  const ratio = mediaCount / (textLength / 1000)
  
  let score = 0
  let reason = ''
  
  // Reduced scores - media ratio is a supporting signal, not primary
  if (ratio > 30) {
    score = 25  // Reduced from 40
    reason = `Very high media/text ratio: ${ratio.toFixed(1)}`
  } else if (ratio > 15) {
    score = 15  // Reduced from 20
    reason = `High media/text ratio: ${ratio.toFixed(1)}`
  } else if (ratio > 8) {
    score = 5   // Reduced from 10, raised threshold
    reason = `Elevated media/text ratio: ${ratio.toFixed(1)}`
  }
  
  return { score, reason, ratio }
}

/**
 * Analyze URL path for suspicious patterns
 */
function analyzeUrlPath(): { score: number; reasons: string[] } {
  const path = window.location.pathname.toLowerCase()
  const search = window.location.search.toLowerCase()
  const fullPath = path + search
  
  let score = 0
  const reasons: string[] = []
  
  // Check for explicit keywords in path
  for (const keyword of EXPLICIT_KEYWORDS.slice(0, 10)) { // Check top 10 explicit terms
    if (fullPath.includes(keyword.toLowerCase())) {
      score += 30
      reasons.push(`Explicit keyword in URL path: "${keyword}"`)
      break
    }
  }
  
  // Check for suspicious path patterns
  const suspiciousPatterns = [
    /\/adult\//i,
    /\/xxx\//i,
    /\/porn\//i,
    /\/18\+\//i,
    /\/nsfw\//i,
    /\/nude/i,
    /\/naked/i
  ]
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(fullPath)) {
      score += 20
      reasons.push(`Suspicious URL pattern: ${pattern.source}`)
      break
    }
  }
  
  return { score, reasons }
}

/**
 * Analyze link hrefs for suspicious content
 */
function analyzeLinkHrefs(): { score: number; reason: string } {
  const links = document.querySelectorAll('a[href]')
  let suspiciousCount = 0
  
  // Only check first 100 links for performance
  const linksToCheck = Array.from(links).slice(0, 100)
  
  for (const link of linksToCheck) {
    const href = (link.getAttribute('href') || '').toLowerCase()
    const text = (link.textContent || '').toLowerCase()
    
    // Check if link contains explicit keywords
    for (const keyword of EXPLICIT_KEYWORDS.slice(0, 15)) {
      if (keywordMatchesInText(href, keyword) || keywordMatchesInText(text, keyword)) {
        suspiciousCount++
        break
      }
    }
  }
  
  let score = 0
  let reason = ''
  
  if (suspiciousCount >= 10) {
    score = 30
    reason = `Many suspicious links: ${suspiciousCount}`
  } else if (suspiciousCount >= 5) {
    score = 15
    reason = `Several suspicious links: ${suspiciousCount}`
  } else if (suspiciousCount >= 2) {
    score = 5
    reason = `Some suspicious links: ${suspiciousCount}`
  }
  
  return { score, reason }
}

function hostFromHref(href: string): string | null {
  try {
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return null
    const absolute = href.startsWith('http') ? href : new URL(href, window.location.href).href
    return new URL(absolute).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

function hostMatchesKnownAdult(host: string): boolean {
  return KNOWN_ADULT_DOMAINS.some(d => host === d || host.endsWith('.' + d))
}

/**
 * Count outbound links to known adult registrable domains (language-independent signal)
 */
function analyzeAdultDomainLinks(): { score: number; reason: string } {
  const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 150)
  let adultLinkCount = 0
  const samples: string[] = []

  for (const link of links) {
    const host = hostFromHref(link.getAttribute('href') || '')
    if (!host) continue
    if (hostMatchesKnownAdult(host)) {
      adultLinkCount++
      if (samples.length < 3) samples.push(host)
    }
  }

  if (adultLinkCount >= 5) {
    return {
      score: 40,
      reason: `Many links to known adult domains (${adultLinkCount}): ${samples.join(', ')}`
    }
  }
  if (adultLinkCount >= 2) {
    return {
      score: 25,
      reason: `Links to known adult domains (${adultLinkCount}): ${samples.join(', ')}`
    }
  }
  if (adultLinkCount === 1) {
    return {
      score: 10,
      reason: `Link to known adult domain: ${samples[0]}`
    }
  }
  return { score: 0, reason: '' }
}

/**
 * Detect known adult ad-network hosts in scripts, iframes, and links
 */
function analyzeAdultAdNetworks(): { score: number; reason: string } {
  const hosts = new Set<string>()

  const attrs = [
    ...Array.from(document.querySelectorAll('script[src]')).map(el => el.getAttribute('src') || ''),
    ...Array.from(document.querySelectorAll('iframe[src]')).map(el => el.getAttribute('src') || ''),
    ...Array.from(document.querySelectorAll('img[src]')).slice(0, 80).map(el => el.getAttribute('src') || ''),
    ...Array.from(document.querySelectorAll('a[href]')).slice(0, 80).map(el => el.getAttribute('href') || ''),
  ]

  for (const raw of attrs) {
    const host = hostFromHref(raw)
    if (!host) continue
    for (const network of ADULT_AD_NETWORKS) {
      if (host === network || host.endsWith('.' + network)) {
        hosts.add(network)
      }
    }
  }

  if (hosts.size === 0) return { score: 0, reason: '' }

  const list = Array.from(hosts).slice(0, 3).join(', ')
  if (hosts.size >= 2) {
    return { score: 45, reason: `Adult ad networks detected: ${list}` }
  }
  return { score: 30, reason: `Adult ad network detected: ${list}` }
}

/**
 * Check if page has safe context (medical, educational, etc.)
 */
function checkSafeContext(domain: string): boolean {
  // Check if domain is known safe
  if (SAFE_DOMAINS.some(d => domain.includes(d))) {
    return true
  }
  
  // Check content for safe context indicators
  const bodyText = document.body?.innerText?.slice(0, 5000).toLowerCase() || ''
  const title = document.title.toLowerCase()
  const fullText = title + ' ' + bodyText
  
  let safeIndicatorCount = 0
  
  for (const indicator of SAFE_CONTEXT_INDICATORS) {
    if (fullText.includes(indicator)) {
      safeIndicatorCount++
    }
  }
  
  // 3+ safe indicators = safe context
  return safeIndicatorCount >= 3
}

/**
 * Check if domain should skip analysis
 */
function isWhitelistedDomain(domain: string): boolean {
  // Check explicit whitelist
  if (WHITELISTED_DOMAINS.some(d => domain.includes(d))) {
    return true
  }
  
  // Email tracking / marketing domains (often have random params that trigger false positives)
  const emailTrackingPatterns = [
    /\.mg\./,              // Mailgun (email.mg.*)
    /sendgrid\.net/,
    /mailchimp\.com/,
    /mailgun\.org/,
    /postmarkapp\.com/,
    /amazonses\.com/,
    /sparkpostmail\.com/,
    /mandrillapp\.com/,
    /constantcontact\.com/,
    /campaign-archive\.com/,
    /list-manage\.com/,
    /click\./,
    /track\./,
    /links\./,
    /go\./,
  ]
  
  if (emailTrackingPatterns.some(pattern => pattern.test(domain))) {
    return true
  }
  
  // Pattern-based whitelist for common legitimate sites
  const safePatterns = [
    // Banks (often have -bank, bank-, kanri in domain)
    /bank/i,
    /kanri/i,      // Japanese for "management" - common in banking
    /ginko/i,      // Japanese for "bank"
    
    // Finance
    /finance/i,
    /payment/i,
    /checkout/i,
    
    // Government
    /\.gov$/i,
    /\.go\.jp$/i,
    
    // Education  
    /\.edu$/i,
    /\.ac\.jp$/i,
    
    // Corporate Japan
    /\.co\.jp$/i,
  ]
  
  return safePatterns.some(pattern => pattern.test(domain))
}

/**
 * Check if this looks like a SPA that needs recheck
 */
export function isSPALikely(): boolean {
  const indicators = [
    // Very little initial content
    (document.body?.innerText?.length || 0) < 500,
    // React root
    !!document.querySelector('[data-reactroot]'),
    !!document.getElementById('root'),
    !!document.getElementById('app'),
    // Angular
    !!document.querySelector('[ng-app]'),
    !!document.querySelector('app-root'),
    // Vue/Nuxt
    !!document.querySelector('#__nuxt'),
    !!document.querySelector('#__next'),
    // Bundle scripts
    document.querySelectorAll('script[src*="bundle"]').length > 0,
    document.querySelectorAll('script[src*="chunk"]').length > 0
  ]
  
  return indicators.filter(Boolean).length >= 2
}

/**
 * Get current domain (helper)
 */
export function getCurrentDomain(): string {
  return window.location.hostname.replace(/^www\./, '')
}
