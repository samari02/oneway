/**
 * Utility functions
 */
import { DOMAIN_REGEX } from './constants';
/**
 * Extract domain from URL
 */
export function extractDomain(url) {
    const match = url.match(DOMAIN_REGEX);
    return match ? match[1] : url;
}
/**
 * Normalize URL for blocklist matching (host + path only — not query/hash).
 * Prevents false positives when blocked URLs appear in query params (e.g. block-screen.html?url=...).
 */
function urlForPatternMatch(url) {
    try {
        const parsed = new URL(url);
        return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    }
    catch {
        return url.split(/[?#]/)[0];
    }
}
/**
 * Check if URL matches pattern (simple wildcard matching)
 */
export function matchesPattern(url, pattern) {
    const target = urlForPatternMatch(url);
    const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(target);
}
/**
 * Get current timestamp
 */
export function now() {
    return Date.now();
}
/**
 * Format timestamp to readable date
 */
export function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString();
}
/**
 * Log with timestamp (development helper)
 */
export function log(...args) {
    // Always log in development (chrome extension doesn't have process.env)
    console.log(`[Clarity ${new Date().toISOString()}]`, ...args);
}
