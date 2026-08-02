/**
 * Constants and default blocklists
 */
/**
 * Default blocklist - hardcoded rules for Phase 1
 */
export const DEFAULT_BLOCKLIST = [
    // Social Media
    {
        id: 'twitter',
        pattern: '*://*.twitter.com/*',
        action: 'block',
        reason: 'Social media in Focus Mode',
        category: 'social_media'
    },
    {
        id: 'x',
        pattern: '*://*.x.com/*',
        action: 'block',
        reason: 'Social media in Focus Mode',
        category: 'social_media'
    },
    {
        id: 'lemonde',
        pattern: '*://*.lemonde.fr/*',
        action: 'block',
        reason: 'News can be a distraction',
        category: 'news'
    },
    {
        id: 'lefigaro',
        pattern: '*://*.lefigaro.fr/*',
        action: 'block',
        reason: 'News can be a distraction',
        category: 'news'
    },
    {
        id: 'facebook',
        pattern: '*://*.facebook.com/*',
        action: 'block',
        reason: 'Social media in Focus Mode',
        category: 'social_media'
    },
    {
        id: 'instagram',
        pattern: '*://*.instagram.com/*',
        action: 'block',
        reason: 'Social media in Focus Mode',
        category: 'social_media'
    },
    {
        id: 'tiktok',
        pattern: '*://*.tiktok.com/*',
        action: 'block',
        reason: 'Social media in Focus Mode',
        category: 'social_media'
    },
    // Reddit
    {
        id: 'reddit',
        pattern: '*://*.reddit.com/*',
        action: 'block',
        reason: 'Distraction in Focus Mode',
        category: 'social_media'
    },
    // Video/Entertainment
    {
        id: 'youtube',
        pattern: '*://*.youtube.com/*',
        action: 'ask', // Ask because sometimes productive
        reason: 'Video platform - can be distracting',
        category: 'video'
    },
    {
        id: 'netflix',
        pattern: '*://*.netflix.com/*',
        action: 'block',
        reason: 'Entertainment in Focus Mode',
        category: 'entertainment'
    },
    // News
    {
        id: 'nytimes',
        pattern: '*://*.nytimes.com/*',
        action: 'ask',
        reason: 'News can be a rabbit hole',
        category: 'news'
    }
];
/**
 * Domain extraction patterns
 */
export const DOMAIN_REGEX = /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n?]+)/;
/**
 * Category to emoji mapping
 */
export const CATEGORY_EMOJI = {
    social_media: '📱',
    news: '📰',
    video: '📺',
    entertainment: '🎮',
    shopping: '🛒',
    adult: '🔞',
    work: '💼',
    other: '🌐'
};
/**
 * Storage keys
 */
export const STORAGE_KEYS = {
    RULES: 'rules',
    MODE: 'mode',
    STRICTNESS: 'strictness',
    IS_ACTIVE: 'isActive',
    CACHE: 'decisionCache',
    HISTORY: 'navigationHistory',
    /** User rules from Boundaries → Blocking (merged with RULES in shouldBlock) */
    CUSTOM_BLOCKING_RULES: 'customBlockingRules',
    /** Lowercase substrings to block on search engines */
    CUSTOM_SEARCH_KEYWORDS: 'customSearchKeywords',
    /** System adult domains (bundled seed ∪ desktop sync) — additive with DNR */
    ADULT_BLOCKLIST_DOMAINS: 'adultBlocklistDomains',
    ADULT_BLOCKLIST_VERSION: 'adultBlocklistVersion',
    /** Observed adult domains from content/structural blocks (capped candidate list) */
    ADULT_BLOCK_CANDIDATES: 'adultBlockCandidates',
    /** Cooldown seconds before pause / disable (autodiscipline) */
    DISABLE_FRICTION_SECS: 'disableFrictionSecs',
};
/** Confirm phrase for pause / disable friction (extension + desktop) */
export const DISABLE_CONFIRM_PHRASE = 'DISABLE';
export const DISABLE_FRICTION_OPTIONS = [15, 30, 60];
export const DEFAULT_DISABLE_FRICTION_SECS = 30;
/**
 * Block screen URL
 */
export const BLOCK_SCREEN_URL = chrome.runtime.getURL('block-screen.html');
/** True for this extension's pages (block screen, popup, etc.) */
export function isOwnExtensionUrl(url) {
    return url.startsWith(chrome.runtime.getURL(''));
}
