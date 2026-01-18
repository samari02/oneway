/**
 * Query Normalizer — Anti-Evasion System
 * 
 * Normalizes search queries to catch common evasion tactics:
 * - Character substitution (p0rn → porn, s3x → sex)
 * - Spacing tricks (p o r n → porn)
 * - Cyrillic/lookalike characters (рorn with Cyrillic р → porn)
 * - Deliberate typos (pron, prn, pr0n)
 * - Symbol substitution ($ex → sex, @ss → ass)
 */

/**
 * Character substitution map
 * Maps evasion characters to their normal equivalents
 */
const CHAR_SUBSTITUTIONS: Record<string, string> = {
  // Numbers to letters
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '9': 'g',
  
  // Symbols to letters
  '@': 'a',
  '$': 's',
  '!': 'i',
  '+': 't',
  '€': 'e',
  '£': 'l',
  '¥': 'y',
  '&': 'and',
  
  // Cyrillic lookalikes (look like Latin but are different Unicode)
  'а': 'a',  // Cyrillic а
  'е': 'e',  // Cyrillic е
  'о': 'o',  // Cyrillic о
  'р': 'p',  // Cyrillic р (very common in "рorn")
  'с': 'c',  // Cyrillic с
  'х': 'x',  // Cyrillic х
  'у': 'y',  // Cyrillic у
  'і': 'i',  // Ukrainian і
  
  // Greek lookalikes
  'α': 'a',  // Greek alpha
  'ε': 'e',  // Greek epsilon
  'ο': 'o',  // Greek omicron
  'ρ': 'p',  // Greek rho
  
  // Other Unicode tricks
  'ø': 'o',  // Scandinavian ø
  'œ': 'oe', // Ligature
  'æ': 'ae', // Ligature
  'ß': 'ss', // German eszett
  
  // Accented characters
  'á': 'a', 'à': 'a', 'â': 'a', 'ä': 'a', 'ã': 'a', 'å': 'a',
  'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
  'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
  'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o',
  'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
  'ý': 'y', 'ÿ': 'y',
  'ñ': 'n',
  'ç': 'c',
}

/**
 * Common deliberate typos/variations for explicit terms
 * Maps typo → correct spelling
 */
const TYPO_CORRECTIONS: Record<string, string> = {
  // Porn variations (including repeated chars that might slip through)
  'pron': 'porn',
  'prn': 'porn',
  'pr0n': 'porn',
  'p0rn': 'porn',
  'porm': 'porn',
  'potn': 'porn',
  'porrn': 'porn',
  'pornn': 'porn',
  'porno': 'porn',  // Normalize porno to porn for matching
  'pornno': 'porn',
  'porrrn': 'porn',
  
  // Sex variations
  's3x': 'sex',
  'sexx': 'sex',
  'seks': 'sex',
  'secks': 'sex',
  'seex': 'sex',
  'sexxx': 'sex',
  
  // XXX variations
  'x x x': 'xxx',
  'triple x': 'xxx',
  'xxxx': 'xxx',
  'xxxxx': 'xxx',
  
  // Nude variations
  'nud3': 'nude',
  'nood': 'nude',
  'nuude': 'nude',
  'nuuude': 'nude',
  
  // Naked variations
  'nak3d': 'naked',
  'nakd': 'naked',
  'naket': 'naked',
  'nakked': 'naked',
  
  // Other common typos
  'bewbs': 'boobs',
  'b00bs': 'boobs',
  'boobss': 'boobs',
  't1ts': 'tits',
  'titts': 'tits',
  'a$$': 'ass',
  '@ss': 'ass',
  'asss': 'ass',
  'f@p': 'fap',
  'fapp': 'fap',
  'h3ntai': 'hentai',
  'h entai': 'hentai',
  'hentaii': 'hentai',
}

/**
 * Normalize a search query to catch evasion attempts
 * 
 * @param query - The raw search query
 * @returns Object with normalized query and detection info
 */
export function normalizeQuery(query: string): {
  normalized: string
  original: string
  wasModified: boolean
  evasionScore: number
  detectedTechniques: string[]
} {
  const original = query
  const detectedTechniques: string[] = []
  let evasionScore = 0
  let normalized = query.toLowerCase()
  
  // 1. Apply character substitutions
  let charSubsApplied = 0
  for (const [char, replacement] of Object.entries(CHAR_SUBSTITUTIONS)) {
    if (normalized.includes(char)) {
      normalized = normalized.split(char).join(replacement)
      charSubsApplied++
    }
  }
  if (charSubsApplied > 0) {
    detectedTechniques.push(`character_substitution (${charSubsApplied} chars)`)
    evasionScore += charSubsApplied * 5 // 5 points per substituted character
  }
  
  // 2. Remove spaces between single characters (p o r n → porn)
  const spacedPattern = /\b(\w)\s+(\w)\s+(\w)/g
  if (spacedPattern.test(normalized)) {
    const before = normalized
    normalized = normalized.replace(/\b(\w)\s+(?=\w\b)/g, '$1')
    if (normalized !== before) {
      detectedTechniques.push('spaced_characters')
      evasionScore += 15
    }
  }
  
  // 3. Remove repeated characters aggressively (pooooorno → porno → porn)
  const beforeDedup = normalized
  
  // First pass: reduce any 2+ repeated chars to 1 (very aggressive)
  // This catches: pooorno → porno, sexxxy → sexy, etc.
  normalized = normalized.replace(/(.)\1+/g, '$1')
  
  if (normalized !== beforeDedup) {
    detectedTechniques.push('repeated_characters')
    // More repeated chars = higher evasion score
    const repeatCount = (beforeDedup.match(/(.)\1+/g) || []).length
    evasionScore += Math.min(repeatCount * 5, 25)
  }
  
  // 4. Apply typo corrections
  for (const [typo, correction] of Object.entries(TYPO_CORRECTIONS)) {
    if (normalized.includes(typo)) {
      normalized = normalized.replace(new RegExp(typo, 'g'), correction)
      detectedTechniques.push(`typo_correction: ${typo}`)
      evasionScore += 10
    }
  }
  
  // 5. Remove common separators used to break up words
  const separators = ['.', '-', '_', '*', '~', '|']
  for (const sep of separators) {
    if (normalized.includes(sep)) {
      // Only remove if between letters (p.o.r.n but not domain.com)
      const pattern = new RegExp(`(\\w)\\${sep}(\\w)`, 'g')
      const before = normalized
      normalized = normalized.replace(pattern, '$1$2')
      if (normalized !== before) {
        detectedTechniques.push(`separator_removal: ${sep}`)
        evasionScore += 5
      }
    }
  }
  
  // 6. Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim()
  
  const wasModified = normalized !== original.toLowerCase().replace(/\s+/g, ' ').trim()
  
  return {
    normalized,
    original,
    wasModified,
    evasionScore,
    detectedTechniques
  }
}

/**
 * Quick check if a query appears to use evasion techniques
 * Faster than full normalization for preliminary checks
 */
export function hasEvasionIndicators(query: string): boolean {
  const lower = query.toLowerCase()
  
  // Check for obvious substitutions
  if (/[0-9@$!]/.test(lower) && /[a-z]/.test(lower)) {
    // Mixed numbers/symbols with letters - suspicious
    return true
  }
  
  // Check for spaced characters (3+ single chars separated by spaces)
  if (/\b\w\s+\w\s+\w\b/.test(lower)) {
    return true
  }
  
  // Check for Cyrillic mixed with Latin
  if (/[а-яА-Я]/.test(query) && /[a-zA-Z]/.test(query)) {
    return true
  }
  
  // Check for known typos
  for (const typo of Object.keys(TYPO_CORRECTIONS)) {
    if (lower.includes(typo)) {
      return true
    }
  }
  
  return false
}

/**
 * Get the evasion score for a query without full normalization
 * Returns 0-100 based on how many evasion techniques are detected
 */
export function getEvasionScore(query: string): number {
  const result = normalizeQuery(query)
  return Math.min(result.evasionScore, 100)
}
