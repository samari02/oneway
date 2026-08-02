/**
 * Background Service Worker
 * Main logic for the extension
 */
import { DEFAULT_BLOCKLIST, STORAGE_KEYS, BLOCK_SCREEN_URL, isOwnExtensionUrl, DEFAULT_DISABLE_FRICTION_SECS, DISABLE_FRICTION_OPTIONS } from '../shared/constants';
import { extractDomain, matchesPattern, log, urlMatchesAdultDomainList } from '../shared/utils';
import { extractSearchQuery, isSearchEngine, extractRedirectDestination, isEmailTrackingUrl, incrementBlockedSearches, getBlockedSearchesToday } from './search-filter';
import { analyzeSearch, shouldAnalyzeSearch, getHeightenedMode, getDailyStats, updateBadge, getSearchSession } from './search-intelligence';
import { requestHistoryPermission, importHistory, recordVisit, getCollectionStatus, calculateHistoryStats, recategorizeHistory } from './history-collector';
import { connectToDesktopApp, isDesktopAppConnected, getConnectionStatus, sendNavigationEvent, sendHistorySync, sendAoiPreferencesUpdate } from './native-messaging';
import { ensureBundledAdultBlocklistSeed, getAdultBlocklistDomains } from './adult-blocklist';
import { recordAdultBlockCandidate } from './adult-candidates';
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
    log('Extension installed');
    // Initialize default storage
    const defaultData = {
        rules: DEFAULT_BLOCKLIST,
        mode: 'focus',
        strictness: 'guided',
        isActive: true,
        cache: {}
    };
    await chrome.storage.local.set(defaultData);
    log('Default storage initialized', defaultData);
    await ensureBundledAdultBlocklistSeed();
    // Restore badge state if heightened mode is active
    await restoreBadgeState();
    // Try to connect to desktop app (with delay to avoid startup issues)
    setTimeout(async () => {
        try {
            connectToDesktopApp();
            // Send existing history if we have it
            await syncExistingHistoryToDesktop();
        }
        catch (e) {
            log('Desktop app not available:', e);
        }
    }, 2000);
});
// On startup, try to connect to desktop app
chrome.runtime.onStartup.addListener(async () => {
    log('Extension started');
    await ensureBundledAdultBlocklistSeed();
    // Restore badge state if heightened mode is active
    await restoreBadgeState();
    setTimeout(async () => {
        try {
            connectToDesktopApp();
            // Send existing history if we have it
            await syncExistingHistoryToDesktop();
        }
        catch (e) {
            log('Desktop app not available:', e);
        }
    }, 2000);
});
/**
 * Restore badge state based on heightened mode
 * Called on extension install/startup to ensure badge reflects current state
 */
async function restoreBadgeState() {
    const heightened = await getHeightenedMode();
    await updateBadge(heightened?.active || false);
    log('Badge state restored:', heightened?.active ? 'heightened' : 'normal');
}
/**
 * Sync existing local history to desktop app
 * Called when extension starts and desktop connection is established
 * Uses lastDesktopSync timestamp to avoid redundant syncs
 */
async function syncExistingHistoryToDesktop() {
    // Wait a bit for connection to be established
    await new Promise(resolve => setTimeout(resolve, 3000));
    if (!isDesktopAppConnected()) {
        log('Cannot sync history: desktop not connected');
        return;
    }
    const { navigationHistory = [], lastDesktopSync = 0 } = await chrome.storage.local.get([
        'navigationHistory',
        'lastDesktopSync'
    ]);
    // Only sync if we haven't synced in the last 5 minutes (avoid redundant syncs)
    const SYNC_COOLDOWN = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    if (now - lastDesktopSync < SYNC_COOLDOWN) {
        log('Skipping sync: already synced', Math.round((now - lastDesktopSync) / 1000), 'seconds ago');
        return;
    }
    if (navigationHistory.length > 0) {
        log('Syncing existing history to desktop:', navigationHistory.length, 'visits');
        await sendHistorySync(navigationHistory);
        // Update sync timestamp
        await chrome.storage.local.set({ lastDesktopSync: now });
    }
    else {
        log('No existing history to sync');
    }
}
// Monitor navigation - blocking
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    // Only main frame navigations
    if (details.frameId !== 0)
        return;
    // Never block or re-analyze our own extension pages (especially block-screen.html)
    if (isOwnExtensionUrl(details.url))
        return;
    let urlToAnalyze = details.url;
    // Check if this is a redirect URL (Google/Bing click tracking)
    // If so, extract the destination URL for analysis
    const redirectDestination = extractRedirectDestination(details.url);
    if (redirectDestination) {
        log('Redirect detected, destination:', redirectDestination.slice(0, 80));
        urlToAnalyze = redirectDestination;
        // Skip analysis if destination is an email tracking URL
        if (isEmailTrackingUrl(redirectDestination)) {
            log('Skipping email tracking URL:', redirectDestination.slice(0, 80));
            return; // Don't block email tracking links
        }
    }
    // Skip analysis for email tracking URLs (even if not through redirect)
    if (isEmailTrackingUrl(details.url)) {
        log('Skipping email tracking URL:', details.url.slice(0, 80));
        return;
    }
    const event = {
        url: urlToAnalyze,
        domain: extractDomain(urlToAnalyze),
        timestamp: details.timeStamp,
        tabId: details.tabId
    };
    log('Navigation detected:', event.domain, 'on tab', details.tabId);
    // Check for explicit/suspicious search queries FIRST (before other blocking rules)
    // Uses the intelligent search analysis engine (Layer 2)
    // Note: isSearchEngine returns false for redirect URLs (google.com/url)
    if (isSearchEngine(details.url)) {
        const query = extractSearchQuery(details.url);
        if (query) {
            const customSearch = await checkCustomSearchKeywords(query);
            if (customSearch.blocked) {
                const reason = customSearch.reason || 'Search blocked by your custom rule';
                const blockUrl = `${BLOCK_SCREEN_URL}?url=${encodeURIComponent(details.url)}&reason=${encodeURIComponent(reason)}&tabId=${details.tabId}&type=search`;
                chrome.tabs.update(details.tabId, { url: blockUrl });
                await incrementBlockedSearches();
                await logBlockEvent({
                    url: details.url,
                    domain: event.domain,
                    reason,
                    action: 'blocked',
                    timestamp: Date.now()
                });
                return;
            }
        }
        if (query && shouldAnalyzeSearch(query)) {
            const analysisResult = await analyzeSearch(query);
            if (analysisResult.action === 'block') {
                log('🛑 BLOCKING search:', query.slice(0, 50), '(score:', analysisResult.score, ')');
                const reason = analysisResult.matchedTerms.length > 0
                    ? `Search blocked: ${analysisResult.matchedTerms[0]}`
                    : 'Search blocked for your protection';
                const blockUrl = `${BLOCK_SCREEN_URL}?url=${encodeURIComponent(details.url)}&reason=${encodeURIComponent(reason)}&tabId=${details.tabId}&type=search`;
                chrome.tabs.update(details.tabId, { url: blockUrl });
                // Track blocked search (legacy counter)
                await incrementBlockedSearches();
                // Log block event
                await logBlockEvent({
                    url: details.url,
                    domain: event.domain,
                    reason: `Intelligent block (score: ${analysisResult.score}, flags: ${analysisResult.flags.join(', ')})`,
                    action: 'blocked',
                    timestamp: Date.now()
                });
                return; // Stop processing
            }
            if (analysisResult.action === 'warn') {
                log('⚠️ WARNING for search:', query.slice(0, 50), '(score:', analysisResult.score, ')');
                // TODO: Inject warning UI via content script
                // For now, just log and continue
                // In Phase 3, we'll show a toast/banner on the search results page
            }
        }
    }
    // Check if should be blocked by regular rules
    const decision = await shouldBlock(event.url, details.tabId);
    if (decision.shouldBlock) {
        log('Blocking:', event.domain, decision.reason);
        // Redirect to block screen with tab ID
        const blockUrl = `${BLOCK_SCREEN_URL}?url=${encodeURIComponent(event.url)}&reason=${encodeURIComponent(decision.reason || '')}&tabId=${details.tabId}`;
        chrome.tabs.update(details.tabId, { url: blockUrl });
        // Log block event
        await logBlockEvent({
            url: event.url,
            domain: event.domain,
            reason: decision.reason || 'Blocked by rules',
            action: 'blocked',
            timestamp: Date.now()
        });
    }
});
// Monitor navigation - history recording
chrome.webNavigation.onCompleted.addListener(async (details) => {
    // Only main frame navigations
    if (details.frameId !== 0)
        return;
    // Don't record our own block screen
    if (details.url.startsWith(chrome.runtime.getURL('')))
        return;
    // Record visit for history
    try {
        const tab = await chrome.tabs.get(details.tabId);
        const visit = await recordVisit(details.url, tab.title);
        // Send to desktop app if connected
        if (visit && isDesktopAppConnected()) {
            sendNavigationEvent(visit);
        }
    }
    catch (error) {
        // Permission not granted or error - fail silently
    }
});
/**
 * Block search if query contains a user keyword (Boundaries → Blocking, search rules).
 */
async function checkCustomSearchKeywords(query) {
    const data = await chrome.storage.local.get(STORAGE_KEYS.CUSTOM_SEARCH_KEYWORDS);
    const keywords = data[STORAGE_KEYS.CUSTOM_SEARCH_KEYWORDS];
    if (!Array.isArray(keywords) || keywords.length === 0) {
        return { blocked: false };
    }
    const q = query.toLowerCase();
    for (const kw of keywords) {
        if (typeof kw === 'string' && kw.length >= 3 && q.includes(kw.toLowerCase())) {
            return { blocked: true, reason: `Search blocked: ${kw}` };
        }
    }
    return { blocked: false };
}
/**
 * Check if URL should be blocked
 */
async function shouldBlock(url, tabId) {
    if (isOwnExtensionUrl(url)) {
        return { shouldBlock: false };
    }
    const storage = await chrome.storage.local.get([
        STORAGE_KEYS.RULES,
        STORAGE_KEYS.CUSTOM_BLOCKING_RULES,
        STORAGE_KEYS.MODE,
        STORAGE_KEYS.IS_ACTIVE
    ]);
    // If not active, allow everything
    if (!storage.isActive) {
        return { shouldBlock: false };
    }
    // System adult list (bundled seed ∪ desktop sync) — additive with static DNR
    const adultDomains = await getAdultBlocklistDomains();
    if (urlMatchesAdultDomainList(url, adultDomains)) {
        return { shouldBlock: true, reason: 'Adult content is blocked' };
    }
    // Check rules (built-in + user custom from desktop sync)
    const baseRules = storage.rules || DEFAULT_BLOCKLIST;
    const custom = storage.customBlockingRules ?? [];
    const rules = [...baseRules, ...custom];
    for (const rule of rules) {
        if (matchesPattern(url, rule.pattern)) {
            if (rule.action === 'block') {
                return { shouldBlock: true, reason: rule.reason };
            }
            if (rule.action === 'ask') {
                // For now, treat 'ask' as block (we'll add UI for this later)
                return { shouldBlock: true, reason: rule.reason };
            }
        }
    }
    return { shouldBlock: false };
}
/**
 * Log block event
 */
async function logBlockEvent(event) {
    // For now, just store locally
    // Later: send to Electron app via Native Messaging
    const history = await chrome.storage.local.get('blockHistory');
    const blockHistory = history.blockHistory || [];
    blockHistory.push(event);
    // Keep last 1000 events
    if (blockHistory.length > 1000) {
        blockHistory.shift();
    }
    await chrome.storage.local.set({ blockHistory });
    log('Block event logged:', event);
}
// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    log('Message received:', message);
    if (message.type === 'GET_STATUS') {
        getStatus().then(sendResponse);
        return true;
    }
    if (message.type === 'REQUEST_HISTORY_PERMISSION') {
        requestHistoryPermission().then(sendResponse);
        return true;
    }
    if (message.type === 'IMPORT_HISTORY') {
        importHistory(message.data?.days || 30)
            .then(async (visits) => {
            // Send to desktop app if connected
            if (isDesktopAppConnected()) {
                await sendHistorySync(visits);
                // Update sync timestamp to prevent redundant auto-sync
                await chrome.storage.local.set({ lastDesktopSync: Date.now() });
                log('History imported and sent to desktop:', visits.length, 'visits');
            }
            else {
                log('History imported but desktop not connected:', visits.length, 'visits');
            }
            sendResponse({ success: true, visits: visits.length });
        })
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    if (message.type === 'GET_HISTORY_STATS') {
        getHistoryStats().then(sendResponse);
        return true;
    }
    if (message.type === 'GET_COLLECTION_STATUS') {
        getCollectionStatus().then(sendResponse);
        return true;
    }
    if (message.type === 'RECATEGORIZE_HISTORY') {
        recategorizeHistory().then(sendResponse);
        return true;
    }
    // Intelligent Blocking Status
    if (message.type === 'GET_INTELLIGENT_BLOCKING_STATUS') {
        getIntelligentBlockingStatus().then(sendResponse);
        return true;
    }
    // Supabase sync messages - temporarily disabled
    // TODO: Implement using fetch API instead of Supabase client
    if (message.type === 'SYNC_TO_SUPABASE') {
        sendResponse({ success: false, error: 'Sync not yet available' });
        return true;
    }
    if (message.type === 'GET_SYNC_STATUS') {
        sendResponse({ isAuthenticated: false, pendingCount: 0, lastSync: null, totalSynced: 0 });
        return true;
    }
    if (message.type === 'GET_AUTH_STATUS') {
        sendResponse({ authenticated: false, user: null });
        return true;
    }
    if (message.type === 'SIGN_IN') {
        sendResponse({ error: { message: 'Auth not yet available in extension' } });
        return true;
    }
    if (message.type === 'SIGN_OUT') {
        sendResponse({ success: true });
        return true;
    }
    if (message.type === 'FETCH_CLOUD_STATS') {
        sendResponse(null);
        return true;
    }
    // Native messaging / Desktop app connection
    if (message.type === 'GET_DESKTOP_STATUS') {
        getConnectionStatus().then(sendResponse);
        return true;
    }
    if (message.type === 'CONNECT_DESKTOP') {
        const success = connectToDesktopApp();
        sendResponse({ success });
        return true;
    }
    // Protection status for desktop app
    if (message.type === 'GET_PROTECTION_STATUS') {
        getProtectionStatus().then(sendResponse);
        return true;
    }
    // Pause / resume protection (popup). Friction for pause lives in the popup UI.
    if (message.type === 'TOGGLE_MODE') {
        toggleIsActive().then(sendResponse);
        return true;
    }
    if (message.type === 'SET_IS_ACTIVE') {
        setIsActive(Boolean(message.data?.isActive)).then(sendResponse);
        return true;
    }
    if (message.type === 'GET_DISABLE_FRICTION_SECS') {
        getDisableFrictionSecs().then(sendResponse);
        return true;
    }
    if (message.type === 'SET_DISABLE_FRICTION_SECS') {
        setDisableFrictionSecs(message.data?.secs).then(sendResponse);
        return true;
    }
    // Aoi widget status for content script
    if (message.type === 'GET_AOI_STATUS') {
        getAoiStatus(sender.tab?.url).then(sendResponse);
        return true;
    }
    // Open popup (for Aoi widget click)
    if (message.type === 'OPEN_POPUP') {
        // Can't programmatically open popup, but we can focus the extension
        chrome.action.openPopup?.(); // Only works in some Chrome versions
        sendResponse({ success: true });
        return true;
    }
    // Aoi preferences update from content script → sync to desktop → Supabase
    if (message.type === 'AOI_PREFERENCES_UPDATE') {
        handleAoiPreferencesUpdate(message.data).then(sendResponse);
        return true;
    }
    // Page content analysis result from content script (Layer 3)
    if (message.type === 'PAGE_ANALYSIS_RESULT') {
        handlePageAnalysisResult(message.data, sender).then(sendResponse);
        return true;
    }
    // Get page analysis data for debug panel
    if (message.type === 'GET_PAGE_ANALYSIS') {
        getPageAnalysisData(message.data).then(sendResponse);
        return true;
    }
});
/**
 * Handle page content analysis result from content script (Layer 3)
 */
async function handlePageAnalysisResult(data, sender) {
    const { url, domain, result, isRecheck } = data;
    const tabId = sender.tab?.id;
    if (!tabId) {
        return { action: 'allow' };
    }
    log(`[ContentAnalysis] ${domain} — Score: ${result.score}, Explicit: ${result.isExplicit}, Recheck: ${isRecheck}`);
    // Store for debug panel
    await storePageAnalysis(domain, result);
    // Get thresholds (lower in heightened mode)
    const heightened = await getHeightenedMode();
    const blockThreshold = heightened?.active ? 35 : 70;
    const warnThreshold = heightened?.active ? 15 : 30;
    // Determine action
    // Require 2+ signals to block to reduce false positives,
    // UNLESS an adult-specific strong signal is present (domain / structural / title)
    let action = 'allow';
    const signalCount = result.reasons.length;
    const hasStrongAdultSignal = result.reasons.some(r => r.includes('Adult keyword in domain') ||
        r.includes('Explicit keyword in title') ||
        r.includes('known adult domain') ||
        r.includes('Adult ad network') ||
        r.includes('adult blocklist domain') ||
        r.includes('Adult rating') ||
        r.includes('RTA label'));
    if (result.isExplicit) {
        // Explicit flag (adult meta / high score) is enough alone
        action = 'block';
    }
    else if (result.score >= blockThreshold && (signalCount >= 2 || hasStrongAdultSignal)) {
        // Multiple signals + high score = block, OR a single strong adult signal is enough
        action = 'block';
    }
    else if (result.score >= blockThreshold && signalCount === 1 && !hasStrongAdultSignal) {
        // High score but only one weak signal = warn (could be false positive)
        action = 'warn';
        log(`⚠️ [ContentAnalysis] WARNING (single signal) for ${domain} — Score: ${result.score}, Reason: ${result.reasons[0]}`);
    }
    else if (result.score >= warnThreshold) {
        action = 'warn';
        log(`⚠️ [ContentAnalysis] WARNING for ${domain} — Score: ${result.score}`);
    }
    // Any block decision: redirect, log event, increment stats (isExplicit path was previously missing this)
    if (action === 'block') {
        const reason = result.reasons[0] || 'Explicit content detected';
        const blockUrl = `${BLOCK_SCREEN_URL}?url=${encodeURIComponent(url)}&reason=${encodeURIComponent(reason)}&tabId=${tabId}&type=content`;
        chrome.tabs.update(tabId, { url: blockUrl });
        log(`🛑 [ContentAnalysis] REDIRECT issued for ${domain} via tabs.update — score=${result.score}, explicit=${result.isExplicit}, reason=${reason}`);
        await logBlockEvent({
            url,
            domain,
            reason: `Content analysis (score: ${result.score}, reasons: ${result.reasons.join(', ')})`,
            action: 'blocked',
            timestamp: Date.now()
        });
        // Observe → learn: content/structural blocks become candidates (not DNR-only)
        await recordAdultBlockCandidate({
            domain,
            score: result.score,
            reasons: result.reasons,
        });
        await incrementContentBlockStat();
    }
    return { action };
}
/**
 * Increment content block daily stat
 */
async function incrementContentBlockStat() {
    const today = new Date().toISOString().split('T')[0];
    const key = 'contentBlockingDailyStats';
    const data = await chrome.storage.local.get(key);
    const stats = data[key] || { date: today, blockedSites: 0 };
    // Reset if new day
    if (stats.date !== today) {
        stats.date = today;
        stats.blockedSites = 0;
    }
    stats.blockedSites++;
    await chrome.storage.local.set({ [key]: stats });
}
/**
 * Handle Aoi preferences update from content script
 * Forwards to desktop app for Supabase sync
 */
async function handleAoiPreferencesUpdate(data) {
    log('Aoi preferences update:', data);
    // Save locally as backup
    await chrome.storage.local.set({
        clarity_hidden_global: data.hiddenGlobal,
        clarity_hidden_domains: data.hiddenDomains
    });
    // Send to desktop app if connected (for Supabase sync)
    if (isDesktopAppConnected()) {
        sendAoiPreferencesUpdate(data);
        log('Aoi preferences sent to desktop');
        return { success: true, synced: true };
    }
    else {
        log('Aoi preferences saved locally (desktop not connected)');
        return { success: true, synced: false };
    }
}
/**
 * Get current status
 */
async function getStatus() {
    const storage = await chrome.storage.local.get([
        STORAGE_KEYS.MODE,
        STORAGE_KEYS.IS_ACTIVE,
        STORAGE_KEYS.STRICTNESS
    ]);
    // Get block stats
    const history = await chrome.storage.local.get('blockHistory');
    const blockHistory = history.blockHistory || [];
    // Count blocks today
    const today = new Date().setHours(0, 0, 0, 0);
    const blocksToday = blockHistory.filter(e => e.timestamp >= today && e.action === 'blocked').length;
    return {
        mode: storage.mode || 'free',
        isActive: storage.isActive || false,
        strictness: storage.strictness || 'guided',
        blocksToday
    };
}
async function setIsActive(isActive) {
    await chrome.storage.local.set({ [STORAGE_KEYS.IS_ACTIVE]: isActive });
    log('isActive set to', isActive);
    return getStatus();
}
async function toggleIsActive() {
    const { isActive } = await getStatus();
    return setIsActive(!isActive);
}
async function getDisableFrictionSecs() {
    const raw = await chrome.storage.local.get(STORAGE_KEYS.DISABLE_FRICTION_SECS);
    const n = Number(raw[STORAGE_KEYS.DISABLE_FRICTION_SECS]);
    const secs = DISABLE_FRICTION_OPTIONS.includes(n)
        ? n
        : DEFAULT_DISABLE_FRICTION_SECS;
    return { secs };
}
async function setDisableFrictionSecs(secs) {
    const n = Number(secs);
    const next = DISABLE_FRICTION_OPTIONS.includes(n)
        ? n
        : DEFAULT_DISABLE_FRICTION_SECS;
    await chrome.storage.local.set({ [STORAGE_KEYS.DISABLE_FRICTION_SECS]: next });
    return { secs: next };
}
/**
 * Get history stats
 */
async function getHistoryStats() {
    const { navigationHistory = [] } = await chrome.storage.local.get('navigationHistory');
    const stats = calculateHistoryStats(navigationHistory);
    return stats;
}
// Periodic sync - temporarily disabled until we implement fetch-based API
// chrome.alarms.create('sync-to-supabase', { periodInMinutes: 30 })
// chrome.alarms.create('cleanup-history', { periodInMinutes: 1440 })
/**
 * Get protection status for desktop app
 */
async function getProtectionStatus() {
    // Check if running in incognito context
    // Note: This only tells us if THIS context is incognito, not if extension is allowed in incognito
    // The real check needs to be done via chrome.extension.isAllowedIncognitoAccess
    let incognitoEnabled = false;
    try {
        incognitoEnabled = await chrome.extension.isAllowedIncognitoAccess();
    }
    catch (e) {
        log('Could not check incognito access:', e);
    }
    // Get blocked searches count
    const blockedSearchesToday = await getBlockedSearchesToday();
    return {
        extensionConnected: true, // If we can respond, we're connected
        incognitoEnabled,
        safeSearchEnforced: true, // Always true since we have the rules.json
        searchFilterActive: true, // Always active
        blockedSearchesToday
    };
}
/**
 * Get intelligent blocking status (Layer 2 stats)
 */
async function getIntelligentBlockingStatus() {
    const dailyStats = await getDailyStats();
    const heightenedMode = await getHeightenedMode();
    const blockedSearches = await getBlockedSearchesToday();
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
    };
}
/**
 * Get Aoi widget status for content script
 */
async function getAoiStatus(url) {
    // Check protection status first
    const protectionStatus = await getProtectionStatus();
    // Check if desktop is connected (via last heartbeat check)
    // For now, we'll consider it OK if extension is working
    // The real heartbeat check would need to come from the native messaging module
    // Determine if current site is a distraction
    let isDistraction = false;
    let siteCategory = 'productive';
    if (url) {
        const domain = extractDomain(url);
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
        ];
        const neutralDomains = [
            // Work tools - not distraction but not productive browsing
            'gmail.com', 'mail.google.com', 'outlook.com', 'slack.com'
        ];
        // Check if domain matches any distraction
        isDistraction = distractionDomains.some(d => domain === d || domain.endsWith('.' + d));
        const isNeutral = neutralDomains.some(d => domain === d || domain.endsWith('.' + d));
        if (isDistraction) {
            siteCategory = 'distraction';
        }
        else if (isNeutral) {
            siteCategory = 'neutral';
        }
        else {
            siteCategory = 'productive';
        }
    }
    // Determine alert level
    // For now, always OK since we're the extension and we're running
    // The real alert level would come from heartbeat system but that's 
    // desktop-side. Here we just care about whether extension is working.
    let alertLevel = 'ok';
    // If incognito not enabled and we're in incognito, that's a warning
    // But we can't easily detect if we're in incognito from service worker
    // The content script runs in both contexts
    return {
        alertLevel,
        isDistraction,
        siteCategory
    };
}
/**
 * Get page analysis data for the debug panel
 * Returns detailed layer-by-layer breakdown of the blocking algorithm
 */
async function getPageAnalysisData(data) {
    const { url, domain } = data;
    try {
        // Get all storage data
        const storage = await chrome.storage.local.get([
            `pageAnalysis_${domain}`,
            'lastPageAnalyses',
            STORAGE_KEYS.RULES,
            STORAGE_KEYS.CUSTOM_BLOCKING_RULES,
            STORAGE_KEYS.IS_ACTIVE
        ]);
        const baseRules = storage[STORAGE_KEYS.RULES] || DEFAULT_BLOCKLIST;
        const custom = storage[STORAGE_KEYS.CUSTOM_BLOCKING_RULES] ?? [];
        const rules = [...baseRules, ...custom];
        const searchSession = await getSearchSession();
        const heightenedMode = await getHeightenedMode();
        const dailyStats = await getDailyStats();
        // Determine thresholds
        const isHeightened = heightenedMode?.active || false;
        const thresholds = {
            warn: isHeightened ? 15 : 30,
            block: isHeightened ? 35 : 70
        };
        // === LAYER 1: Hard Blocklist Check ===
        let layer1Blocked = false;
        let matchedRule = null;
        for (const rule of rules) {
            if (matchesPattern(url, rule.pattern)) {
                if (rule.action === 'block') {
                    layer1Blocked = true;
                    matchedRule = {
                        pattern: rule.pattern,
                        reason: rule.reason || 'Blocked by rule',
                        category: rule.category || 'unknown'
                    };
                    break;
                }
            }
        }
        const layer1 = {
            checked: true,
            blocked: layer1Blocked,
            matchedRule
        };
        // === LAYER 2: Search Intelligence ===
        const searchEngines = ['google.com', 'bing.com', 'duckduckgo.com', 'yahoo.com', 'ecosia.org', 'qwant.com', 'startpage.com', 'brave.com', 'yandex.'];
        const isSearchEngineSite = searchEngines.some(se => domain.includes(se));
        const lastSearch = searchSession.searches.length > 0
            ? searchSession.searches[searchSession.searches.length - 1]
            : null;
        // Determine action based on score
        const getActionFromScore = (score, flags) => {
            if (score >= 50)
                return 'block';
            if (score >= 20)
                return 'warn';
            return 'allow';
        };
        const layer2 = {
            isSearchEngine: isSearchEngineSite,
            lastSearch: lastSearch ? {
                query: lastSearch.query || '',
                score: lastSearch.score || 0,
                action: getActionFromScore(lastSearch.score || 0, lastSearch.flags || []),
                flags: lastSearch.flags || []
            } : null,
            sessionScore: searchSession.totalScore,
            searchCount: searchSession.searches.length
        };
        // === LAYER 3: Content Analysis ===
        const storageKey = `pageAnalysis_${domain}`;
        let pageAnalysis = storage[storageKey]?.result || null;
        // Check recent analyses too
        const recentAnalyses = storage.lastPageAnalyses || [];
        const recentForDomain = recentAnalyses.find((a) => a.domain === domain);
        if (recentForDomain?.result && (!pageAnalysis || recentForDomain.timestamp > (storage[storageKey]?.timestamp || 0))) {
            pageAnalysis = recentForDomain.result;
        }
        // Build checks array from reasons
        const checks = [];
        if (pageAnalysis) {
            // Parse reasons to create structured checks
            const reasons = pageAnalysis.reasons || [];
            // Domain whitelist check
            const whitelistReason = reasons.find((r) => r.includes('whitelist'));
            checks.push({
                name: 'Domain Whitelist',
                score: 0,
                detail: whitelistReason || (pageAnalysis.score === 0 ? 'Not whitelisted' : 'Checked'),
                status: whitelistReason ? 'pass' : 'pass'
            });
            // Meta tags check
            const metaReason = reasons.find((r) => r.toLowerCase().includes('meta') || r.includes('rating'));
            checks.push({
                name: 'Meta Tags',
                score: metaReason ? (metaReason.includes('Adult') ? 100 : 50) : 0,
                detail: metaReason || 'No adult meta tags',
                status: metaReason ? 'fail' : 'pass'
            });
            // Title check  
            const titleReason = reasons.find((r) => r.toLowerCase().includes('title'));
            checks.push({
                name: 'Page Title',
                score: titleReason ? 60 : 0,
                detail: titleReason || 'No explicit keywords in title',
                status: titleReason ? 'fail' : 'pass'
            });
            // Body content check
            const bodyReason = reasons.find((r) => r.toLowerCase().includes('keyword') && !r.toLowerCase().includes('url') && !r.toLowerCase().includes('title'));
            checks.push({
                name: 'Body Content',
                score: bodyReason ? (bodyReason.includes('High') ? 50 : bodyReason.includes('Multiple') ? 40 : 25) : 0,
                detail: bodyReason || `${pageAnalysis.keywordMatches || 0} keywords scanned`,
                status: bodyReason ? (bodyReason.includes('High') ? 'fail' : 'warn') : 'pass'
            });
            // URL path check
            const urlReason = reasons.find((r) => r.toLowerCase().includes('url'));
            checks.push({
                name: 'URL Path',
                score: urlReason ? 30 : 0,
                detail: urlReason || 'No suspicious patterns',
                status: urlReason ? 'warn' : 'pass'
            });
            // Media ratio check
            const mediaReason = reasons.find((r) => r.toLowerCase().includes('media') || r.toLowerCase().includes('ratio'));
            checks.push({
                name: 'Media/Text Ratio',
                score: mediaReason ? 20 : 0,
                detail: mediaReason || `Ratio: ${pageAnalysis.imageTextRatio?.toFixed(1) || '0'}`,
                status: mediaReason ? 'warn' : 'pass'
            });
            // Links check
            const linkReason = reasons.find((r) => r.toLowerCase().includes('link'));
            checks.push({
                name: 'Suspicious Links',
                score: linkReason ? 15 : 0,
                detail: linkReason || 'No suspicious links',
                status: linkReason ? 'warn' : 'pass'
            });
            // Safe context
            const safeReason = reasons.find((r) => r.toLowerCase().includes('safe context'));
            if (safeReason || pageAnalysis.hasSafeContext) {
                checks.push({
                    name: 'Safe Context',
                    score: 0,
                    detail: safeReason || 'Educational/medical context detected',
                    status: 'pass'
                });
            }
        }
        else {
            // No analysis yet
            checks.push({
                name: 'Analysis Status',
                score: 0,
                detail: 'Page not yet analyzed (analysis pending or domain skipped)',
                status: 'pass'
            });
        }
        const layer3 = {
            analyzed: !!pageAnalysis,
            totalScore: pageAnalysis?.score || 0,
            isExplicit: pageAnalysis?.isExplicit || false,
            checks
        };
        // === Final Decision ===
        let finalDecision = 'allow';
        if (layer1Blocked) {
            finalDecision = 'block';
        }
        else if (layer3.isExplicit || layer3.totalScore >= thresholds.block) {
            finalDecision = 'block';
        }
        else if (layer3.totalScore >= thresholds.warn) {
            finalDecision = 'warn';
        }
        return {
            url,
            domain,
            timestamp: Date.now(),
            layer1,
            layer2,
            layer3,
            heightenedMode: heightenedMode || { active: false },
            thresholds,
            finalDecision,
            dailyStats
        };
    }
    catch (error) {
        log('Error getting page analysis data:', error);
        return {
            url,
            domain,
            timestamp: Date.now(),
            layer1: { checked: false, blocked: false, matchedRule: null },
            layer2: { isSearchEngine: false, lastSearch: null, sessionScore: 0, searchCount: 0 },
            layer3: { analyzed: false, totalScore: 0, isExplicit: false, checks: [] },
            heightenedMode: { active: false },
            thresholds: { warn: 30, block: 70 },
            finalDecision: 'allow',
            dailyStats: { blockedSearches: 0, warnings: 0, heightenedActivations: 0 }
        };
    }
}
/**
 * Store page analysis results for debug panel
 */
async function storePageAnalysis(domain, result) {
    const storageKey = `pageAnalysis_${domain}`;
    const data = {
        domain,
        result,
        timestamp: Date.now()
    };
    await chrome.storage.local.set({ [storageKey]: data });
    const { lastPageAnalyses = [] } = await chrome.storage.local.get('lastPageAnalyses');
    lastPageAnalyses.unshift(data);
    if (lastPageAnalyses.length > 20) {
        lastPageAnalyses.pop();
    }
    await chrome.storage.local.set({ lastPageAnalyses });
}
log('Service worker loaded');
