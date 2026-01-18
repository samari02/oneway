/**
 * Shared types for the browser extension
 */

export type BlockAction = 'block' | 'allow' | 'ask'

export type Mode = 'focus' | 'wind_down' | 'free'

export type Strictness = 'gentle' | 'guided' | 'strict'

export type Category = 
  | 'social_media'
  | 'news'
  | 'video'
  | 'entertainment'
  | 'shopping'
  | 'adult'
  | 'work'
  | 'other'

export interface BlockRule {
  id: string
  pattern: string  // Domain or URL pattern
  action: BlockAction
  reason?: string
  category?: Category
  modes?: Mode[]  // Active in these modes only
}

export interface NavigationEvent {
  url: string
  domain: string
  title?: string
  timestamp: number
  tabId: number
}

export interface BlockEvent {
  url: string
  domain: string
  title?: string
  reason: string
  action: 'blocked' | 'bypassed' | 'allowed'
  bypassMethod?: string
  mode?: Mode
  timestamp: number
}

export interface HistoryItem {
  url: string
  domain: string
  title?: string
  visitTime: number
  visitCount?: number
}

export interface StorageData {
  rules: BlockRule[]
  mode: Mode
  strictness: Strictness
  isActive: boolean
  cache: Record<string, BlockAction>
}

// Messages between extension components
export interface Message {
  type: string
  data?: any
}

export interface BlockDecisionMessage extends Message {
  type: 'BLOCK_DECISION'
  data: {
    url: string
    action: BlockAction
    reason?: string
  }
}

export interface ModeChangeMessage extends Message {
  type: 'MODE_CHANGE'
  data: {
    mode: Mode
    isActive: boolean
  }
}

export interface RequestHistoryPermissionMessage extends Message {
  type: 'REQUEST_HISTORY_PERMISSION'
}

export interface ImportHistoryMessage extends Message {
  type: 'IMPORT_HISTORY'
  data: {
    days: number
  }
}

export interface GetHistoryStatsMessage extends Message {
  type: 'GET_HISTORY_STATS'
}

// History collection types
export interface HistoryItem {
  url: string
  domain: string
  title?: string
  visitTime: number
  visitCount?: number
  category?: Category
}

export interface CategorizedVisit {
  url: string
  domain: string
  title?: string
  visitTime: number
  duration?: number
  category: Category
  isDistraction: boolean
}

export interface HistoryStats {
  totalVisits: number
  byCategory: Record<Category, number>
  topDomains: Array<{ domain: string; count: number; category: Category }>
  periodStart: number
  periodEnd: number
}

export interface HistoryCollectionStatus {
  hasPermission: boolean
  isCollecting: boolean
  lastImport?: number
  totalVisits: number
  periodDays: number
}

// Protection status for desktop app
export interface ProtectionStatus {
  extensionConnected: boolean
  incognitoEnabled: boolean
  safeSearchEnforced: boolean
  searchFilterActive: boolean
  blockedSearchesToday: number
}

// Aoi widget preferences
export interface AoiPreferences {
  hiddenGlobal: boolean
  hiddenDomains: string[]
}

// Messages for Aoi preferences sync
export interface AoiPreferencesUpdateMessage extends Message {
  type: 'AOI_PREFERENCES_UPDATE'
  data: AoiPreferences
}

export interface GetAoiPreferencesMessage extends Message {
  type: 'GET_AOI_PREFERENCES'
}

// ============================================================================
// INTELLIGENT BLOCKING SYSTEM - Types
// See docs/blocking/implementation.md for full architecture
// ============================================================================

/**
 * Search Intelligence - Layer 2
 * Tracks and analyzes search patterns to detect suspicious behavior
 */

/** Flags that can be applied to a search query */
export type SearchFlag =
  | 'explicit_keyword'        // Direct explicit term (porn, xxx, etc.)
  | 'suspicious_combination'  // Innocent words together = suspect (girl + ero)
  | 'evasion_attempt'        // Detected obfuscation (p0rn, s3x)
  | 'frantic_pattern'        // High velocity searching
  | 'escalation_pattern'     // Increasingly explicit searches
  | 'multilang_keyword'      // Explicit term in foreign language

/** A single search entry in the session */
export interface SearchEntry {
  query: string              // Original query
  normalizedQuery: string    // After anti-evasion normalization
  timestamp: number
  score: number              // Suspicion score for this search
  flags: SearchFlag[]        // What triggered the score
}

/** Active search session - persisted in chrome.storage.session */
export interface SearchSession {
  searches: SearchEntry[]    // Recent searches (last 5 minutes)
  totalScore: number         // Accumulated suspicion score
  lastActivity: number       // Timestamp of last search
  peakScore: number          // Highest score reached this session
}

/** Result of analyzing a single search query */
export interface SearchAnalysisResult {
  score: number              // Suspicion score (0-100)
  flags: SearchFlag[]        // What was detected
  action: 'allow' | 'warn' | 'block'
  matchedTerms: string[]     // Terms that matched
  warningMessage?: string    // Message to show if warning
}

/** Thresholds for search intelligence actions */
export interface SearchThresholds {
  warnScore: number          // Score to trigger warning (default: 20)
  blockScore: number         // Score to trigger block (default: 50)
  heightenedTrigger: number  // Accumulated score to activate heightened mode (default: 100)
  franticCount: number       // Searches in window to trigger frantic flag (default: 5)
  franticWindowMs: number    // Time window for frantic detection (default: 60000)
  sessionTimeoutMs: number   // Reset session after inactivity (default: 300000 = 5min)
}

/**
 * Content Analysis - Layer 3
 * Analyzes URLs and page content for explicit material
 */

/** Result of URL analysis (before page loads) */
export interface UrlAnalysisResult {
  score: number
  isSuspicious: boolean
  reasons: string[]
  suspiciousParts: string[]  // Which parts of URL triggered
}

/** Result of page content analysis (after page loads) */
export interface ContentAnalysisResult {
  score: number
  isExplicit: boolean
  reasons: string[]
  detectedMeta: string[]     // Meta tags found (rating, age restriction)
  keywordMatches: number     // Number of explicit keywords in body
}

/** Combined analysis result */
export interface PageAnalysisResult {
  url: UrlAnalysisResult
  content: ContentAnalysisResult | null  // null if page not yet loaded
  finalScore: number
  action: 'allow' | 'warn' | 'block'
}

/**
 * Heightened Mode
 * Activated when suspicious patterns detected, increases strictness temporarily
 */

export interface HeightenedModeState {
  active: boolean
  activatedAt: number | null
  expiresAt: number | null
  reason: string | null       // Why it was activated
  triggerScore: number        // Score that triggered it
  originalThresholds: SearchThresholds | null  // To restore later
}

/** Configuration for heightened mode */
export interface HeightenedModeConfig {
  durationMs: number          // How long it stays active (default: 1800000 = 30min)
  scoreMultiplier: number     // Multiply suspicion scores by this (default: 1.5)
  thresholdReduction: number  // Reduce thresholds by this factor (default: 0.6)
  notifyDesktop: boolean      // Send alert to desktop app
}

/**
 * Blocking Status - For desktop app communication
 */

export interface IntelligentBlockingStatus {
  // Counters
  blockedSearchesToday: number
  warningsToday: number
  blockedSitesToday: number
  
  // Session
  currentSessionScore: number
  searchesInSession: number
  
  // Heightened mode
  heightenedMode: HeightenedModeState
  
  // Last action
  lastBlockedUrl: string | null
  lastBlockedReason: string | null
  lastBlockedAt: number | null
}

/**
 * Storage extension for intelligent blocking
 */

export interface IntelligentBlockingStorage {
  // Search session (use chrome.storage.session for auto-cleanup)
  searchSession: SearchSession
  
  // Heightened mode state
  heightenedMode: HeightenedModeState
  
  // Daily stats (reset at midnight)
  dailyStats: {
    date: string  // YYYY-MM-DD
    blockedSearches: number
    warnings: number
    blockedSites: number
    heightenedActivations: number
  }
  
  // Thresholds (can be customized per user)
  searchThresholds: SearchThresholds
  heightenedConfig: HeightenedModeConfig
}
