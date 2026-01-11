/**
 * Background Service Worker
 * Main logic for the extension
 */
import { DEFAULT_BLOCKLIST, STORAGE_KEYS, BLOCK_SCREEN_URL } from '../shared/constants';
import { extractDomain, matchesPattern, log } from '../shared/utils';
import { requestHistoryPermission, importHistory, recordVisit, getCollectionStatus, calculateHistoryStats } from './history-collector';
import { connectToDesktopApp, isDesktopAppConnected, getConnectionStatus, sendNavigationEvent } from './native-messaging';
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
    // Try to connect to desktop app
    connectToDesktopApp();
});
// On startup, try to connect to desktop app
chrome.runtime.onStartup.addListener(() => {
    log('Extension started');
    connectToDesktopApp();
});
// Monitor navigation - blocking
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    // Only main frame navigations
    if (details.frameId !== 0)
        return;
    const event = {
        url: details.url,
        domain: extractDomain(details.url),
        timestamp: details.timeStamp,
        tabId: details.tabId
    };
    log('Navigation detected:', event.domain, 'on tab', details.tabId);
    // Check if should be blocked
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
 * Check if URL should be blocked
 */
async function shouldBlock(url, tabId) {
    const storage = await chrome.storage.local.get([
        STORAGE_KEYS.RULES,
        STORAGE_KEYS.MODE,
        STORAGE_KEYS.IS_ACTIVE,
        'allowedTabs'
    ]);
    // If not active, allow everything
    if (!storage.isActive) {
        return { shouldBlock: false };
    }
    const domain = extractDomain(url);
    // Check tab-specific allowlist first
    if (storage.allowedTabs && storage.allowedTabs[tabId]) {
        const allowed = storage.allowedTabs[tabId];
        if (allowed.domain === domain && allowed.expiresAt > Date.now()) {
            log('Tab', tabId, 'is allowed for', domain, 'until', new Date(allowed.expiresAt).toLocaleTimeString());
            return { shouldBlock: false };
        }
    }
    // Check rules
    const rules = storage.rules || DEFAULT_BLOCKLIST;
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
    if (message.type === 'BYPASS_BLOCK') {
        handleBypass(message.data).then(sendResponse);
        return true; // Keep channel open for async response
    }
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
            .then(visits => sendResponse({ success: true, visits: visits.length }))
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
});
/**
 * Handle bypass request
 */
async function handleBypass(data) {
    log('Bypass requested:', data);
    const domain = extractDomain(data.url);
    // Log bypass event
    await logBlockEvent({
        url: data.url,
        domain,
        reason: 'User bypassed',
        action: 'bypassed',
        bypassMethod: data.method,
        timestamp: Date.now()
    });
    // Add to tab-specific allowlist
    const storage = await chrome.storage.local.get('allowedTabs');
    const allowedTabs = storage.allowedTabs || {};
    // Allow this tab for this domain for the next 5 minutes
    const expiresAt = Date.now() + (5 * 60 * 1000);
    allowedTabs[data.tabId] = {
        domain,
        expiresAt
    };
    await chrome.storage.local.set({ allowedTabs });
    log('Tab', data.tabId, 'allowed for', domain, 'until', new Date(expiresAt).toLocaleTimeString());
    return { success: true };
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
log('Service worker loaded');
