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
 * Check if URL matches pattern (simple wildcard matching)
 */
export function matchesPattern(url, pattern) {
    // Convert wildcard pattern to regex
    const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(url);
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
    console.log(`[Oneway ${new Date().toISOString()}]`, ...args);
}
