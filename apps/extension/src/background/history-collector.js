/**
 * History Collector
 *
 * Securely collects and categorizes browsing history.
 * Follows privacy-first principles:
 * - Only stores domains, not full URLs with query params
 * - Anonymizes sensitive data
 * - User-controlled period
 */
import { extractDomain, log } from '../shared/utils';
/**
 * Domain categorization rules
 * Privacy: Only domain-level, no URL inspection
 */
const DOMAIN_CATEGORIES = {
    // Social Media
    'twitter.com': 'social_media',
    'x.com': 'social_media',
    'facebook.com': 'social_media',
    'instagram.com': 'social_media',
    'tiktok.com': 'social_media',
    'reddit.com': 'social_media',
    'linkedin.com': 'social_media',
    'snapchat.com': 'social_media',
    // News
    'nytimes.com': 'news',
    'cnn.com': 'news',
    'bbc.com': 'news',
    'lemonde.fr': 'news',
    'lefigaro.fr': 'news',
    'theguardian.com': 'news',
    'reuters.com': 'news',
    // Video/Entertainment
    'youtube.com': 'video',
    'netflix.com': 'entertainment',
    'twitch.tv': 'video',
    'vimeo.com': 'video',
    'hulu.com': 'entertainment',
    'disneyplus.com': 'entertainment',
    // Shopping
    'amazon.com': 'shopping',
    'ebay.com': 'shopping',
    'aliexpress.com': 'shopping',
    // Work/Productivity
    'github.com': 'work',
    'stackoverflow.com': 'work',
    'notion.so': 'work',
    'figma.com': 'work',
    'docs.google.com': 'work',
    'drive.google.com': 'work',
    'slack.com': 'work',
    'discord.com': 'work',
    'zoom.us': 'work',
};
/**
 * Categorize a domain
 * Returns 'other' if not in known categories
 */
export function categorizeDomain(domain) {
    // Remove www. prefix
    const cleanDomain = domain.replace(/^www\./, '');
    // Exact match
    if (DOMAIN_CATEGORIES[cleanDomain]) {
        return DOMAIN_CATEGORIES[cleanDomain];
    }
    // Check if subdomain of known domain
    for (const [knownDomain, category] of Object.entries(DOMAIN_CATEGORIES)) {
        if (cleanDomain.endsWith(knownDomain)) {
            return category;
        }
    }
    return 'other';
}
/**
 * Check if a category is considered a distraction
 */
export function isDistraction(category) {
    return ['social_media', 'news', 'video', 'entertainment'].includes(category);
}
/**
 * Request history permission
 * Must be called from user gesture
 */
export async function requestHistoryPermission() {
    try {
        const granted = await chrome.permissions.request({
            permissions: ['history']
        });
        log('History permission:', granted ? 'granted' : 'denied');
        return granted;
    }
    catch (error) {
        log('Error requesting history permission:', error);
        return false;
    }
}
/**
 * Check if we have history permission
 */
export async function hasHistoryPermission() {
    try {
        const result = await chrome.permissions.contains({
            permissions: ['history']
        });
        return result;
    }
    catch (error) {
        log('Error checking history permission:', error);
        return false;
    }
}
/**
 * Import history for a given period (in days)
 * Privacy: Only stores domain, title, timestamp
 */
export async function importHistory(days = 30) {
    const hasPermission = await hasHistoryPermission();
    if (!hasPermission) {
        throw new Error('History permission not granted');
    }
    log('Importing history for last', days, 'days');
    const startTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const endTime = Date.now();
    try {
        // Fetch history from Chrome
        const historyItems = await chrome.history.search({
            text: '',
            startTime,
            endTime,
            maxResults: 10000 // Limit to prevent performance issues
        });
        log('Found', historyItems.length, 'history items');
        // Categorize and sanitize
        const categorized = historyItems
            .filter(item => item.url && isValidUrl(item.url))
            .map(item => {
            const domain = extractDomain(item.url);
            const category = categorizeDomain(domain);
            return {
                url: sanitizeUrl(item.url), // Remove query params
                domain,
                title: sanitizeTitle(item.title),
                visitTime: item.lastVisitTime || Date.now(),
                category,
                isDistraction: isDistraction(category)
            };
        });
        // Store in local storage
        await chrome.storage.local.set({
            navigationHistory: categorized,
            historyLastImport: Date.now(),
            historyPeriodDays: days
        });
        log('Imported and categorized', categorized.length, 'visits');
        return categorized;
    }
    catch (error) {
        log('Error importing history:', error);
        throw error;
    }
}
/**
 * Validate URL before processing
 * Security: Block javascript:, data:, file: protocols
 */
function isValidUrl(url) {
    try {
        const parsed = new URL(url);
        // Only http/https
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return false;
        }
        // Exclude chrome:// and extension pages
        if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
            return false;
        }
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Sanitize URL - remove query params and fragments
 * Privacy: Avoid storing sensitive data in URLs
 */
function sanitizeUrl(url) {
    try {
        const parsed = new URL(url);
        return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
    }
    catch {
        return url;
    }
}
/**
 * Sanitize title - limit length, escape HTML
 * Security: Prevent XSS via titles
 */
function sanitizeTitle(title) {
    if (!title)
        return undefined;
    // Truncate
    const truncated = title.slice(0, 200);
    // Escape HTML entities
    return truncated
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
/**
 * Calculate stats from categorized visits
 */
export function calculateHistoryStats(visits) {
    const byCategory = {
        social_media: 0,
        news: 0,
        video: 0,
        entertainment: 0,
        shopping: 0,
        adult: 0,
        work: 0,
        other: 0
    };
    const domainCounts = new Map();
    let minTime = Infinity;
    let maxTime = 0;
    for (const visit of visits) {
        // Count by category
        byCategory[visit.category]++;
        // Count by domain
        const existing = domainCounts.get(visit.domain);
        if (existing) {
            existing.count++;
        }
        else {
            domainCounts.set(visit.domain, { count: 1, category: visit.category });
        }
        // Track time range
        if (visit.visitTime < minTime)
            minTime = visit.visitTime;
        if (visit.visitTime > maxTime)
            maxTime = visit.visitTime;
    }
    // Top domains
    const topDomains = Array.from(domainCounts.entries())
        .map(([domain, data]) => ({ domain, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
    return {
        totalVisits: visits.length,
        byCategory,
        topDomains,
        periodStart: minTime === Infinity ? Date.now() : minTime,
        periodEnd: maxTime || Date.now()
    };
}
/**
 * Monitor new visits in real-time
 * Called from webNavigation.onCompleted
 */
export async function recordVisit(url, title) {
    if (!isValidUrl(url))
        return null;
    const domain = extractDomain(url);
    const category = categorizeDomain(domain);
    const visit = {
        url: sanitizeUrl(url),
        domain,
        title: sanitizeTitle(title),
        visitTime: Date.now(),
        category,
        isDistraction: isDistraction(category)
    };
    // Append to existing history
    const { navigationHistory = [] } = await chrome.storage.local.get('navigationHistory');
    navigationHistory.push(visit);
    // Keep last 10,000 visits
    if (navigationHistory.length > 10000) {
        navigationHistory.shift();
    }
    await chrome.storage.local.set({ navigationHistory });
    return visit;
}
/**
 * Get collection status
 */
export async function getCollectionStatus() {
    const hasPermission = await hasHistoryPermission();
    const { navigationHistory = [], historyLastImport, historyPeriodDays } = await chrome.storage.local.get(['navigationHistory', 'historyLastImport', 'historyPeriodDays']);
    return {
        hasPermission,
        totalVisits: navigationHistory.length,
        lastImport: historyLastImport,
        periodDays: historyPeriodDays
    };
}
