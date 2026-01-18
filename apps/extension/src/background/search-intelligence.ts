/**
 * Search Intelligence Engine — Layer 2
 * 
 * Analyzes search queries using multiple detection methods:
 * - Explicit keywords (instant block)
 * - Suspicious combinations (accumulation)
 * - Multi-language detection
 * - Anti-evasion normalization
 * - Behavioral patterns (frantic, escalation)
 * 
 * Maintains a session with scoring and triggers heightened mode.
 */

import { normalizeQuery, hasEvasionIndicators } from '../lib/normalizer'
import { 
  getExplicitKeywordScore, 
  analyzeSuspiciousCombinations,
  checkMultilangKeywords 
} from '../shared/keywords'
import type { 
  SearchSession, 
  SearchEntry,
  SearchAnalysisResult, 
  SearchThresholds,
  SearchFlag,
  HeightenedModeState
} from '../shared/types'
import { log } from '../shared/utils'

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_THRESHOLDS: SearchThresholds = {
  warnScore: 20,
  blockScore: 50,
  heightenedTrigger: 100,
  franticCount: 5,
  franticWindowMs: 60000,      // 1 minute
  sessionTimeoutMs: 300000,    // 5 minutes
}

const HEIGHTENED_THRESHOLDS: SearchThresholds = {
  warnScore: 10,               // Lower threshold when heightened
  blockScore: 30,
  heightenedTrigger: 100,
  franticCount: 3,             // More sensitive
  franticWindowMs: 60000,
  sessionTimeoutMs: 300000,
}

const STORAGE_KEYS = {
  SESSION: 'searchSession',
  THRESHOLDS: 'searchThresholds',
  HEIGHTENED: 'heightenedMode',
  DAILY_STATS: 'intelligentBlockingDailyStats'
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Get current search session from storage
 */
async function getSearchSession(): Promise<SearchSession> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SESSION)
  const session = data[STORAGE_KEYS.SESSION] as SearchSession | undefined
  
  // Check if session expired
  if (session && Date.now() - session.lastActivity > DEFAULT_THRESHOLDS.sessionTimeoutMs) {
    // Session expired, reset
    return createEmptySession()
  }
  
  return session || createEmptySession()
}

/**
 * Create empty session
 */
function createEmptySession(): SearchSession {
  return {
    searches: [],
    totalScore: 0,
    lastActivity: Date.now(),
    peakScore: 0
  }
}

/**
 * Update search session with new entry
 */
async function updateSearchSession(
  query: string, 
  normalizedQuery: string, 
  score: number, 
  flags: SearchFlag[]
): Promise<SearchSession> {
  const session = await getSearchSession()
  const now = Date.now()
  
  // Create new entry
  const entry: SearchEntry = {
    query,
    normalizedQuery,
    timestamp: now,
    score,
    flags
  }
  
  // Add to session
  session.searches.push(entry)
  session.totalScore += score
  session.lastActivity = now
  session.peakScore = Math.max(session.peakScore, session.totalScore)
  
  // Keep only searches within the session window (last 5 minutes)
  const cutoff = now - DEFAULT_THRESHOLDS.sessionTimeoutMs
  session.searches = session.searches.filter(s => s.timestamp > cutoff)
  
  // Recalculate total score after cleanup
  session.totalScore = session.searches.reduce((sum, s) => sum + s.score, 0)
  
  // Save to storage
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSION]: session })
  
  return session
}

/**
 * Reset search session
 */
async function resetSearchSession(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSION]: createEmptySession() })
}

// ============================================================================
// HEIGHTENED MODE
// ============================================================================

/**
 * Get heightened mode state
 */
async function getHeightenedMode(): Promise<HeightenedModeState | null> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.HEIGHTENED)
  const state = data[STORAGE_KEYS.HEIGHTENED] as HeightenedModeState | undefined
  
  if (!state?.active) return null
  
  // Check if expired
  if (state.expiresAt && Date.now() > state.expiresAt) {
    await deactivateHeightenedMode()
    return null
  }
  
  return state
}

/**
 * Activate heightened mode
 */
async function activateHeightenedMode(reason: string, triggerScore: number): Promise<void> {
  const state: HeightenedModeState = {
    active: true,
    activatedAt: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
    reason,
    triggerScore,
    originalThresholds: DEFAULT_THRESHOLDS
  }
  
  await chrome.storage.local.set({ 
    [STORAGE_KEYS.HEIGHTENED]: state,
    [STORAGE_KEYS.THRESHOLDS]: HEIGHTENED_THRESHOLDS
  })
  
  log('🔥 Heightened mode ACTIVATED:', reason, 'score:', triggerScore)
  
  // Update badge to show red indicator
  await updateBadge(true)
  
  // Show notification
  await showHeightenedNotification()
  
  // Increment daily stats
  await incrementHeightenedActivation()
  
  // TODO: Notify desktop app via native messaging
}

/**
 * Deactivate heightened mode
 */
async function deactivateHeightenedMode(): Promise<void> {
  await chrome.storage.local.set({ 
    [STORAGE_KEYS.HEIGHTENED]: { active: false } as HeightenedModeState,
    [STORAGE_KEYS.THRESHOLDS]: DEFAULT_THRESHOLDS
  })
  
  // Clear badge
  await updateBadge(false)
  
  log('✅ Heightened mode deactivated')
}

// ============================================================================
// BADGE & NOTIFICATIONS
// ============================================================================

/**
 * Update extension badge based on heightened mode
 */
async function updateBadge(isHeightened: boolean): Promise<void> {
  if (isHeightened) {
    // Red badge with "!" when heightened
    await chrome.action.setBadgeText({ text: '!' })
    await chrome.action.setBadgeBackgroundColor({ color: '#EF4444' }) // red-500
    await chrome.action.setBadgeTextColor({ color: '#FFFFFF' })
  } else {
    // Clear badge when normal
    await chrome.action.setBadgeText({ text: '' })
  }
}

/**
 * Show browser notification when heightened mode activates
 */
async function showHeightenedNotification(): Promise<void> {
  // Check if we have notification permission
  const hasPermission = await chrome.permissions.contains({ permissions: ['notifications'] })
  
  if (!hasPermission) {
    log('No notification permission, skipping notification')
    return
  }
  
  chrome.notifications.create('heightened-mode', {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
    title: '⚠️ Mode Protection Renforcée',
    message: 'Clarity a détecté une activité suspecte. Seuils de blocage abaissés pour 30 min.',
    priority: 2,
    requireInteraction: false
  })
}

/**
 * Increment heightened activation counter
 */
async function incrementHeightenedActivation(): Promise<void> {
  const stats = await getDailyStats()
  stats.heightenedActivations++
  await chrome.storage.local.set({ [STORAGE_KEYS.DAILY_STATS]: stats })
}

/**
 * Get current thresholds (heightened or default)
 */
async function getThresholds(): Promise<SearchThresholds> {
  const heightened = await getHeightenedMode()
  if (heightened?.active) {
    return HEIGHTENED_THRESHOLDS
  }
  return DEFAULT_THRESHOLDS
}

// ============================================================================
// BEHAVIORAL ANALYSIS
// ============================================================================

/**
 * Analyze behavioral patterns in the current session
 */
function analyzeBehavior(session: SearchSession, currentScore: number): {
  flags: SearchFlag[]
  additionalScore: number
} {
  const flags: SearchFlag[] = []
  let additionalScore = 0
  const now = Date.now()
  
  // 1. Check for frantic pattern (5+ searches in 60 seconds)
  const franticWindow = 60000 // 1 minute
  const recentSearches = session.searches.filter(
    s => now - s.timestamp < franticWindow
  )
  
  if (recentSearches.length >= 5) {
    flags.push('frantic_pattern')
    additionalScore += 20
    log('⚠️ Frantic pattern detected:', recentSearches.length, 'searches in 60s')
  }
  
  // 2. Check for escalation pattern (scores increasing over last 3 searches)
  if (session.searches.length >= 3) {
    const lastThree = session.searches.slice(-3)
    const isEscalating = lastThree.every((s, i) => {
      if (i === 0) return true
      return s.score >= lastThree[i - 1].score
    })
    
    // Also check if current score continues the escalation
    if (isEscalating && currentScore > lastThree[lastThree.length - 1].score) {
      flags.push('escalation_pattern')
      additionalScore += 15
      log('⚠️ Escalation pattern detected')
    }
  }
  
  return { flags, additionalScore }
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze a search query and return result with action
 * 
 * @param query - The raw search query from URL
 * @returns Analysis result with score, flags, and action
 */
export async function analyzeSearch(query: string): Promise<SearchAnalysisResult> {
  const startTime = Date.now()
  
  // Get current thresholds and session
  const thresholds = await getThresholds()
  const session = await getSearchSession()
  
  // 1. Normalize query (anti-evasion)
  const normalization = normalizeQuery(query)
  const { normalized, evasionScore, detectedTechniques } = normalization
  
  // 2. Initialize result
  let totalScore = 0
  const flags: SearchFlag[] = []
  const matchedTerms: string[] = []
  
  // 3. Check explicit keywords (highest priority)
  const explicitResult = getExplicitKeywordScore(normalized)
  if (explicitResult.found) {
    totalScore += explicitResult.score
    flags.push('explicit_keyword')
    matchedTerms.push(...explicitResult.matchedTerms)
    log('🚨 Explicit keyword:', explicitResult.matchedTerms, 'score:', explicitResult.score)
  }
  
  // 4. Check suspicious combinations
  const combinationResult = analyzeSuspiciousCombinations(normalized)
  if (combinationResult.isSuspicious) {
    totalScore += combinationResult.score
    flags.push('suspicious_combination')
    if (combinationResult.matchedCombination) {
      matchedTerms.push(combinationResult.matchedCombination)
    }
    log('⚠️ Suspicious combination:', combinationResult.matchedCombination, 'score:', combinationResult.score)
  }
  
  // 5. Check multilingual keywords (use ORIGINAL query for non-Latin scripts)
  const multilangResult = checkMultilangKeywords(query)
  if (multilangResult.found) {
    totalScore += multilangResult.score
    flags.push('multilang_keyword')
    matchedTerms.push(...multilangResult.matchedTerms)
    log('🌍 Multilang keyword:', multilangResult.matchedTerms, 'score:', multilangResult.score)
  }
  
  // 6. Add evasion score
  if (evasionScore > 0) {
    totalScore += evasionScore
    flags.push('evasion_attempt')
    log('🕵️ Evasion attempt detected:', detectedTechniques, 'score:', evasionScore)
  }
  
  // 7. Analyze behavioral patterns
  const behaviorResult = analyzeBehavior(session, totalScore)
  totalScore += behaviorResult.additionalScore
  flags.push(...behaviorResult.flags)
  
  // 8. Update session with this search
  const updatedSession = await updateSearchSession(query, normalized, totalScore, flags)
  
  // 9. Determine action based on thresholds
  let action: 'allow' | 'warn' | 'block' = 'allow'
  let warningMessage: string | undefined
  
  if (totalScore >= thresholds.blockScore) {
    action = 'block'
    log('🛑 BLOCKING search. Score:', totalScore, 'threshold:', thresholds.blockScore)
  } else if (totalScore >= thresholds.warnScore) {
    action = 'warn'
    warningMessage = generateWarningMessage(flags, matchedTerms)
    log('⚠️ WARNING for search. Score:', totalScore, 'threshold:', thresholds.warnScore)
  }
  
  // 10. Check if should activate heightened mode
  if (updatedSession.totalScore >= thresholds.heightenedTrigger) {
    const heightened = await getHeightenedMode()
    if (!heightened?.active) {
      await activateHeightenedMode(
        `Accumulated score ${updatedSession.totalScore} exceeded threshold`,
        updatedSession.totalScore
      )
    }
  }
  
  // 11. Track stats
  await incrementDailyStat(action)
  
  const duration = Date.now() - startTime
  log(`[SearchIntel] Analyzed "${query.slice(0, 30)}..." in ${duration}ms → ${action} (score: ${totalScore})`)
  
  return {
    score: totalScore,
    flags,
    action,
    matchedTerms,
    warningMessage
  }
}

// ============================================================================
// WARNING MESSAGES
// ============================================================================

/**
 * Generate contextual warning message
 */
function generateWarningMessage(flags: SearchFlag[], matchedTerms: string[]): string {
  if (flags.includes('frantic_pattern')) {
    return "Tu fais beaucoup de recherches... Tout va bien ?"
  }
  
  if (flags.includes('escalation_pattern')) {
    return "Ces recherches semblent s'intensifier. Prends une pause ?"
  }
  
  if (flags.includes('evasion_attempt')) {
    return "On dirait que tu essaies de contourner la protection..."
  }
  
  if (flags.includes('suspicious_combination')) {
    return "Cette recherche semble suspecte. Tu veux vraiment continuer ?"
  }
  
  return "Cette recherche a été signalée. Fais attention !"
}

// ============================================================================
// DAILY STATS
// ============================================================================

interface DailyStats {
  date: string
  blockedSearches: number
  warnings: number
  heightenedActivations: number
}

/**
 * Get today's date key
 */
function getTodayKey(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Get daily stats
 */
async function getDailyStats(): Promise<DailyStats> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.DAILY_STATS)
  const stats = data[STORAGE_KEYS.DAILY_STATS] as DailyStats | undefined
  
  const today = getTodayKey()
  
  // Reset if new day
  if (!stats || stats.date !== today) {
    return {
      date: today,
      blockedSearches: 0,
      warnings: 0,
      heightenedActivations: 0
    }
  }
  
  return stats
}

/**
 * Increment daily stat
 */
async function incrementDailyStat(action: 'allow' | 'warn' | 'block'): Promise<void> {
  const stats = await getDailyStats()
  
  if (action === 'block') {
    stats.blockedSearches++
  } else if (action === 'warn') {
    stats.warnings++
  }
  
  await chrome.storage.local.set({ [STORAGE_KEYS.DAILY_STATS]: stats })
}

// ============================================================================
// EXPORTS FOR SERVICE WORKER
// ============================================================================

export {
  getSearchSession,
  resetSearchSession,
  getHeightenedMode,
  activateHeightenedMode,
  deactivateHeightenedMode,
  getDailyStats,
  getThresholds,
  updateBadge,
  DEFAULT_THRESHOLDS,
  HEIGHTENED_THRESHOLDS
}

// Quick check function for service worker
export function shouldAnalyzeSearch(query: string): boolean {
  // Don't analyze very short queries
  if (query.length < 3) return false
  
  // Quick check for obvious indicators
  if (hasEvasionIndicators(query)) return true
  
  // Always analyze (the analysis is fast)
  return true
}
