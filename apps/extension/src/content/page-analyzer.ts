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
  // Cloaked celeb-leak / fappening galleries (specific — avoid bare "leak")
  'fappening', 'the fappening', 'leaked nude', 'nude leak', 'nude leaks',
  'celeb leak', 'celebrity leak', 'leaked celebs', 'onlyfans leak',
  'leaked onlyfans', 'celeb nude', 'celebrity nude',
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

  // Chinese (light, high-signal only — CJK substring match)
  '色情', '成人视频', '成人網站', '成人网站', '黄色网站', '黄色網站',
  '黄片', '色情片', '裸体', '性愛', '性爱', '成人內容', '成人内容',
  // TW/JP adult video lexicon (gallery / tube frontends)
  '無碼', '无码', 'AV線上', 'AV线上', '成人影片', '免費A片', '免费A片',
  '中出', '生中出し', '素人動画', 'FC2PPV', 'fc2ppv',
  '未滿18歲', '未满18岁',
] as const

/**
 * Adult intent terms scored when found in in-site search/query URL params
 * (not only Google/Bing). Keep specific — short tokens use word boundaries.
 */
const ADULT_SEARCH_QUERY_TERMS = [
  'porn', 'porno', 'xxx', 'hentai', 'nsfw', 'jav', 'fc2', 'fc2ppv',
  'onlyfans', 'fansly', 'chaturbate', 'stripchat', 'xvideos', 'xnxx',
  'missav', 'avgle', 'jable', 'netflav', 'sukebei',
  '無碼', '无码', '無修正', 'アダルト', 'エロ', 'エロ動画',
  '色情', '黄片', 'AV線上', 'AV线上', '成人影片', 'A片',
  '中出', '生中出し', '素人',
] as const

/** Query / keyword param names used by site-local search (PeerTube, tubes, etc.) */
const IN_SITE_SEARCH_PARAM_KEYS = [
  'search', 'q', 'query', 'keyword', 'keywords', 's', 'term', 'terms',
  'k', 'kw', 'wd', 'text', 'find',
] as const

/** Adult-oriented PeerTube / AVX skin markers (structural, not hostname) */
const ADULT_PT_THEME_RE = /avx|jav|adult|av-|nsfw|エロ|無碼/i

const DOMAIN_ADULT_PATTERNS = [
  'porn', 'xxx', 'sex', 'hentai', 'adult', 'erotic', 'nude',
  'nsfw', 'fetish', 'camgirl', 'escort', 'fap', 'jav', 'xnxx',
  // JP / Asia adult long-tail (keep specific to limit false positives)
  'fanza', 'missav', 'javdb', 'javbus', 'avgle', 'njav', 'jable',
  'netflav', 'hpjav', '7mmtv', 'xcity', 'erovideo', 'fc2ppv',
  'sokmil', 'dxlive', 'chatpia', 'sukebei', 'tokyohot', 'tokyo-hot',
  '1pondo', 'caribbeancom', 'pacopaco', 'heyzo', 'mgstage',
  'eroterest', 'xcolle', 'pcolle', 'digiket', 'nyahentai', 'fc2live',

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
  'xcolle.jp', 'pcolle.jp', 'digiket.com', 'fc2ppv.com', 'fc2live.com',
  'dxlive.com', 'chatpia.jp', 'dmm.co.jp',
] as const

/** Curated adult ad / affiliate network hosts */
const ADULT_AD_NETWORKS = [
  'exoclick.com', 'juicyads.com', 'trafficjunky.net', 'trafficjunky.com',
  'popads.net', 'adsterra.com', 'tsyndicate.com', 'ero-advertising.com',
  'plugrush.com', 'clickadu.com', 'adcash.com', 'hilltopads.com',
  // ExoClick / TrafficStars family + common zone loaders on cloaked galleries
  'magsrv.com', 'realsrv.com', 'cpmstar.com', 'adxpansion.com',
] as const

/**
 * Known porn / tube image CDN & studio hosts (gallery thumb density).
 * Keep specific registrable domains — not generic CDNs (cloudfront, imgur, etc.).
 */
const PORN_IMAGE_CDN_HOSTS = [
  'fpo.xxx', 'xgroovy.com', 'manyvids.com', 'blacked.com', 'jav.sb',
  'pornhub.com', 'phncdn.com', 'xvideos.com', 'xhcdn.com', 'xnxx.com',
  'xhamster.com', 'pixhost.to', 'imagetwist.com', 'imagebam.com',
  'imgbox.com', 'erome.com', 'spankbang.com', 'hqporner.com',
  'onlyfans.com', 'fansly.com', 'chaturbate.com', 'stripchat.com',
  'missav.com', 'javdb.com', 'javbus.com', 'avgle.com',
] as const

/** Distinct porn-CDN image hosts for a strong gallery density hit */
const PORN_CDN_DENSITY_STRONG = 3
const PORN_CDN_DENSITY_MODERATE = 2

/** Distinct known-adult outbound link hosts required for a strong structural hit */
const ADULT_LINK_DOMAIN_THRESHOLD = 3

/**
 * High-signal phrases for meta description / title cloaked celeb-leak pages.
 * Kept separate from short EXPLICIT tokens to limit .org false positives.
 */
const CELEB_LEAK_META_PHRASES = [
  'fappening', 'leaked nude', 'nude leak', 'celeb leak', 'celebrity leak',
  'onlyfans leak', 'leaked celebs', 'celebs leaked', 'leaked photos',
  'nude photos and videos', 'celebrity nude', 'celeb nude',
] as const

/** Adult hub nav labels that co-occur on cloaked gallery frontends */
const ADULT_NAV_PHRASES = [
  'sex dating', 'adult games', 'live cams', 'adult cams', 'webcam sex',
  'cam girls', 'camgirls', 'porn games',
] as const

export interface AnalyzePageOptions {
  /** Extra adult domains from system blocklist seed/sync (self-reinforcing). */
  knownAdultDomains?: string[]
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Main analysis function — analyzes the current page
 */
export function analyzePage(options: AnalyzePageOptions = {}): ContentAnalysisResult {
  const startTime = performance.now()
  const knownAdultSet = buildKnownAdultSet(options.knownAdultDomains)
  
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

  // 2b. PeerTube server config + JSON-LD (site-wide NSFW / Mature) — before title/body
  const peertubeCfgResult = analyzePeerTubeServerConfig()
  score += peertubeCfgResult.score
  if (peertubeCfgResult.score > 0) {
    reasons.push(...peertubeCfgResult.reasons)
    detectedMeta.push(...peertubeCfgResult.detected)
  }
  const jsonLdResult = analyzeJsonLdAdultSignals()
  score += jsonLdResult.score
  if (jsonLdResult.score > 0) {
    reasons.push(...jsonLdResult.reasons)
    detectedMeta.push(...jsonLdResult.detected)
  }
  
  // If meta / PeerTube NSFW / Mature indicates adult content, instant block
  if (metaResult.score >= 80 || peertubeCfgResult.score >= 70 || jsonLdResult.score >= 70 || score >= 70) {
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

  // 8. Known adult / blocklist domain links (language-independent, self-reinforcing)
  const adultLinkResult = analyzeAdultDomainLinks(knownAdultSet)
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

  // 9a. USC 2257 / record-keeping marker (adult site compliance footer)
  const usc2257Result = analyzeUsc2257Marker()
  score += usc2257Result.score
  if (usc2257Result.score > 0) {
    reasons.push(usc2257Result.reason)
  }

  // 9a2. Multi-porn-CDN image density (cloaked gallery thumbs)
  const cdnResult = analyzePornImageCdnDensity()
  score += cdnResult.score
  if (cdnResult.score > 0) {
    reasons.push(cdnResult.reason)
  }

  // 9a3. Adult hub nav label cluster (Sex dating / Adult games / Cams)
  const navResult = analyzeAdultNavCluster()
  score += navResult.score
  if (navResult.score > 0) {
    reasons.push(navResult.reason)
  }

  // 9b. Structural tube-site signals (before safe-context reduction)
  const adultCorroboration = detectAdultCorroboration()
  const tubeResult = analyzeTubeSiteStructure(domain, adultCorroboration)
  score += tubeResult.score
  if (tubeResult.score > 0) {
    reasons.push(...tubeResult.reasons)
  }

  // 9c. PeerTube / adult-frontend fingerprints (require adult corroboration)
  const frontendResult = analyzeAdultVideoFrontend(adultCorroboration)
  score += frontendResult.score
  if (frontendResult.score > 0) {
    reasons.push(...frontendResult.reasons)
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

/**
 * Analyze domain name for adult keywords (e.g. "porn" in hostname → high score)
 */
function analyzeDomainName(domain: string): { score: number; reasons: string[] } {
  const domainLower = domain.toLowerCase()
  let score = 0
  const reasons: string[] = []

  // Ultra-generic Latin tokens only match as a DNS label (or hyphenated label),
  // not as a substring of hosts like "ashasexualhealth.org" / "sussex.com".
  const GENERIC_HOST_TOKENS = new Set(['sex', 'adult', 'nude', 'ass'])

  for (const pattern of DOMAIN_ADULT_PATTERNS) {
    const pat = pattern.toLowerCase()
    let hit = false
    if (GENERIC_HOST_TOKENS.has(pat)) {
      hit = domainLower.split('.').some((lab) => lab === pat || lab.split('-').includes(pat))
    } else {
      hit = domainLower.includes(pat)
    }
    if (hit) {
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

  // PeerTube / video platform meta
  const ogPlatform = (
    document.querySelector('meta[property="og:platform"]')?.getAttribute('content') || ''
  ).toLowerCase()
  const ogType = (
    document.querySelector('meta[property="og:type"]')?.getAttribute('content') || ''
  ).toLowerCase()
  if (ogPlatform.includes('peertube')) {
    detected.push('og:platform=PeerTube')
  }
  if (ogType.includes('video')) {
    detected.push(`og:type=${ogType}`)
  }

  // Meta / OG / Twitter descriptions — cloaked fappening galleries often only signal here
  const descBlob = [
    document.querySelector('meta[name="description" i]')?.getAttribute('content'),
    document.querySelector('meta[property="og:description"]')?.getAttribute('content'),
    document.querySelector('meta[name="twitter:description"]')?.getAttribute('content'),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (descBlob) {
    const phraseHits = CELEB_LEAK_META_PHRASES.filter((p) => descBlob.includes(p))
    if (phraseHits.length >= 2) {
      score += 50
      reasons.push(`Celeb-leak meta phrases: ${phraseHits.slice(0, 3).join(', ')}`)
      detected.push(`meta-desc:${phraseHits[0]}`)
    } else if (phraseHits.length === 1) {
      score += 35
      reasons.push(`Celeb-leak meta phrase: ${phraseHits[0]}`)
      detected.push(`meta-desc:${phraseHits[0]}`)
    }
  }
  
  return { score, reasons, detected }
}

export interface PeerTubeConfigSignals {
  found: boolean
  isNSFW: boolean | null
  defaultNSFWPolicy: string | null
  shortDescription: string | null
  ageGateMessage: boolean
}

/**
 * Extract PeerTubeServerConfig from inline scripts (isolated world cannot read page window).
 * Safe JSON parse only — never eval.
 */
export function extractPeerTubeServerConfig(): PeerTubeConfigSignals {
  const empty: PeerTubeConfigSignals = {
    found: false,
    isNSFW: null,
    defaultNSFWPolicy: null,
    shortDescription: null,
    ageGateMessage: false,
  }

  try {
    const scripts = Array.from(document.querySelectorAll('script'))
    for (const script of scripts) {
      const text = script.textContent || ''
      if (!text.includes('PeerTubeServerConfig') && !/"isNSFW"\s*:/.test(text)) {
        continue
      }

      // Prefer full assignment: window.PeerTubeServerConfig = {...}
      let jsonText: string | null = null
      const assignMatch = text.match(
        /(?:window\.)?PeerTubeServerConfig\s*=\s*(\{[\s\S]*\})\s*;?\s*$/m
      )
      if (assignMatch?.[1]) {
        jsonText = assignMatch[1]
      } else {
        // Fallback: first balanced-ish object containing "isNSFW"
        const idx = text.indexOf('"isNSFW"')
        if (idx >= 0) {
          const start = text.lastIndexOf('{', idx)
          if (start >= 0) {
            jsonText = extractBalancedJsonObject(text, start)
          }
        }
      }

      if (!jsonText) {
        // Regex fallbacks without full parse
        const isNsfwMatch = text.match(/"isNSFW"\s*:\s*(true|false)/i)
        const policyMatch = text.match(/"defaultNSFWPolicy"\s*:\s*"([^"]+)"/i)
        const descMatch = text.match(/"shortDescription"\s*:\s*"((?:\\.|[^"\\])*)"/i)
        const ageGate =
          /未滿18歲|未满18岁|請離開|请离开|18\+|NSFW/i.test(text) &&
          /broadcastMessage|homepage/i.test(text)

        if (!isNsfwMatch && !policyMatch && !descMatch && !ageGate) continue

        return {
          found: true,
          isNSFW: isNsfwMatch ? isNsfwMatch[1].toLowerCase() === 'true' : null,
          defaultNSFWPolicy: policyMatch?.[1] ?? null,
          shortDescription: descMatch ? unescapeJsonString(descMatch[1]) : null,
          ageGateMessage: ageGate,
        }
      }

      try {
        const cfg = JSON.parse(jsonText) as Record<string, unknown>
        const instance = (cfg.instance ?? cfg) as Record<string, unknown>
        const isNSFW =
          typeof instance.isNSFW === 'boolean'
            ? instance.isNSFW
            : typeof cfg.isNSFW === 'boolean'
              ? cfg.isNSFW
              : null
        const defaultNSFWPolicy =
          typeof instance.defaultNSFWPolicy === 'string'
            ? instance.defaultNSFWPolicy
            : typeof cfg.defaultNSFWPolicy === 'string'
              ? cfg.defaultNSFWPolicy
              : null
        const shortDescription =
          typeof instance.shortDescription === 'string'
            ? instance.shortDescription
            : typeof cfg.shortDescription === 'string'
              ? cfg.shortDescription
              : null
        const broadcast =
          String(instance.broadcastMessage ?? cfg.broadcastMessage ?? '') +
          ' ' +
          JSON.stringify(instance.homepage ?? cfg.homepage ?? '')
        const ageGateMessage = /未滿18歲|未满18岁|請離開|请离开/.test(broadcast)

        return {
          found: true,
          isNSFW,
          defaultNSFWPolicy,
          shortDescription,
          ageGateMessage,
        }
      } catch {
        // Malformed JSON — fall through to next script
      }
    }
  } catch {
    return empty
  }

  return empty
}

function unescapeJsonString(s: string): string {
  try {
    return JSON.parse(`"${s}"`) as string
  } catch {
    return s
  }
}

/** Extract a balanced `{...}` JSON object starting at `start` (must be `{`). */
function extractBalancedJsonObject(text: string, start: number): string | null {
  if (text[start] !== '{') return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length && i < start + 200_000; i++) {
    const ch = text[i]
    if (inString) {
      if (escape) {
        escape = false
      } else if (ch === '\\') {
        escape = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

/**
 * Score PeerTube instance NSFW config (site-wide durable signal).
 * isNSFW:true → strong block; isNSFW:false → no score from this signal.
 */
function analyzePeerTubeServerConfig(): {
  score: number
  reasons: string[]
  detected: string[]
} {
  const cfg = extractPeerTubeServerConfig()
  if (!cfg.found) return { score: 0, reasons: [], detected: [] }

  const reasons: string[] = []
  const detected: string[] = ['PeerTubeServerConfig']
  let score = 0

  const peertubeFingerprint = !!(
    document.querySelector('.peertube-container, [data-pt-theme]') ||
    document.querySelector('meta[property="og:platform"][content*="PeerTube" i]') ||
    /peertube/i.test(document.documentElement.outerHTML.slice(0, 50_000))
  )

  if (cfg.isNSFW === true) {
    // Site declares NSFW — alone is a strong adult signal; with PeerTube fingerprint → block
    score += peertubeFingerprint ? 80 : 70
    reasons.push('PeerTubeServerConfig isNSFW:true')
    detected.push('isNSFW:true')
  } else if (cfg.isNSFW === false) {
    // Explicit non-NSFW instance — do not score NSFW from config (avoid joinpeertube demos)
    detected.push('isNSFW:false')
  }

  if (cfg.defaultNSFWPolicy && /display|blur|do_not_list/i.test(cfg.defaultNSFWPolicy)) {
    if (cfg.isNSFW === true) {
      score += 5
      reasons.push(`PeerTube defaultNSFWPolicy=${cfg.defaultNSFWPolicy}`)
    }
    detected.push(`defaultNSFWPolicy=${cfg.defaultNSFWPolicy}`)
  }

  if (cfg.shortDescription) {
    const desc = cfg.shortDescription.toLowerCase()
    const adultDesc = ['av線上', 'av线上', '無碼', '无码', '成人', 'av看', '色情', 'hentai', 'jav']
    if (adultDesc.some((t) => desc.includes(t))) {
      if (cfg.isNSFW !== false) score += 20
      reasons.push(`PeerTube shortDescription adult: ${cfg.shortDescription.slice(0, 40)}`)
      detected.push('shortDescription:adult')
    }
  }

  if (cfg.ageGateMessage && cfg.isNSFW !== false) {
    score += 25
    reasons.push('PeerTube age-gate broadcast (未滿18歲 / leave)')
    detected.push('age-gate')
  }

  return { score: Math.min(score, 100), reasons, detected }
}

/**
 * JSON-LD VideoObject / contentRating Mature + adult keywords
 */
function analyzeJsonLdAdultSignals(): {
  score: number
  reasons: string[]
  detected: string[]
} {
  const reasons: string[] = []
  const detected: string[] = []
  let score = 0

  try {
    const nodes = Array.from(
      document.querySelectorAll('script[type="application/ld+json"]')
    ).slice(0, 12)

    for (const node of nodes) {
      const raw = node.textContent || ''
      if (!raw.trim()) continue
      let data: unknown
      try {
        data = JSON.parse(raw)
      } catch {
        continue
      }

      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        if (!item || typeof item !== 'object') continue
        const obj = item as Record<string, unknown>
        const type = String(obj['@type'] || '')
        const rating = String(obj.contentRating || obj.content_rating || '').toLowerCase()
        const keywords = String(obj.keywords || '').toLowerCase()
        const name = String(obj.name || '').toLowerCase()
        const description = String(obj.description || '').toLowerCase()
        const blob = `${keywords} ${name} ${description}`

        if (rating === 'mature' || rating === 'adult' || rating.includes('18')) {
          score += rating === 'adult' ? 70 : 55
          reasons.push(`JSON-LD contentRating=${obj.contentRating}`)
          detected.push(`contentRating=${obj.contentRating}`)
        }

        if (/videoobject/i.test(type) && /\/w\//.test(window.location.pathname)) {
          score += 5
          detected.push('VideoObject+/w/')
        }

        const adultKw = [
          '無碼', '无码', '中出', '生中出し', 'fc2ppv', 'fc2', '素人', 'セックス',
          'av線上', '色情', 'hentai', 'jav',
        ]
        const hits = adultKw.filter((k) => keywordMatchesInText(blob, k))
        if (hits.length >= 2) {
          score += 30
          reasons.push(`JSON-LD adult keywords: ${hits.slice(0, 3).join(', ')}`)
        } else if (hits.length === 1) {
          score += 15
          reasons.push(`JSON-LD adult keyword: ${hits[0]}`)
        }
      }
    }
  } catch {
    return { score: 0, reasons: [], detected: [] }
  }

  return { score: Math.min(score, 85), reasons, detected }
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
 * Analyze URL path + in-site search query params for suspicious patterns
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

  // In-site search query scoring (PeerTube ?search=, tubes ?q=, etc.)
  const queryResult = analyzeInSiteSearchQuery()
  score += queryResult.score
  if (queryResult.score > 0) {
    reasons.push(...queryResult.reasons)
  }

  // PeerTube watch path is a mild tube signal (needs other signals to block)
  if (/\/w\/[a-zA-Z0-9_-]+/.test(path) || /\/videos\/watch\//.test(path)) {
    score += 10
    reasons.push('PeerTube-style watch path')
  }
  
  return { score, reasons }
}

/**
 * Score adult lexicon terms inside site-local search/query URL parameters.
 */
function analyzeInSiteSearchQuery(): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []
  const matched: string[] = []

  try {
    const params = new URL(window.location.href).searchParams
    const chunks: string[] = []
    for (const key of IN_SITE_SEARCH_PARAM_KEYS) {
      const value = params.get(key)
      if (value && value.trim()) chunks.push(value)
    }
    // Also catch PeerTube-style path search: /search?search=…
    if (chunks.length === 0 && /\/search\/?/i.test(window.location.pathname)) {
      params.forEach((value) => {
        if (value && value.trim()) chunks.push(value)
      })
    }
    if (chunks.length === 0) return { score: 0, reasons: [] }

    const queryText = chunks.join(' ').toLowerCase()
    for (const term of ADULT_SEARCH_QUERY_TERMS) {
      if (keywordMatchesInText(queryText, term.toLowerCase())) {
        matched.push(term)
      }
    }
  } catch {
    return { score: 0, reasons: [] }
  }

  if (matched.length === 0) return { score: 0, reasons: [] }

  // Strong: adult query intent on any site-local search
  if (matched.length >= 2) {
    score = 45
  } else {
    // Single high-signal term (fc2, jav, 無碼, porn…)
    score = 35
  }
  reasons.push(`Adult in-site search query: ${matched.slice(0, 3).join(', ')}`)
  return { score, reasons }
}

export interface AdultCorroboration {
  fromQuery: boolean
  fromLexicon: boolean
  fromAvxSkin: boolean
  fromCategoryLabel: boolean
  fromPeerTubeNsfw: boolean
  fromMatureRating: boolean
  /** True when any adult corroboration signal is present */
  any: boolean
}

/**
 * Adult corroboration for PeerTube / tube structural hits.
 * Plain PeerTube demos must not block without one of these.
 */
function detectAdultCorroboration(): AdultCorroboration {
  const fromQuery = analyzeInSiteSearchQuery().score > 0
  const ptCfg = extractPeerTubeServerConfig()
  const fromPeerTubeNsfw = ptCfg.isNSFW === true

  const sample = (
    (document.title || '') +
    ' ' +
    (document.body?.innerText?.slice(0, 8_000) || '') +
    ' ' +
    (ptCfg.shortDescription || '')
  ).toLowerCase()

  const lexiconTerms = [
    '無碼', '无码', '無修正', 'アダルト', 'エロ', 'jav', 'fc2', 'porn', 'xxx',
    'hentai', 'AV線上', 'AV线上', '成人影片', 'A片', '色情', '黄片',
    '中出', '生中出し', '素人動画', 'fc2ppv', 'セックス',
  ]
  const fromLexicon = lexiconTerms.some((t) => keywordMatchesInText(sample, t.toLowerCase()))

  const html = document.documentElement
  const theme = (html.getAttribute('data-pt-theme') || '').toLowerCase()
  const className = (html.className || '').toString().toLowerCase()
  const hasAvxAttr = Array.from(html.attributes).some((a) =>
    a.name.startsWith('data-avx-') || a.name.startsWith('--avx')
  )
  const hasAvxDom =
    !!document.getElementById('avx-navigation') ||
    !!document.querySelector('[class*="avx-"], [id*="avx-"], [class*="peertube-plugin-avx"]') ||
    !!document.querySelector('.pt-av-card, [class*="pt-av-"]') ||
    /--avx-/.test(html.getAttribute('style') || '')
  const fromAvxSkin =
    ADULT_PT_THEME_RE.test(theme) ||
    className.includes('avx-') ||
    hasAvxAttr ||
    hasAvxDom

  const nav = document.getElementById('avx-navigation')
  const aria = (nav?.getAttribute('aria-label') || '').toLowerCase()
  const fromCategoryLabel =
    aria.includes('影片分類') ||
    aria.includes('影片分类') ||
    /成人|av\b|無碼|无码|色情/.test(sample.slice(0, 2000))

  let fromMatureRating = false
  try {
    for (const node of Array.from(
      document.querySelectorAll('script[type="application/ld+json"]')
    ).slice(0, 8)) {
      const raw = (node.textContent || '').toLowerCase()
      if (raw.includes('"contentrating":"mature"') || raw.includes('"contentrating":"adult"')) {
        fromMatureRating = true
        break
      }
    }
  } catch {
    /* ignore */
  }

  const any =
    fromQuery ||
    fromLexicon ||
    fromAvxSkin ||
    fromCategoryLabel ||
    fromPeerTubeNsfw ||
    fromMatureRating
  return {
    fromQuery,
    fromLexicon,
    fromAvxSkin,
    fromCategoryLabel,
    fromPeerTubeNsfw,
    fromMatureRating,
    any,
  }
}

/**
 * PeerTube / adult-frontend structural fingerprints.
 * Base PeerTube alone scores 0; adult skin / lexicon / query / isNSFW unlocks score.
 */
function analyzeAdultVideoFrontend(
  corroboration: AdultCorroboration
): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let peertube = false
  let adultSkin = false

  try {
    const html = document.documentElement
    const theme = html.getAttribute('data-pt-theme') || ''
    peertube = !!(
      document.querySelector('.peertube-container') ||
      theme ||
      document.querySelector('[data-pt-theme]') ||
      document.querySelector('meta[property="og:platform"][content*="PeerTube" i]') ||
      document.querySelector('iframe[src*="/videos/embed/"], a[href*="/videos/embed/"]') ||
      document.querySelector('a[href*="/w/"], a[href*="/videos/watch/"]') ||
      /peertube/i.test(document.body?.className || '')
    )

    adultSkin = corroboration.fromAvxSkin
    if (document.querySelector('[class*="peertube-plugin-avx"], .pt-av-card')) {
      adultSkin = true
    }

    if (adultSkin) {
      reasons.push('Adult PeerTube/AVX frontend skin')
    } else if (peertube) {
      reasons.push('PeerTube frontend detected')
    }

    if (corroboration.fromCategoryLabel && (peertube || adultSkin)) {
      reasons.push('Adult category navigation label')
    }
    if (corroboration.fromPeerTubeNsfw) {
      reasons.push('PeerTube isNSFW corroboration')
    }
    if (corroboration.fromMatureRating) {
      reasons.push('JSON-LD Mature corroboration')
    }
  } catch {
    return { score: 0, reasons: [] }
  }

  if (!peertube && !adultSkin) return { score: 0, reasons: [] }

  // Site-wide NSFW already scored in analyzePeerTubeServerConfig — add structural boost only
  if (corroboration.fromPeerTubeNsfw && peertube) {
    return { score: 15, reasons }
  }

  // Adult AVX / themed skin on PeerTube-like shell → strong structural hit
  if (adultSkin && (peertube || corroboration.fromAvxSkin)) {
    let score = 40
    if (corroboration.fromQuery || corroboration.fromLexicon) score += 15
    if (corroboration.fromCategoryLabel) score += 10
    if (corroboration.fromMatureRating) score += 10
    return { score: Math.min(score, 65), reasons }
  }

  // Plain PeerTube: only score with adult corroboration (query / lexicon / labels / Mature)
  if (peertube && corroboration.any) {
    let score = 25
    if (corroboration.fromQuery) score += 20
    if (corroboration.fromLexicon) score += 15
    if (corroboration.fromCategoryLabel) score += 10
    if (corroboration.fromMatureRating) score += 15
    return { score: Math.min(score, 55), reasons }
  }

  // Detected PeerTube but no adult corroboration — do not score (avoid joinpeertube demos)
  return { score: 0, reasons: [] }
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

function buildKnownAdultSet(extra?: string[]): Set<string> {
  const set = new Set<string>()
  for (const d of KNOWN_ADULT_DOMAINS) set.add(d.toLowerCase())
  if (extra) {
    for (const raw of extra) {
      if (typeof raw !== 'string') continue
      const d = raw.trim().toLowerCase().replace(/^www\./, '')
      if (d.includes('.')) set.add(d)
    }
  }
  return set
}

function hostMatchesAdultSet(host: string, known: Set<string>): boolean {
  if (known.has(host)) return true
  for (const d of known) {
    if (host === d || host.endsWith('.' + d)) return true
  }
  return false
}

/**
 * Count outbound links to known adult / system-blocklist domains.
 * Self-reinforcing: as the blocklist grows, link-graph detection strengthens.
 * ≥K distinct adult domains → strong score (language-independent).
 */
function analyzeAdultDomainLinks(known: Set<string>): { score: number; reason: string } {
  const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 150)
  const distinctAdult = new Set<string>()
  let adultLinkCount = 0
  const samples: string[] = []

  for (const link of links) {
    const host = hostFromHref(link.getAttribute('href') || '')
    if (!host) continue
    if (hostMatchesAdultSet(host, known)) {
      adultLinkCount++
      distinctAdult.add(host)
      if (samples.length < 3) samples.push(host)
    }
  }

  // Strong structural: ≥K distinct adult/blocklist domains linked
  if (distinctAdult.size >= ADULT_LINK_DOMAIN_THRESHOLD) {
    return {
      score: 75,
      reason: `Links to ≥${ADULT_LINK_DOMAIN_THRESHOLD} adult blocklist domains (${distinctAdult.size}): ${samples.join(', ')}`
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
 * 18 U.S.C. § 2257 record-keeping statements — strong adult-site compliance signal.
 * Specific enough to avoid FPs on random .org pages.
 */
function analyzeUsc2257Marker(): { score: number; reason: string } {
  const sample = [
    document.title,
    document.body?.innerText?.slice(0, 14_000) || '',
    ...Array.from(document.querySelectorAll('a[href], footer, .footer'))
      .slice(0, 40)
      .map((el) => (el.getAttribute('href') || '') + ' ' + (el.textContent || '')),
  ]
    .join(' ')
    .toLowerCase()

  // 18usc2257, 18 U.S.C. 2257, 18 USC § 2257, /2257.html, etc.
  if (
    /18\s*u\.?\s*s\.?\s*c\.?\s*\.?\s*§?\s*2257/.test(sample) ||
    /18usc2257/.test(sample) ||
    /\/2257(?:\.html?)?(?:[#?]|$)/.test(sample) ||
    (/\b2257\b/.test(sample) &&
      /record[\s-]*keeping|compliance|custodian of records/.test(sample))
  ) {
    return { score: 35, reason: '18 U.S.C. 2257 compliance marker detected' }
  }
  return { score: 0, reason: '' }
}

/**
 * Dense gallery thumbs pointing at known porn / tube CDNs (language-independent).
 * Requires multiple distinct adult CDN hosts to limit single-embed FPs.
 */
function analyzePornImageCdnDensity(): { score: number; reason: string } {
  const imgs = Array.from(document.querySelectorAll('img')).slice(0, 160)
  const distinct = new Set<string>()
  const samples: string[] = []

  for (const img of imgs) {
    const raw =
      img.getAttribute('src') ||
      img.getAttribute('data-src') ||
      img.getAttribute('data-lazy-src') ||
      img.getAttribute('data-original') ||
      ''
    const host = hostFromHref(raw)
    if (!host) continue
    for (const cdn of PORN_IMAGE_CDN_HOSTS) {
      if (host === cdn || host.endsWith('.' + cdn)) {
        distinct.add(cdn)
        if (samples.length < 4) samples.push(cdn)
        break
      }
    }
  }

  if (distinct.size >= PORN_CDN_DENSITY_STRONG) {
    return {
      score: 45,
      reason: `Porn image CDN density (${distinct.size} hosts): ${samples.join(', ')}`,
    }
  }
  if (distinct.size >= PORN_CDN_DENSITY_MODERATE) {
    return {
      score: 25,
      reason: `Porn image CDNs (${distinct.size}): ${samples.join(', ')}`,
    }
  }
  if (distinct.size === 1) {
    return {
      score: 10,
      reason: `Porn image CDN: ${samples[0]}`,
    }
  }
  return { score: 0, reason: '' }
}

/**
 * Adult hub navigation clusters common on cloaked gallery frontends.
 * Needs ≥2 specific multi-word phrases — bare "cams" alone does not score.
 */
function analyzeAdultNavCluster(): { score: number; reason: string } {
  const navText = [
    ...Array.from(document.querySelectorAll('nav, header, .nav, .menu, .navbar, #menu')).slice(0, 12),
    ...Array.from(document.querySelectorAll('a')).slice(0, 80),
  ]
    .map((el) => (el.textContent || '').toLowerCase())
    .join(' ')

  if (!navText.trim()) return { score: 0, reason: '' }

  const hits = ADULT_NAV_PHRASES.filter((p) => navText.includes(p))
  if (hits.length >= 2) {
    return {
      score: 25,
      reason: `Adult nav cluster: ${hits.slice(0, 3).join(', ')}`,
    }
  }
  return { score: 0, reason: '' }
}

/** Hosts where dense video grids / duration labels are expected (skip tube heuristics). */
function isTubeHeuristicExemptHost(domain: string): boolean {
  const d = domain.toLowerCase()
  return (
    SAFE_DOMAINS.some((safe) => d === safe || d.endsWith('.' + safe)) ||
    WHITELISTED_DOMAINS.some((safe) => d === safe || d.endsWith('.' + safe))
  )
}

const TUBE_URL_PATTERN_SCORE = 18
const TUBE_GRID_STRONG_SCORE = 35
const TUBE_GRID_MODERATE_SCORE = 22
const TUBE_VIDEO_LINK_GRID_SCORE = 20

/**
 * Structural heuristics for tube-style sites (thumbnail grids, duration badges, watch URLs).
 * Runs before safe-context reduction so fake "medical" categories cannot wash scores.
 * Cap 65 by default; with adult corroboration (query / NSFW / AVX) allow ≥70.
 */
function analyzeTubeSiteStructure(
  domain: string,
  corroboration: AdultCorroboration = {
    fromQuery: false,
    fromLexicon: false,
    fromAvxSkin: false,
    fromCategoryLabel: false,
    fromPeerTubeNsfw: false,
    fromMatureRating: false,
    any: false,
  }
): { score: number; reasons: string[] } {
  if (isTubeHeuristicExemptHost(domain)) {
    return { score: 0, reasons: [] }
  }

  let score = 0
  const reasons: string[] = []

  try {
    const path = window.location.pathname.toLowerCase()
    const search = window.location.search.toLowerCase()

    let urlSignalCount = 0
    if (search.includes('viewkey=')) urlSignalCount++
    if (/\/videos?\//.test(path)) urlSignalCount++
    if (/\/w\/[a-z0-9_-]+/i.test(path)) urlSignalCount++
    if (urlLooksLikeFakeSafeCategory()) urlSignalCount++

    if (urlSignalCount > 0) {
      const urlScore = Math.min(urlSignalCount * TUBE_URL_PATTERN_SCORE, 45)
      score += urlScore
      if (search.includes('viewkey=')) reasons.push('Tube URL pattern: viewkey=')
      if (/\/videos?\//.test(path)) reasons.push('Tube URL pattern: /video path')
      if (/\/w\/[a-z0-9_-]+/i.test(path)) reasons.push('Tube URL pattern: /w/ watch path')
      if (urlLooksLikeFakeSafeCategory()) {
        reasons.push('Tube evasion: medical/health category in URL')
      }
    }

    const bodySample = document.body?.innerText?.slice(0, 12_000) || ''
    const durationLabels = bodySample.match(/\b(?:\d{1,2}:)?\d{1,2}:\d{2}\b/g) ?? []
    const durationCount = durationLabels.length

    const imgNodes = Array.from(document.querySelectorAll('img')).slice(0, 160)
    let thumbLike = 0
    for (const img of imgNodes) {
      const src = (img.getAttribute('src') || img.getAttribute('data-src') || '').toLowerCase()
      if (!src || /logo|icon|avatar|sprite|favicon|badge/.test(src)) continue
      const cls = (img.className || '').toString()
      const w = img.naturalWidth || Number(img.getAttribute('width')) || 0
      const h = img.naturalHeight || Number(img.getAttribute('height')) || 0
      if (/thumb|preview|poster|video|cover|tile|card|pt-av/.test(cls + src) || (w >= 120 && h >= 80)) {
        thumbLike++
      }
    }

    if (thumbLike >= 14 && durationCount >= 10) {
      score += TUBE_GRID_STRONG_SCORE
      reasons.push(`Tube grid: ${thumbLike} thumbnails, ${durationCount} duration labels`)
    } else if (thumbLike >= 9 && durationCount >= 6) {
      score += TUBE_GRID_MODERATE_SCORE
      reasons.push(`Tube-like grid: ${thumbLike} thumbnails, ${durationCount} durations`)
    }

    const videoLinks = document.querySelectorAll(
      'a[href*="/video"], a[href*="/w/"], a[href*="viewkey"], a[href*="/watch"], a[href*="watch?"], a[href*="/videos/embed/"]'
    ).length
    if (videoLinks >= 24) {
      score += TUBE_VIDEO_LINK_GRID_SCORE
      reasons.push(`Dense video link grid (${videoLinks} watch links)`)
    }

    // Structural + adult query/NSFW combo: allow reaching block threshold without domain list
    if (corroboration.any && score >= 40) {
      score += 15
      reasons.push('Tube structure + adult corroboration boost')
    }
  } catch {
  }

  const cap = corroboration.any ? 85 : 65
  return { score: Math.min(score, cap), reasons }
}

/**
 * Tube / cam sites abuse fake category labels (`?category=medical`, `/medical/`)
 * so content looks "educational" and safe-context would cut the score ÷3.
 * Never treat that URL shape as safe unless the host is already a SAFE_DOMAIN.
 */
function urlLooksLikeFakeSafeCategory(): boolean {
  try {
    const u = new URL(location.href)
    const path = (u.pathname || '').toLowerCase()
    const q = (u.search || '').toLowerCase()
    if (q.includes('category=medical') || path.includes('/medical')) return true
    if (q.includes('category=health') || path.includes('/health/')) return true
    return false
  } catch {
    return false
  }
}

/**
 * Check if page has safe context (medical, educational, etc.)
 */
function checkSafeContext(domain: string): boolean {
  // Check if domain is known safe
  if (SAFE_DOMAINS.some(d => domain.includes(d))) {
    return true
  }

  if (urlLooksLikeFakeSafeCategory()) {
    return false
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
 * (Angular PeerTube, Cloudflare challenge shell, React/Vue).
 */
export function isSPALikely(): boolean {
  const indicators = [
    // Very little initial content / challenge shell
    (document.body?.innerText?.length || 0) < 500,
    !!document.querySelector('#challenge-form, #cf-challenge-running, .cf-browser-verification'),
    // React root
    !!document.querySelector('[data-reactroot]'),
    !!document.getElementById('root'),
    !!document.getElementById('app'),
    // Angular / PeerTube
    !!document.querySelector('[ng-app]'),
    !!document.querySelector('app-root'),
    !!document.querySelector('my-app[ng-version], my-app'),
    !!document.querySelector('.peertube-container, [data-pt-theme]'),
    !!document.querySelector('[ng-version]'),
    // Vue/Nuxt
    !!document.querySelector('#__nuxt'),
    !!document.querySelector('#__next'),
    // Bundle scripts
    document.querySelectorAll('script[src*="bundle"]').length > 0,
    document.querySelectorAll('script[src*="chunk"]').length > 0,
  ]

  // PeerTube/Angular alone is enough to schedule a delayed recheck
  if (
    document.querySelector('my-app, .peertube-container, [data-pt-theme], [ng-version]')
  ) {
    return true
  }

  return indicators.filter(Boolean).length >= 2
}

/** True when page needs longer hydration wait (Cloudflare / Angular PeerTube). */
export function needsExtendedSpaRecheck(): boolean {
  return !!(
    document.querySelector(
      'my-app, .peertube-container, [data-pt-theme], #challenge-form, #cf-challenge-running, .cf-browser-verification'
    ) || document.querySelector('[ng-version]')
  )
}

/**
 * Get current domain (helper)
 */
export function getCurrentDomain(): string {
  return window.location.hostname.replace(/^www\./, '')
}
