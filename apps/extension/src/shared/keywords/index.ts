/**
 * Keywords Index — Centralized exports for all keyword lists
 * 
 * Usage:
 *   import { getExplicitKeywordScore, analyzeSuspiciousCombinations } from '../shared/keywords'
 */

// Explicit keywords (direct terms)
export {
  INSTANT_BLOCK_KEYWORDS,
  HIGH_SUSPICION_KEYWORDS,
  MEDIUM_SUSPICION_KEYWORDS,
  EXPLICIT_KEYWORDS_WITH_SCORES,
  ALL_EXPLICIT_KEYWORDS,
  getExplicitKeywordScore,
} from './explicit'

// Suspicious combinations (innocent words together)
export {
  SUSPICIOUS_MODIFIERS,
  SUSPICIOUS_SUBJECTS,
  SUSPICIOUS_SUFFIXES,
  SAFE_CONTEXT_WORDS,
  MODIFIERS_SET,
  SUBJECTS_SET,
  SUFFIXES_SET,
  SAFE_CONTEXT_SET,
  analyzeSuspiciousCombinations,
} from './suspicious'

// Multi-language keywords
export {
  JAPANESE_KEYWORDS,
  CHINESE_KEYWORDS,
  SPANISH_KEYWORDS,
  GERMAN_KEYWORDS,
  PORTUGUESE_KEYWORDS,
  FRENCH_KEYWORDS,
  RUSSIAN_KEYWORDS,
  ITALIAN_KEYWORDS,
  ARABIC_KEYWORDS,
  DUTCH_KEYWORDS,
  KOREAN_KEYWORDS,
  ALL_MULTILANG_KEYWORDS,
  MULTILANG_KEYWORDS_SET,
  checkMultilangKeywords,
} from './multilang'
