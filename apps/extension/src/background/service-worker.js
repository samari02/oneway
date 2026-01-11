/**
 * Background Service Worker
 * Main logic for the extension
 */
import { DEFAULT_BLOCKLIST, STORAGE_KEYS, BLOCK_SCREEN_URL } from '../shared/constants';
import { extractDomain, matchesPattern, log } from '../shared/utils';
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
});
// Monitor navigation
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
    log('Navigation detected:', event.domain);
    // Check if should be blocked
    const decision = await shouldBlock(event.url);
    if (decision.shouldBlock) {
        log('Blocking:', event.domain, decision.reason);
        // Redirect to block screen
        const blockUrl = `${BLOCK_SCREEN_URL}?url=${encodeURIComponent(event.url)}&reason=${encodeURIComponent(decision.reason || '')}`;
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
/**
 * Check if URL should be blocked
 */
async function shouldBlock(url) {
    const storage = await chrome.storage.local.get([
        STORAGE_KEYS.RULES,
        STORAGE_KEYS.MODE,
        STORAGE_KEYS.IS_ACTIVE,
        STORAGE_KEYS.CACHE
    ]);
    // If not active, allow everything
    if (!storage.isActive) {
        return { shouldBlock: false };
    }
    // Check cache first
    const domain = extractDomain(url);
    if (storage.cache && storage.cache[domain]) {
        const cached = storage.cache[domain];
        if (cached === 'block') {
            return { shouldBlock: true, reason: 'Cached block decision' };
        }
        return { shouldBlock: false };
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
});
/**
 * Handle bypass request
 */
async function handleBypass(data) {
    log('Bypass requested:', data);
    // Log bypass event
    await logBlockEvent({
        url: data.url,
        domain: extractDomain(data.url),
        reason: 'User bypassed',
        action: 'bypassed',
        bypassMethod: data.method,
        timestamp: Date.now()
    });
    // Add to cache as allowed (temporarily)
    const storage = await chrome.storage.local.get(STORAGE_KEYS.CACHE);
    const cache = storage.cache || {};
    cache[extractDomain(data.url)] = 'allow';
    await chrome.storage.local.set({ cache });
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
log('Service worker loaded');
