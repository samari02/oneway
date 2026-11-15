/**
 * Search Query Filter
 * Detects and blocks searches for explicit content
 */
import { log } from '../shared/utils';
import { isAllowlistedSearchHost, matchEngineByHostname, } from '../shared/search-engine-atlas';
// Keywords that indicate explicit search intent
// Note: This list is intentionally broad to catch variations
const EXPLICIT_KEYWORDS = [
    // Direct terms (abbreviated/coded to avoid explicit content in source)
    'porn', 'porno', 'xxx', 'nsfw', 'hentai', 'rule34',
    'onlyfans', 'fansly', 'chaturbate', 'pornhub', 'xvideos', 'xnxx',
    'xhamster', 'redtube', 'youporn', 'brazzers', 'naughtyamerica',
    // French
    'pute', 'salope', 'beurette',
    // Common search patterns
    'nude', 'nudes', 'naked', 'sex video', 'sex tape',
    'leaked nudes', 'leaked video',
    // Cam sites
    'livejasmin', 'stripchat', 'bongacams', 'cam girl', 'camgirl',
    // JP/TW adult video search intent (engines + shared with Layer 3 lexicon)
    'jav', 'fc2ppv', 'missav', '無碼', '无码', '無修正', 'エロ動画', 'AV線上',
    // Soft/coded SERP queries common on yandex.by (not hard "porn")
    'pcolle', 'xcolle', '反応検査', '身体検査', 'tokyomotion', 'eroterest',
];
// Note: bare "fc2" is scored in Layer 3 in-site search (page-analyzer) with
// word boundaries + video/PeerTube corroboration — not here (too many benign hits).
// Regex patterns for more complex matching
const EXPLICIT_PATTERNS = [
    /\bfap\b/i,
    /\bjerk\s*off\b/i,
    /\bhot\s+(girl|guy|women|men|teen)s?\s+(nude|naked|video)/i,
    /\b(watch|free)\s+porn\b/i,
    /\badult\s+(video|content|site)/i,
];
/**
 * Check if a search query contains explicit content
 */
export function isExplicitSearch(query) {
    const normalizedQuery = query.toLowerCase().trim();
    // Check keywords
    for (const keyword of EXPLICIT_KEYWORDS) {
        if (normalizedQuery.includes(keyword.toLowerCase())) {
            return { isExplicit: true, matchedTerm: keyword };
        }
    }
    // Check patterns
    for (const pattern of EXPLICIT_PATTERNS) {
        if (pattern.test(normalizedQuery)) {
            return { isExplicit: true, matchedTerm: 'pattern match' };
        }
    }
    return { isExplicit: false };
}
function pathAllowsQuery(engine, pathname) {
    if (!engine.pathIncludes.length)
        return true;
    const path = pathname.toLowerCase();
    return engine.pathIncludes.some((p) => path.includes(p.toLowerCase()));
}
/**
 * Extract search query from URL — Layer 2 allowlist only
 * (google.com / Gemini / ChatGPT). Other atlas engines are DNR hard-blocked.
 */
export function extractSearchQuery(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        if (!isAllowlistedSearchHost(hostname))
            return null;
        const engine = matchEngineByHostname(hostname);
        if (!engine)
            return null;
        if (!pathAllowsQuery(engine, urlObj.pathname))
            return null;
        for (const param of engine.queryParams) {
            const value = urlObj.searchParams.get(param);
            if (value && value.trim())
                return value;
        }
        return null;
    }
    catch {
        return null;
    }
}
/**
 * Check if URL is an allowlisted search engine results page (NOT a redirect).
 * Non-allowlisted engines (yandex, bing, …) are hard-blocked via DNR — not Layer 2.
 */
export function isSearchEngine(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        const pathname = urlObj.pathname.toLowerCase();
        // Google redirect URLs are NOT search pages - they're click tracking
        // e.g., google.com/url?q=https://example.com
        if (hostname.includes('google.') && pathname === '/url') {
            return false;
        }
        // Bing redirect URLs (bing itself is hard-blocked; keep exclusion for safety)
        if ((hostname === 'bing.com' || hostname.endsWith('.bing.com')) && pathname.startsWith('/ck/')) {
            return false;
        }
        return isAllowlistedSearchHost(hostname);
    }
    catch {
        return false;
    }
}
/**
 * Check if URL is a search engine redirect (click tracking URL)
 * Returns the destination URL if it is, null otherwise
 */
export function extractRedirectDestination(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        const pathname = urlObj.pathname.toLowerCase();
        // Google redirect: google.com/url?q=<destination>
        if (hostname.includes('google.') && pathname === '/url') {
            const destination = urlObj.searchParams.get('q') || urlObj.searchParams.get('url');
            if (destination) {
                return destination;
            }
        }
        // Bing redirect: bing.com/ck/a?...&u=<encoded_destination>
        if ((hostname === 'bing.com' || hostname.endsWith('.bing.com')) && pathname.startsWith('/ck/')) {
            const encoded = urlObj.searchParams.get('u');
            if (encoded) {
                // Bing uses a custom encoding, try to decode
                try {
                    // Sometimes it's base64, sometimes URL-encoded
                    const decoded = decodeURIComponent(encoded);
                    if (decoded.startsWith('http')) {
                        return decoded;
                    }
                }
                catch {
                    // Ignore decode errors
                }
            }
        }
        return null;
    }
    catch {
        return null;
    }
}
/**
 * Check if URL looks like an email tracking/redirect link
 * These often contain random characters that can trigger false positives
 */
export function isEmailTrackingUrl(url) {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        const trackingPatterns = [
            // Email service providers
            /\.mg\./, // Mailgun (email.mg.*)
            /sendgrid\.net/,
            /mailchimp\.com/,
            /mailgun\.org/,
            /postmarkapp\.com/,
            /amazonses\.com/,
            /sparkpostmail\.com/,
            /mandrillapp\.com/,
            /constantcontact\.com/,
            /campaign-archive\.com/, // Mailchimp archives
            /list-manage\.com/, // Mailchimp
            /click\./, // Generic click tracking
            /track\./, // Generic tracking
            /email\./, // Generic email subdomain
            /links\./, // Link tracking
            /go\./, // Go redirects
        ];
        return trackingPatterns.some(pattern => pattern.test(hostname));
    }
    catch {
        return false;
    }
}
/**
 * Get storage key for blocked searches count
 */
function getBlockedSearchesKey() {
    const today = new Date().toISOString().split('T')[0];
    return `blockedSearches_${today}`;
}
/**
 * Increment blocked searches counter
 */
export async function incrementBlockedSearches() {
    const key = getBlockedSearchesKey();
    const data = await chrome.storage.local.get(key);
    const count = (data[key] || 0) + 1;
    await chrome.storage.local.set({ [key]: count });
    log('Blocked searches today:', count);
}
/**
 * Get blocked searches count for today
 */
export async function getBlockedSearchesToday() {
    const key = getBlockedSearchesKey();
    const data = await chrome.storage.local.get(key);
    return data[key] || 0;
}
