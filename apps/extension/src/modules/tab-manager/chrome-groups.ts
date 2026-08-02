/**
 * Apply / clear Clarity-managed Chrome tab groups
 */

import {
  clarityGroupTitle,
  GroupByMode,
  GroupColumn,
  groupableTabIds,
  isClarityGroupTitle,
  TabLike,
} from './grouping'

export interface ApplyGroupsResult {
  created: number
  windows: number
  mode: GroupByMode
}

/**
 * Remove existing Clarity · * groups in the given windows (ungroup tabs).
 */
export async function clearClarityGroups(windowIds: number[]): Promise<void> {
  for (const windowId of windowIds) {
    const groups = await chrome.tabGroups.query({ windowId })
    for (const group of groups) {
      if (!isClarityGroupTitle(group.title)) continue
      const tabs = await chrome.tabs.query({ windowId, groupId: group.id })
      const ids = tabs.map((t) => t.id).filter((id): id is number => typeof id === 'number')
      if (ids.length > 0) {
        await chrome.tabs.ungroup(ids)
      }
    }
  }
}

/**
 * Apply columns as native Chrome groups. Only groupable tabs (not pinned / chrome://).
 * Window mode is view-only — returns created: 0.
 */
export async function applyColumnsAsChromeGroups(
  mode: GroupByMode,
  columns: GroupColumn[],
  tabs: TabLike[],
  windowIds: number[]
): Promise<ApplyGroupsResult> {
  if (mode === 'window') {
    return { created: 0, windows: 0, mode }
  }

  await clearClarityGroups(windowIds)

  let created = 0
  for (const windowId of windowIds) {
    const windowTabIds = new Set(tabs.filter((t) => t.windowId === windowId).map((t) => t.id))

    for (const col of columns) {
      if (col.id === 'ungrouped') continue
      const ids = groupableTabIds(
        tabs,
        col.tabIds.filter((id) => windowTabIds.has(id))
      )
      if (ids.length === 0) continue

      const groupId = await chrome.tabs.group({ tabIds: ids, createProperties: { windowId } })
      await chrome.tabGroups.update(groupId, {
        title: clarityGroupTitle(col.title),
        color: col.color,
        collapsed: col.collapsed,
      })
      created += 1
    }
  }

  return { created, windows: windowIds.length, mode }
}
