/**
 * Shared types for the browser extension
 */

export type BlockAction = 'block' | 'allow' | 'ask'

export type Mode = 'focus' | 'wind_down' | 'free'

export type Strictness = 'gentle' | 'guided' | 'strict'

export type Category = 
  | 'social_media'
  | 'news'
  | 'video'
  | 'entertainment'
  | 'shopping'
  | 'adult'
  | 'work'
  | 'other'

export interface BlockRule {
  id: string
  pattern: string  // Domain or URL pattern
  action: BlockAction
  reason?: string
  category?: Category
  modes?: Mode[]  // Active in these modes only
}

export interface NavigationEvent {
  url: string
  domain: string
  title?: string
  timestamp: number
  tabId: number
}

export interface BlockEvent {
  url: string
  domain: string
  title?: string
  reason: string
  action: 'blocked' | 'bypassed' | 'allowed'
  bypassMethod?: string
  mode?: Mode
  timestamp: number
}

export interface HistoryItem {
  url: string
  domain: string
  title?: string
  visitTime: number
  visitCount?: number
}

export interface StorageData {
  rules: BlockRule[]
  mode: Mode
  strictness: Strictness
  isActive: boolean
  cache: Record<string, BlockAction>
}

// Messages between extension components
export interface Message {
  type: string
  data?: any
}

export interface BlockDecisionMessage extends Message {
  type: 'BLOCK_DECISION'
  data: {
    url: string
    action: BlockAction
    reason?: string
  }
}

export interface ModeChangeMessage extends Message {
  type: 'MODE_CHANGE'
  data: {
    mode: Mode
    isActive: boolean
  }
}

export interface RequestHistoryPermissionMessage extends Message {
  type: 'REQUEST_HISTORY_PERMISSION'
}

export interface ImportHistoryMessage extends Message {
  type: 'IMPORT_HISTORY'
  data: {
    days: number
  }
}

export interface GetHistoryStatsMessage extends Message {
  type: 'GET_HISTORY_STATS'
}

// History collection types
export interface HistoryItem {
  url: string
  domain: string
  title?: string
  visitTime: number
  visitCount?: number
  category?: Category
}

export interface CategorizedVisit {
  url: string
  domain: string
  title?: string
  visitTime: number
  duration?: number
  category: Category
  isDistraction: boolean
}

export interface HistoryStats {
  totalVisits: number
  byCategory: Record<Category, number>
  topDomains: Array<{ domain: string; count: number; category: Category }>
  periodStart: number
  periodEnd: number
}

export interface HistoryCollectionStatus {
  hasPermission: boolean
  isCollecting: boolean
  lastImport?: number
  totalVisits: number
  periodDays: number
}

// Protection status for desktop app
export interface ProtectionStatus {
  extensionConnected: boolean
  incognitoEnabled: boolean
  safeSearchEnforced: boolean
  searchFilterActive: boolean
  blockedSearchesToday: number
}
