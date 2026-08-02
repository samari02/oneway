/**
 * Group-by dimensions for Workspace board
 */

import { laneForLastAccessed, RecencyLane } from './buckets'

export type GroupByMode = 'time' | 'theme' | 'site' | 'window' | 'custom'

export type TabGroupColor =
  | 'grey'
  | 'blue'
  | 'red'
  | 'yellow'
  | 'green'
  | 'pink'
  | 'purple'
  | 'cyan'
  | 'orange'

export interface GroupColumn {
  id: string
  title: string
  subtitle?: string
  collapsed: boolean
  color: TabGroupColor
  tabIds: number[]
  editable?: boolean
}

export interface TabLike {
  id: number
  title: string
  url: string
  favIconUrl?: string
  pinned: boolean
  windowId: number
  lastAccessed?: number
  active?: boolean
}

export interface UserGroupLike {
  id: string
  title: string
  color: TabGroupColor
  collapsed: boolean
  hosts: string[]
}

const WORK_HOSTS = [
  'github.com', 'gitlab.com', 'supabase.com', 'linear.app', 'notion.so',
  'figma.com', 'slack.com', 'vercel.com', 'localhost', '127.0.0.1',
  'atlassian.net', 'asana.com', 'trello.com', 'cursor.com', 'openai.com',
  'chatgpt.com', 'claude.ai',
]

const PERSONAL_HOSTS = [
  'pinterest.com', 'youtube.com', 'amazon.com', 'amazon.co.jp', 'netflix.com',
  'reddit.com', 'instagram.com', 'tiktok.com', 'twitter.com', 'x.com',
]

const READING_HOSTS = [
  'medium.com', 'wikipedia.org', 'substack.com', 'nytimes.com', 'bbc.com',
  'news.ycombinator.com',
]

export const GROUP_BY_LABELS: Record<GroupByMode, string> = {
  time: 'Time',
  theme: 'Theme',
  site: 'Site',
  window: 'Window',
  custom: 'Custom',
}

const CLARITY_GROUP_PREFIX = 'Clarity · '

export function clarityGroupTitle(name: string): string {
  return `${CLARITY_GROUP_PREFIX}${name}`
}

export function isClarityGroupTitle(title: string | undefined): boolean {
  return Boolean(title?.startsWith(CLARITY_GROUP_PREFIX))
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || 'Other'
  } catch {
    return 'Other'
  }
}

function hostMatches(host: string, list: string[]): boolean {
  return list.some((h) => host === h || host.endsWith(`.${h}`))
}

export function themeForHost(host: string): 'Work' | 'Personal' | 'Reading' | 'Other' {
  if (hostMatches(host, WORK_HOSTS)) return 'Work'
  if (hostMatches(host, PERSONAL_HOSTS)) return 'Personal'
  if (hostMatches(host, READING_HOSTS)) return 'Reading'
  return 'Other'
}

function timeColor(lane: RecencyLane): TabGroupColor {
  if (lane === 'active') return 'purple'
  if (lane === 'today') return 'blue'
  return 'grey'
}

function themeColor(theme: string): TabGroupColor {
  if (theme === 'Work') return 'green'
  if (theme === 'Personal') return 'pink'
  if (theme === 'Reading') return 'cyan'
  return 'grey'
}

const SITE_COLORS: TabGroupColor[] = [
  'blue', 'purple', 'cyan', 'orange', 'pink', 'green', 'yellow', 'grey',
]

function buildCustomColumns(tabs: TabLike[], userGroups: UserGroupLike[]): GroupColumn[] {
  const assigned = new Set<number>()
  const columns: GroupColumn[] = userGroups.map((g) => {
    const tabIds = tabs
      .filter((t) => {
        const host = hostnameOf(t.url)
        return g.hosts.some(
          (h) =>
            host === h ||
            host.endsWith(`.${h}`) ||
            host.toLowerCase() === h.toLowerCase()
        )
      })
      .map((t) => {
        assigned.add(t.id)
        return t.id
      })
    return {
      id: g.id,
      title: g.title,
      subtitle: `${g.hosts.length} domains · editable`,
      collapsed: g.collapsed,
      color: g.color,
      tabIds,
      editable: true,
    }
  })

  const ungrouped = tabs.filter((t) => !assigned.has(t.id)).map((t) => t.id)
  columns.push({
    id: 'ungrouped',
    title: 'Ungrouped',
    subtitle: 'drop here to forget domain',
    collapsed: true,
    color: 'grey',
    tabIds: ungrouped,
    editable: false,
  })
  return columns
}

export function buildColumns(
  mode: GroupByMode,
  tabs: TabLike[],
  opts: {
    currentWindowId: number | null
    now?: number
    maxSiteGroups?: number
    userGroups?: UserGroupLike[]
  }
): GroupColumn[] {
  const now = opts.now ?? Date.now()
  const maxSite = opts.maxSiteGroups ?? 6

  if (mode === 'custom' || (mode === 'theme' && opts.userGroups && opts.userGroups.length > 0)) {
    if (mode === 'custom' || mode === 'theme') {
      return buildCustomColumns(tabs, opts.userGroups ?? [])
    }
  }

  if (mode === 'time') {
    const lanes: RecencyLane[] = ['active', 'today', 'idle']
    const labels: Record<RecencyLane, { title: string; subtitle: string; collapsed: boolean }> = {
      active: { title: 'Active', subtitle: 'last 1h', collapsed: false },
      today: { title: 'Today', subtitle: '1–6h · replié', collapsed: true },
      idle: { title: 'Idle', subtitle: '6h+ · fermé', collapsed: true },
    }
    return lanes.map((lane) => {
      const meta = labels[lane]
      return {
        id: lane,
        title: meta.title,
        subtitle: meta.subtitle,
        collapsed: meta.collapsed,
        color: timeColor(lane),
        tabIds: tabs
          .filter((t) => laneForLastAccessed(t.lastAccessed, now) === lane)
          .map((t) => t.id),
      }
    })
  }

  if (mode === 'theme') {
    const order = ['Work', 'Personal', 'Reading', 'Other'] as const
    return order.map((theme) => ({
      id: theme.toLowerCase(),
      title: theme,
      subtitle: theme === 'Other' ? 'uncategorized' : 'suggested',
      collapsed: theme === 'Other' || theme === 'Personal',
      color: themeColor(theme),
      tabIds: tabs.filter((t) => themeForHost(hostnameOf(t.url)) === theme).map((t) => t.id),
    }))
  }

  if (mode === 'site') {
    const counts = new Map<string, number[]>()
    for (const tab of tabs) {
      const host = hostnameOf(tab.url)
      const list = counts.get(host) ?? []
      list.push(tab.id)
      counts.set(host, list)
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1].length - a[1].length)
    const top = ranked.slice(0, maxSite)
    const restIds = ranked.slice(maxSite).flatMap(([, ids]) => ids)
    const columns: GroupColumn[] = top.map(([host, ids], i) => ({
      id: `site:${host}`,
      title: host,
      subtitle: `${ids.length} tabs`,
      collapsed: i >= 2,
      color: SITE_COLORS[i % SITE_COLORS.length]!,
      tabIds: ids,
    }))
    if (restIds.length > 0) {
      columns.push({
        id: 'site:other',
        title: 'Other sites',
        subtitle: `${restIds.length} tabs`,
        collapsed: true,
        color: 'grey',
        tabIds: restIds,
      })
    }
    return columns
  }

  const byWindow = new Map<number, number[]>()
  for (const tab of tabs) {
    const list = byWindow.get(tab.windowId) ?? []
    list.push(tab.id)
    byWindow.set(tab.windowId, list)
  }
  return [...byWindow.entries()]
    .sort(([a], [b]) => {
      if (a === opts.currentWindowId) return -1
      if (b === opts.currentWindowId) return 1
      return a - b
    })
    .map(([windowId, ids], i) => ({
      id: `window:${windowId}`,
      title: windowId === opts.currentWindowId ? 'This window' : `Window ${i}`,
      subtitle: `${ids.length} tabs`,
      collapsed: windowId !== opts.currentWindowId,
      color: (windowId === opts.currentWindowId ? 'purple' : 'grey') as TabGroupColor,
      tabIds: ids,
    }))
}

export function groupableTabIds(tabs: TabLike[], ids: number[]): number[] {
  const map = new Map(tabs.map((t) => [t.id, t]))
  return ids.filter((id) => {
    const t = map.get(id)
    if (!t || t.pinned) return false
    if (!t.url || t.url.startsWith('chrome://') || t.url.startsWith('chrome-extension://')) return false
    return true
  })
}
