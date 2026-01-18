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
  // Instant block
  'porn', 'porno', 'xxx', 'hentai', 'pornhub', 'xvideos', 'xhamster',
  'redtube', 'youporn', 'brazzers', 'onlyfans', 'chaturbate',
  // High suspicion
  'nsfw', 'nude', 'naked', 'sex video', 'adult video', 'erotic',
  'camgirl', 'livecam', 'webcam sex', 'stripchat',
  // Medium
  'boobs', 'tits', 'ass', 'pussy', 'dick', 'cock', 'milf', 'teen porn'
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
  'reddit.com', 'tiktok.com',
  // Work tools
  'github.com', 'gitlab.com', 'stackoverflow.com', 'notion.so',
  'slack.com', 'discord.com', 'figma.com', 'linear.app'
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
  
  // 7. Check links
  const linkResult = analyzeLinkHrefs()
  score += linkResult.score
  if (linkResult.score > 0) {
    reasons.push(linkResult.reason)
  }
  
  // 8. Check safe context (reduces score)
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
 * Analyze meta tags for adult indicators
 */
function analyzeMetaTags(): { score: number; reasons: string[]; detected: string[] } {
  let score = 0
  const reasons: string[] = []
  const detected: string[] = []
  
  // Check rating meta tag
  const ratingMeta = document.querySelector('meta[name="rating"]')
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
 * Analyze body text for explicit keywords
 */
function analyzeBodyContent(): { score: number; reasons: string[]; matchCount: number } {
  // Sample first 10000 characters to avoid performance issues
  const bodyText = document.body?.innerText?.slice(0, 10000).toLowerCase() || ''
  
  let matchCount = 0
  const matchedKeywords: string[] = []
  
  for (const keyword of EXPLICIT_KEYWORDS) {
    if (bodyText.includes(keyword.toLowerCase())) {
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
    // Very little text is suspicious if there are many images
    if (mediaCount > 10) {
      return {
        score: 40,
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
  
  if (ratio > 30) {
    score = 40
    reason = `Very high media/text ratio: ${ratio.toFixed(1)}`
  } else if (ratio > 15) {
    score = 20
    reason = `High media/text ratio: ${ratio.toFixed(1)}`
  } else if (ratio > 5) {
    score = 10
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
      if (href.includes(keyword) || text.includes(keyword)) {
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
  return WHITELISTED_DOMAINS.some(d => domain.includes(d))
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
