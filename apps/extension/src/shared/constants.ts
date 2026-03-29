/**
 * Constants and default blocklists
 */

import type { BlockRule, Category } from './types'

/**
 * Default blocklist - hardcoded rules for Phase 1
 */
export const DEFAULT_BLOCKLIST: BlockRule[] = [
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
    action: 'ask',  // Ask because sometimes productive
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
]

/**
 * Domain extraction patterns
 */
export const DOMAIN_REGEX = /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n?]+)/

/**
 * Category to emoji mapping
 */
export const CATEGORY_EMOJI: Record<Category, string> = {
  social_media: '📱',
  news: '📰',
  video: '📺',
  entertainment: '🎮',
  shopping: '🛒',
  adult: '🔞',
  work: '💼',
  other: '🌐'
}

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
  CUSTOM_SEARCH_KEYWORDS: 'customSearchKeywords'
} as const

/**
 * Block screen URL
 */
export const BLOCK_SCREEN_URL = chrome.runtime.getURL('block-screen.html')
