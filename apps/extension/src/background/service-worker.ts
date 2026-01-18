/**
 * Background Service Worker
 * Main logic for the extension
 */

import { DEFAULT_BLOCKLIST, STORAGE_KEYS, BLOCK_SCREEN_URL } from '../shared/constants'
import { extractDomain, matchesPattern, log } from '../shared/utils'
import type { BlockRule, StorageData, NavigationEvent, BlockEvent, ProtectionStatus } from '../shared/types'
import {
  isExplicitSearch,
  extractSearchQuery,
  isSearchEngine,
  incrementBlockedSearches,
  getBlockedSearchesToday
} from './search-filter'
import {
  analyzeSearch,
  shouldAnalyzeSearch,
  getHeightenedMode,
  getDailyStats
} from './search-intelligence'
import {
  requestHistoryPermission,
  importHistory,
  recordVisit,
  getCollectionStatus,
  calculateHistoryStats
} from './history-collector'
import {
  connectToDesktopApp,
  isDesktopAppConnected,
  getConnectionStatus,
  sendNavigationEvent,
  sendBlockEvent,
  sendHistorySync,
  sendAoiPreferencesUpdate
} from './native-messaging'

// NOTE: Supabase sync temporarily disabled
// Supabase client is not compatible with Chrome extension service workers
// TODO: Use fetch-based API calls instead of Supabase client
// import {
//   syncHistoryToSupabase,
//   getSyncStatus,
//   cleanupSyncedHistory,
//   fetchStatsFromSupabase
// } from './history-sync'
// import { getCurrentUser, isAuthenticated, signInWithEmail, signOut } from '../lib/supabase'

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  log('Extension installed')
  
  // Initialize default storage
  const defaultData: Partial<StorageData> = {
    rules: DEFAULT_BLOCKLIST,
    mode: 'focus',
    strictness: 'guided',
    isActive: true,
    cache: {}
  }
  
  await chrome.storage.local.set(defaultData)
  log('Default storage initialized', defaultData)
  
  // Try to connect to desktop app (with delay to avoid startup issues)
  setTimeout(async () => {
    try {
      connectToDesktopApp()
      // Send existing history if we have it
      await syncExistingHistoryToDesktop()
    } catch (e) {
      log('Desktop app not available:', e)
    }
  }, 2000)
})

// On startup, try to connect to desktop app
chrome.runtime.onStartup.addListener(() => {
  log('Extension started')
  setTimeout(async () => {
    try {
      connectToDesktopApp()
      // Send existing history if we have it
      await syncExistingHistoryToDesktop()
    } catch (e) {
      log('Desktop app not available:', e)
    }
  }, 2000)
})

/**
 * Sync existing local history to desktop app
 * Called when extension starts and desktop connection is established
 * Uses lastDesktopSync timestamp to avoid redundant syncs
 */
async function syncExistingHistoryToDesktop() {
  // Wait a bit for connection to be established
  await new Promise(resolve => setTimeout(resolve, 3000))
  
  if (!isDesktopAppConnected()) {
    log('Cannot sync history: desktop not connected')
    return
  }
  
  const { navigationHistory = [], lastDesktopSync = 0 } = await chrome.storage.local.get([
    'navigationHistory',
    'lastDesktopSync'
  ])
  
  // Only sync if we haven't synced in the last 5 minutes (avoid redundant syncs)
  const SYNC_COOLDOWN = 5 * 60 * 1000 // 5 minutes
  const now = Date.now()
  
  if (now - lastDesktopSync < SYNC_COOLDOWN) {
    log('Skipping sync: already synced', Math.round((now - lastDesktopSync) / 1000), 'seconds ago')
    return
  }
  
  if (navigationHistory.length > 0) {
    log('Syncing existing history to desktop:', navigationHistory.length, 'visits')
    await sendHistorySync(navigationHistory)
    
    // Update sync timestamp
    await chrome.storage.local.set({ lastDesktopSync: now })
  } else {
    log('No existing history to sync')
  }
}

// Monitor navigation - blocking
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only main frame navigations
  if (details.frameId !== 0) return
  
  const event: NavigationEvent = {
    url: details.url,
    domain: extractDomain(details.url),
    timestamp: details.timeStamp,
    tabId: details.tabId
  }
  
  log('Navigation detected:', event.domain, 'on tab', details.tabId)
  
  // Check for explicit/suspicious search queries FIRST (before other blocking rules)
  // Uses the intelligent search analysis engine (Layer 2)
  if (isSearchEngine(details.url)) {
    const query = extractSearchQuery(details.url)
    if (query && shouldAnalyzeSearch(query)) {
      const analysisResult = await analyzeSearch(query)
      
      if (analysisResult.action === 'block') {
        log('🛑 BLOCKING search:', query.slice(0, 50), '(score:', analysisResult.score, ')')
        
        const reason = analysisResult.matchedTerms.length > 0
          ? `Search blocked: ${analysisResult.matchedTerms[0]}`
          : 'Search blocked for your protection'
        
        const blockUrl = `${BLOCK_SCREEN_URL}?url=${encodeURIComponent(details.url)}&reason=${encodeURIComponent(reason)}&tabId=${details.tabId}&type=search`
        
        chrome.tabs.update(details.tabId, { url: blockUrl })
        
        // Track blocked search (legacy counter)
        await incrementBlockedSearches()
        
        // Log block event
        await logBlockEvent({
          url: details.url,
          domain: event.domain,
          reason: `Intelligent block (score: ${analysisResult.score}, flags: ${analysisResult.flags.join(', ')})`,
          action: 'blocked',
          timestamp: Date.now()
        })
        
        return // Stop processing
      }
      
      if (analysisResult.action === 'warn') {
        log('⚠️ WARNING for search:', query.slice(0, 50), '(score:', analysisResult.score, ')')
        // TODO: Inject warning UI via content script
        // For now, just log and continue
        // In Phase 3, we'll show a toast/banner on the search results page
      }
    }
  }
  
  // Check if should be blocked by regular rules
  const decision = await shouldBlock(event.url, details.tabId)
  
  if (decision.shouldBlock) {
    log('Blocking:', event.domain, decision.reason)
    
    // Redirect to block screen with tab ID
    const blockUrl = `${BLOCK_SCREEN_URL}?url=${encodeURIComponent(event.url)}&reason=${encodeURIComponent(decision.reason || '')}&tabId=${details.tabId}`
    
    chrome.tabs.update(details.tabId, { url: blockUrl })
    
    // Log block event
    await logBlockEvent({
      url: event.url,
      domain: event.domain,
      reason: decision.reason || 'Blocked by rules',
      action: 'blocked',
      timestamp: Date.now()
    })
  }
})

// Monitor navigation - history recording
chrome.webNavigation.onCompleted.addListener(async (details) => {
  // Only main frame navigations
  if (details.frameId !== 0) return
  
  // Don't record our own block screen
  if (details.url.startsWith(chrome.runtime.getURL(''))) return
  
  // Record visit for history
  try {
    const tab = await chrome.tabs.get(details.tabId)
    const visit = await recordVisit(details.url, tab.title)
    
    // Send to desktop app if connected
    if (visit && isDesktopAppConnected()) {
      sendNavigationEvent(visit)
    }
  } catch (error) {
    // Permission not granted or error - fail silently
  }
})

/**
 * Check if URL should be blocked
 */
async function shouldBlock(url: string, tabId: number): Promise<{ shouldBlock: boolean; reason?: string }> {
  const storage = await chrome.storage.local.get([
    STORAGE_KEYS.RULES,
    STORAGE_KEYS.MODE,
    STORAGE_KEYS.IS_ACTIVE,
    'allowedTabs'
  ]) as Partial<StorageData> & { allowedTabs?: Record<number, { domain: string; expiresAt: number }> }
  
  // If not active, allow everything
  if (!storage.isActive) {
    return { shouldBlock: false }
  }
  
  const domain = extractDomain(url)
  
  // Check tab-specific allowlist first
  if (storage.allowedTabs && storage.allowedTabs[tabId]) {
    const allowed = storage.allowedTabs[tabId]
    if (allowed.domain === domain && allowed.expiresAt > Date.now()) {
      log('Tab', tabId, 'is allowed for', domain, 'until', new Date(allowed.expiresAt).toLocaleTimeString())
      return { shouldBlock: false }
    }
  }
  
  // Check rules
  const rules = storage.rules || DEFAULT_BLOCKLIST
  
  for (const rule of rules) {
    if (matchesPattern(url, rule.pattern)) {
      if (rule.action === 'block') {
        return { shouldBlock: true, reason: rule.reason }
      }
      if (rule.action === 'ask') {
        // For now, treat 'ask' as block (we'll add UI for this later)
        return { shouldBlock: true, reason: rule.reason }
      }
    }
  }
  
  return { shouldBlock: false }
}

/**
 * Log block event
 */
async function logBlockEvent(event: BlockEvent) {
  // For now, just store locally
  // Later: send to Electron app via Native Messaging
  const history = await chrome.storage.local.get('blockHistory') as { blockHistory?: BlockEvent[] }
  const blockHistory = history.blockHistory || []
  
  blockHistory.push(event)
  
  // Keep last 1000 events
  if (blockHistory.length > 1000) {
    blockHistory.shift()
  }
  
  await chrome.storage.local.set({ blockHistory })
  log('Block event logged:', event)
}

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log('Message received:', message)
  
  if (message.type === 'BYPASS_BLOCK') {
    handleBypass(message.data).then(sendResponse)
    return true // Keep channel open for async response
  }
  
  if (message.type === 'GET_STATUS') {
    getStatus().then(sendResponse)
    return true
  }
  
  if (message.type === 'REQUEST_HISTORY_PERMISSION') {
    requestHistoryPermission().then(sendResponse)
    return true
  }
  
  if (message.type === 'IMPORT_HISTORY') {
    importHistory(message.data?.days || 30)
      .then(async (visits) => {
        // Send to desktop app if connected
        if (isDesktopAppConnected()) {
          await sendHistorySync(visits)
          // Update sync timestamp to prevent redundant auto-sync
          await chrome.storage.local.set({ lastDesktopSync: Date.now() })
          log('History imported and sent to desktop:', visits.length, 'visits')
        } else {
          log('History imported but desktop not connected:', visits.length, 'visits')
        }
        sendResponse({ success: true, visits: visits.length })
      })
      .catch(error => sendResponse({ success: false, error: error.message }))
    return true
  }
  
  if (message.type === 'GET_HISTORY_STATS') {
    getHistoryStats().then(sendResponse)
    return true
  }
  
  if (message.type === 'GET_COLLECTION_STATUS') {
    getCollectionStatus().then(sendResponse)
    return true
  }
  
  // Intelligent Blocking Status
  if (message.type === 'GET_INTELLIGENT_BLOCKING_STATUS') {
    getIntelligentBlockingStatus().then(sendResponse)
    return true
  }
  
  // Supabase sync messages - temporarily disabled
  // TODO: Implement using fetch API instead of Supabase client
  if (message.type === 'SYNC_TO_SUPABASE') {
    sendResponse({ success: false, error: 'Sync not yet available' })
    return true
  }
  
  if (message.type === 'GET_SYNC_STATUS') {
    sendResponse({ isAuthenticated: false, pendingCount: 0, lastSync: null, totalSynced: 0 })
    return true
  }
  
  if (message.type === 'GET_AUTH_STATUS') {
    sendResponse({ authenticated: false, user: null })
    return true
  }
  
  if (message.type === 'SIGN_IN') {
    sendResponse({ error: { message: 'Auth not yet available in extension' } })
    return true
  }
  
  if (message.type === 'SIGN_OUT') {
    sendResponse({ success: true })
    return true
  }
  
  if (message.type === 'FETCH_CLOUD_STATS') {
    sendResponse(null)
    return true
  }
  
  // Native messaging / Desktop app connection
  if (message.type === 'GET_DESKTOP_STATUS') {
    getConnectionStatus().then(sendResponse)
    return true
  }
  
  if (message.type === 'CONNECT_DESKTOP') {
    const success = connectToDesktopApp()
    sendResponse({ success })
    return true
  }
  
  // Protection status for desktop app
  if (message.type === 'GET_PROTECTION_STATUS') {
    getProtectionStatus().then(sendResponse)
    return true
  }
  
  // Aoi widget status for content script
  if (message.type === 'GET_AOI_STATUS') {
    getAoiStatus(sender.tab?.url).then(sendResponse)
    return true
  }
  
  // Open popup (for Aoi widget click)
  if (message.type === 'OPEN_POPUP') {
    // Can't programmatically open popup, but we can focus the extension
    chrome.action.openPopup?.() // Only works in some Chrome versions
    sendResponse({ success: true })
    return true
  }
  
  // Aoi preferences update from content script → sync to desktop → Supabase
  if (message.type === 'AOI_PREFERENCES_UPDATE') {
    handleAoiPreferencesUpdate(message.data).then(sendResponse)
    return true
  }
})

/**
 * Handle Aoi preferences update from content script
 * Forwards to desktop app for Supabase sync
 */
async function handleAoiPreferencesUpdate(data: { hiddenGlobal: boolean; hiddenDomains: string[] }) {
  log('Aoi preferences update:', data)
  
  // Save locally as backup
  await chrome.storage.local.set({
    clarity_hidden_global: data.hiddenGlobal,
    clarity_hidden_domains: data.hiddenDomains
  })
  
  // Send to desktop app if connected (for Supabase sync)
  if (isDesktopAppConnected()) {
    sendAoiPreferencesUpdate(data)
    log('Aoi preferences sent to desktop')
    return { success: true, synced: true }
  } else {
    log('Aoi preferences saved locally (desktop not connected)')
    return { success: true, synced: false }
  }
}

/**
 * Handle bypass request
 */
async function handleBypass(data: { url: string; method: string; tabId: number }) {
  log('Bypass requested:', data)
  
  const domain = extractDomain(data.url)
  
  // Log bypass event
  await logBlockEvent({
    url: data.url,
    domain,
    reason: 'User bypassed',
    action: 'bypassed',
    bypassMethod: data.method,
    timestamp: Date.now()
  })
  
  // Add to tab-specific allowlist
  const storage = await chrome.storage.local.get('allowedTabs') as { 
    allowedTabs?: Record<number, { domain: string; expiresAt: number }> 
  }
  const allowedTabs = storage.allowedTabs || {}
  
  // Allow this tab for this domain for the next 5 minutes
  const expiresAt = Date.now() + (5 * 60 * 1000)
  allowedTabs[data.tabId] = {
    domain,
    expiresAt
  }
  
  await chrome.storage.local.set({ allowedTabs })
  
  log('Tab', data.tabId, 'allowed for', domain, 'until', new Date(expiresAt).toLocaleTimeString())
  
  return { success: true }
}

/**
 * Get current status
 */
async function getStatus() {
  const storage = await chrome.storage.local.get([
    STORAGE_KEYS.MODE,
    STORAGE_KEYS.IS_ACTIVE,
    STORAGE_KEYS.STRICTNESS
  ]) as Partial<StorageData>
  
  // Get block stats
  const history = await chrome.storage.local.get('blockHistory') as { blockHistory?: BlockEvent[] }
  const blockHistory = history.blockHistory || []
  
  // Count blocks today
  const today = new Date().setHours(0, 0, 0, 0)
  const blocksToday = blockHistory.filter(e => e.timestamp >= today && e.action === 'blocked').length
  
  return {
    mode: storage.mode || 'free',
    isActive: storage.isActive || false,
    strictness: storage.strictness || 'guided',
    blocksToday
  }
}

/**
 * Get history stats
 */
async function getHistoryStats() {
  const { navigationHistory = [] } = await chrome.storage.local.get('navigationHistory')
  const stats = calculateHistoryStats(navigationHistory)
  return stats
}

// Periodic sync - temporarily disabled until we implement fetch-based API
// chrome.alarms.create('sync-to-supabase', { periodInMinutes: 30 })
// chrome.alarms.create('cleanup-history', { periodInMinutes: 1440 })

/**
 * Get protection status for desktop app
 */
async function getProtectionStatus(): Promise<ProtectionStatus> {
  // Check if running in incognito context
  // Note: This only tells us if THIS context is incognito, not if extension is allowed in incognito
  // The real check needs to be done via chrome.extension.isAllowedIncognitoAccess
  let incognitoEnabled = false
  try {
    incognitoEnabled = await chrome.extension.isAllowedIncognitoAccess()
  } catch (e) {
    log('Could not check incognito access:', e)
  }
  
  // Get blocked searches count
  const blockedSearchesToday = await getBlockedSearchesToday()
  
  return {
    extensionConnected: true, // If we can respond, we're connected
    incognitoEnabled,
    safeSearchEnforced: true, // Always true since we have the rules.json
    searchFilterActive: true, // Always active
    blockedSearchesToday
  }
}

/**
 * Get intelligent blocking status (Layer 2 stats)
 */
async function getIntelligentBlockingStatus() {
  const dailyStats = await getDailyStats()
  const heightenedMode = await getHeightenedMode()
  const blockedSearches = await getBlockedSearchesToday()
  
  return {
    // Daily counters
    blockedSearchesToday: blockedSearches,
    warningsToday: dailyStats.warnings,
    heightenedActivationsToday: dailyStats.heightenedActivations,
    
    // Heightened mode status
    heightenedMode: {
      active: heightenedMode?.active || false,
      activatedAt: heightenedMode?.activatedAt || null,
      expiresAt: heightenedMode?.expiresAt || null,
      reason: heightenedMode?.reason || null
    },
    
    // Feature status
    intelligentBlockingActive: true,
    version: '2.0' // Phase 2 implementation
  }
}

/**
 * Get Aoi widget status for content script
 */
async function getAoiStatus(url?: string): Promise<{
  alertLevel: 'ok' | 'warning' | 'critical'
  isDistraction: boolean
  siteCategory: string
}> {
  // Check protection status first
  const protectionStatus = await getProtectionStatus()
  
  // Check if desktop is connected (via last heartbeat check)
  // For now, we'll consider it OK if extension is working
  // The real heartbeat check would need to come from the native messaging module
  
  // Determine if current site is a distraction
  let isDistraction = false
  let siteCategory = 'productive'
  
  if (url) {
    const domain = extractDomain(url)
    
    // List of known distraction domains
    const distractionDomains = [
      // Social media
      'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'tiktok.com',
      'linkedin.com', 'snapchat.com', 'threads.net',
      // Video/Entertainment
      'youtube.com', 'netflix.com', 'twitch.tv', 'hulu.com', 'disneyplus.com',
      'primevideo.com', 'hbomax.com',
      // News/Forums
      'reddit.com', 'news.ycombinator.com', 'hackernews.com',
      // Gaming
      'twitch.tv', 'discord.com',
      // Other time sinks
      'buzzfeed.com', '9gag.com', 'imgur.com'
    ]
    
    const neutralDomains = [
      // Work tools - not distraction but not productive browsing
      'gmail.com', 'mail.google.com', 'outlook.com', 'slack.com'
    ]
    
    // Check if domain matches any distraction
    isDistraction = distractionDomains.some(d => 
      domain === d || domain.endsWith('.' + d)
    )
    
    const isNeutral = neutralDomains.some(d => 
      domain === d || domain.endsWith('.' + d)
    )
    
    if (isDistraction) {
      siteCategory = 'distraction'
    } else if (isNeutral) {
      siteCategory = 'neutral'
    } else {
      siteCategory = 'productive'
    }
  }
  
  // Determine alert level
  // For now, always OK since we're the extension and we're running
  // The real alert level would come from heartbeat system but that's 
  // desktop-side. Here we just care about whether extension is working.
  let alertLevel: 'ok' | 'warning' | 'critical' = 'ok'
  
  // If incognito not enabled and we're in incognito, that's a warning
  // But we can't easily detect if we're in incognito from service worker
  // The content script runs in both contexts
  
  return {
    alertLevel,
    isDistraction,
    siteCategory
  }
}

log('Service worker loaded')
