/**
 * User-editable custom groups (host membership)
 */

import type { TabGroupColor } from './grouping'

export const TAB_MANAGER_USER_GROUPS_KEY = 'tabManager.userGroups'

export interface UserGroup {
  id: string
  title: string
  color: TabGroupColor
  collapsed: boolean
  /** Hostnames assigned to this group (remembered) */
  hosts: string[]
}

const DEFAULT_GROUPS: UserGroup[] = [
  {
    id: 'work',
    title: 'Work',
    color: 'green',
    collapsed: false,
    hosts: [
      'github.com', 'gitlab.com', 'supabase.com', 'linear.app', 'notion.so',
      'figma.com', 'slack.com', 'vercel.com', 'localhost', '127.0.0.1',
      'atlassian.net', 'asana.com', 'trello.com', 'cursor.com', 'openai.com',
      'chatgpt.com', 'claude.ai',
    ],
  },
  {
    id: 'personal',
    title: 'Personal',
    color: 'pink',
    collapsed: true,
    hosts: [
      'pinterest.com', 'youtube.com', 'amazon.com', 'amazon.co.jp', 'netflix.com',
      'reddit.com', 'instagram.com', 'tiktok.com', 'twitter.com', 'x.com',
    ],
  },
  {
    id: 'reading',
    title: 'Reading',
    color: 'cyan',
    collapsed: false,
    hosts: [
      'medium.com', 'wikipedia.org', 'substack.com', 'nytimes.com', 'bbc.com',
      'news.ycombinator.com',
    ],
  },
]

function newId(): string {
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function defaultUserGroups(): UserGroup[] {
  return DEFAULT_GROUPS.map((g) => ({ ...g, hosts: [...g.hosts] }))
}

export async function getUserGroups(): Promise<UserGroup[]> {
  const result = await chrome.storage.local.get(TAB_MANAGER_USER_GROUPS_KEY)
  const raw = result[TAB_MANAGER_USER_GROUPS_KEY]
  if (!Array.isArray(raw) || raw.length === 0) {
    const seeded = defaultUserGroups()
    await setUserGroups(seeded)
    return seeded
  }
  return raw
    .filter((g): g is UserGroup => g && typeof g.id === 'string' && typeof g.title === 'string')
    .map((g) => ({
      id: g.id,
      title: String(g.title).slice(0, 40) || 'Group',
      color: (g.color as TabGroupColor) || 'grey',
      collapsed: Boolean(g.collapsed),
      hosts: Array.isArray(g.hosts) ? g.hosts.map(String) : [],
    }))
}

export async function setUserGroups(groups: UserGroup[]): Promise<void> {
  await chrome.storage.local.set({ [TAB_MANAGER_USER_GROUPS_KEY]: groups })
}

export async function createUserGroup(title: string): Promise<UserGroup[]> {
  const groups = await getUserGroups()
  const colors: TabGroupColor[] = ['purple', 'blue', 'orange', 'yellow', 'red', 'green', 'pink', 'cyan']
  const group: UserGroup = {
    id: newId(),
    title: title.trim().slice(0, 40) || 'New group',
    color: colors[groups.length % colors.length]!,
    collapsed: false,
    hosts: [],
  }
  const next = [...groups, group]
  await setUserGroups(next)
  return next
}

export async function renameUserGroup(id: string, title: string): Promise<UserGroup[]> {
  const groups = await getUserGroups()
  const next = groups.map((g) =>
    g.id === id ? { ...g, title: title.trim().slice(0, 40) || g.title } : g
  )
  await setUserGroups(next)
  return next
}

export async function deleteUserGroup(id: string): Promise<UserGroup[]> {
  const groups = await getUserGroups()
  const next = groups.filter((g) => g.id !== id)
  await setUserGroups(next.length > 0 ? next : defaultUserGroups())
  return next.length > 0 ? next : defaultUserGroups()
}

export async function setUserGroupCollapsed(id: string, collapsed: boolean): Promise<UserGroup[]> {
  const groups = await getUserGroups()
  const next = groups.map((g) => (g.id === id ? { ...g, collapsed } : g))
  await setUserGroups(next)
  return next
}

/** Assign host to groupId; remove from all other groups. groupId null → ungrouped only. */
export async function assignHostToGroup(
  host: string,
  groupId: string | null
): Promise<UserGroup[]> {
  const normalized = host.replace(/^www\./, '').toLowerCase()
  if (!normalized) return getUserGroups()

  const groups = await getUserGroups()
  const next = groups.map((g) => {
    const hosts = g.hosts.filter((h) => h.toLowerCase() !== normalized)
    if (groupId && g.id === groupId) {
      return { ...g, hosts: [...hosts, normalized] }
    }
    return { ...g, hosts }
  })
  await setUserGroups(next)
  return next
}

export function findGroupIdForHost(groups: UserGroup[], host: string): string | null {
  const normalized = host.replace(/^www\./, '').toLowerCase()
  for (const g of groups) {
    if (
      g.hosts.some(
        (h) => normalized === h.toLowerCase() || normalized.endsWith(`.${h.toLowerCase()}`)
      )
    ) {
      return g.id
    }
  }
  return null
}

export interface SuggestedGroupApply {
  title: string
  /** Hostnames from tabs in this suggestion (may conflict across groups). */
  hosts: string[]
}

/**
 * Create/reuse Custom groups from AI suggestions and assign unique hosts.
 *
 * Limitation: membership is host-based. When the same host appears in multiple
 * suggested themes (common for chatgpt.com), we skip remembering that host so
 * we don't collapse themes — current-tab Chrome grouping still uses tabIds.
 */
export async function applySuggestedUserGroups(
  suggestions: SuggestedGroupApply[]
): Promise<{ groups: UserGroup[]; rememberedHosts: number; skippedConflictHosts: number }> {
  let groups = await getUserGroups()
  const planned: { groupId: string; hosts: string[] }[] = []

  for (const sug of suggestions) {
    const title = sug.title.trim().slice(0, 40)
    if (!title || /^ungrouped$/i.test(title)) continue

    let match = groups.find((g) => g.title.toLowerCase() === title.toLowerCase())
    if (!match) {
      groups = await createUserGroup(title)
      match = groups.find((g) => g.title.toLowerCase() === title.toLowerCase()) ?? groups[groups.length - 1]
    }
    if (!match) continue

    const hosts = [
      ...new Set(
        sug.hosts
          .map((h) => h.replace(/^www\./, '').toLowerCase())
          .filter((h) => h && h !== 'other')
      ),
    ]
    planned.push({ groupId: match.id, hosts })
  }

  const hostHits = new Map<string, number>()
  for (const p of planned) {
    for (const h of p.hosts) {
      hostHits.set(h, (hostHits.get(h) ?? 0) + 1)
    }
  }

  let rememberedHosts = 0
  let skippedConflictHosts = 0
  const next = groups.map((g) => ({ ...g, hosts: [...g.hosts] }))

  for (const p of planned) {
    const target = next.find((g) => g.id === p.groupId)
    if (!target) continue
    for (const host of p.hosts) {
      if ((hostHits.get(host) ?? 0) > 1) {
        skippedConflictHosts += 1
        continue
      }
      for (const g of next) {
        g.hosts = g.hosts.filter((h) => h.toLowerCase() !== host)
      }
      if (!target.hosts.some((h) => h.toLowerCase() === host)) {
        target.hosts.push(host)
      }
      rememberedHosts += 1
    }
  }

  await setUserGroups(next)
  return { groups: next, rememberedHosts, skippedConflictHosts }
}
