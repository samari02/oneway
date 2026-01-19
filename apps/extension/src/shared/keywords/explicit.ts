/**
 * Explicit Keywords — Layer 2 Search Intelligence
 * 
 * Terms that trigger immediate high suspicion scores.
 * Organized by category for maintainability.
 * 
 * SCORING:
 * - INSTANT_BLOCK: Score 100 → immediate block
 * - HIGH: Score 50 → likely block
 * - MEDIUM: Score 25 → warning + accumulation
 */

/** Terms that trigger immediate block (score: 100) */
export const INSTANT_BLOCK_KEYWORDS = [
  // Direct terms
  'porn', 'porno', 'pornography',
  'xxx', 'xxxx',
  'hentai', 'rule34', 'r34',
  'nsfw',
  
  // Major sites
  'pornhub', 'xvideos', 'xnxx', 'xhamster',
  'redtube', 'youporn', 'brazzers',
  'naughtyamerica', 'bangbros', 'realitykings',
  'onlyfans leak', 'fansly leak',
  
  // Cam sites
  'chaturbate', 'livejasmin', 'stripchat',
  'bongacams', 'myfreecams', 'cam4',
  
  // Specific content types
  'deepfake porn', 'leaked nudes', 'leaked video',
  'sex tape', 'sextape',
] as const

/** High suspicion terms (score: 50) */
export const HIGH_SUSPICION_KEYWORDS = [
  // Content types
  'nude', 'nudes', 'naked',
  'topless', 'bottomless',
  'sex video', 'adult video',
  'erotic', 'erotica',
  
  // Actions
  'fap', 'fapping',
  'jerk off', 'jerkoff',
  'masturbat',  // catches masturbate, masturbation, etc.
  
  // Platforms (without "leak")
  'onlyfans', 'fansly', 'fanvue',
  'manyvids', 'clips4sale',
  
  // French terms
  'pute', 'salope', 'beurette',
  'cul', 'nichons', 'chatte',
  
  // Slang
  'milf', 'gilf', 'dilf',
  'pawg', 'bbc', 'bwc',
  'creampie', 'facial',
  'gangbang', 'threesome', 'orgy',
] as const

/** Medium suspicion terms (score: 25) - need combination or context */
export const MEDIUM_SUSPICION_KEYWORDS = [
  // Body parts (innocent alone, suspect in context)
  'boobs', 'tits', 'breasts',
  'ass', 'butt', 'booty',
  'pussy', 'vagina', 'penis', 'dick', 'cock',
  
  // Clothing states
  'bikini', 'lingerie', 'underwear',
  'bra', 'panties', 'thong',
  
  // Suggestive
  'sexy', 'hot girl', 'hot guy',
  'seductive', 'sensual',
  
  // Dating/hookup related
  'hookup', 'hook up', 'one night stand',
  'escort', 'sugar baby', 'sugar daddy',
] as const

/** All explicit keywords combined with their scores */
export const EXPLICIT_KEYWORDS_WITH_SCORES: Array<{ term: string; score: number }> = [
  ...INSTANT_BLOCK_KEYWORDS.map(term => ({ term, score: 100 })),
  ...HIGH_SUSPICION_KEYWORDS.map(term => ({ term, score: 50 })),
  ...MEDIUM_SUSPICION_KEYWORDS.map(term => ({ term, score: 25 })),
]

/** Quick lookup set for any explicit keyword */
export const ALL_EXPLICIT_KEYWORDS = new Set([
  ...INSTANT_BLOCK_KEYWORDS,
  ...HIGH_SUSPICION_KEYWORDS,
  ...MEDIUM_SUSPICION_KEYWORDS,
])

/**
 * Check if a term is explicit and get its score
 * Uses word boundary matching to avoid false positives (e.g., "nutrition" matching "nu")
 */
export function getExplicitKeywordScore(normalizedQuery: string): { 
  found: boolean
  score: number
  matchedTerms: string[]
} {
  const matchedTerms: string[] = []
  let totalScore = 0
  
  for (const { term, score } of EXPLICIT_KEYWORDS_WITH_SCORES) {
    // Use word boundary regex to match whole words only
    // \b doesn't work well with non-ASCII, so we use a custom approach
    const termLower = term.toLowerCase()
    
    // For short terms (<=3 chars), require word boundaries to avoid false positives
    // For longer terms, substring match is usually safe
    if (termLower.length <= 3) {
      // Create regex with word boundaries
      const regex = new RegExp(`\\b${escapeRegex(termLower)}\\b`, 'i')
      if (regex.test(normalizedQuery)) {
        matchedTerms.push(term)
        totalScore = Math.max(totalScore, score)
      }
    } else {
      // Longer terms: substring match is fine
      if (normalizedQuery.includes(termLower)) {
        matchedTerms.push(term)
        totalScore = Math.max(totalScore, score)
      }
    }
  }
  
  return {
    found: matchedTerms.length > 0,
    score: totalScore,
    matchedTerms
  }
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
