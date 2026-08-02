/**
 * Tab Manager storage — independent Clarity module
 */

export const TAB_MANAGER_ENABLED_KEY = 'tabManager.enabled'
export const TAB_MANAGER_PARKED_KEY = 'tabManager.parked'
export const TAB_MANAGER_UNDO_KEY = 'tabManager.undoPark'
export const TAB_MANAGER_AUTO_DUPES_KEY = 'tabManager.autoCloseDuplicates'
export const TAB_MANAGER_GROUP_BY_KEY = 'tabManager.groupBy'


export interface ParkedTab {
  title: string
  url: string
  favIconUrl?: string
  parkedAt: number
}

export interface UndoParkBatch {
  tabs: ParkedTab[]
  createdAt: number
}

export async function getModuleEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get(TAB_MANAGER_ENABLED_KEY)
  const value = result[TAB_MANAGER_ENABLED_KEY]
  return value !== false
}

export async function setModuleEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [TAB_MANAGER_ENABLED_KEY]: enabled })
}

export async function getParkedTabs(): Promise<ParkedTab[]> {
  const result = await chrome.storage.local.get(TAB_MANAGER_PARKED_KEY)
  const parked = result[TAB_MANAGER_PARKED_KEY]
  return Array.isArray(parked) ? parked : []
}

export async function setParkedTabs(tabs: ParkedTab[]): Promise<void> {
  await chrome.storage.local.set({ [TAB_MANAGER_PARKED_KEY]: tabs })
}

export async function addParkedTabs(tabs: ParkedTab[]): Promise<ParkedTab[]> {
  const existing = await getParkedTabs()
  const next = [...tabs, ...existing]
  await setParkedTabs(next)
  return next
}

export async function getUndoParkBatch(): Promise<UndoParkBatch | null> {
  const result = await chrome.storage.local.get(TAB_MANAGER_UNDO_KEY)
  const batch = result[TAB_MANAGER_UNDO_KEY] as UndoParkBatch | undefined
  if (!batch || !Array.isArray(batch.tabs) || batch.tabs.length === 0) return null
  return batch
}

export async function setUndoParkBatch(tabs: ParkedTab[]): Promise<void> {
  const batch: UndoParkBatch = { tabs, createdAt: Date.now() }
  await chrome.storage.local.set({ [TAB_MANAGER_UNDO_KEY]: batch })
}

export async function clearUndoParkBatch(): Promise<void> {
  await chrome.storage.local.remove(TAB_MANAGER_UNDO_KEY)
}

/** Default on — silent exact-URL duplicate cleanup */
export async function getAutoCloseDuplicates(): Promise<boolean> {
  const result = await chrome.storage.local.get(TAB_MANAGER_AUTO_DUPES_KEY)
  return result[TAB_MANAGER_AUTO_DUPES_KEY] !== false
}

export async function setAutoCloseDuplicates(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [TAB_MANAGER_AUTO_DUPES_KEY]: enabled })
}

export type StoredGroupBy = 'time' | 'theme' | 'site' | 'window'

export async function getGroupByMode(): Promise<StoredGroupBy> {
  const result = await chrome.storage.local.get(TAB_MANAGER_GROUP_BY_KEY)
  const value = result[TAB_MANAGER_GROUP_BY_KEY]
  if (value === 'theme' || value === 'site' || value === 'window' || value === 'time') return value
  return 'time'
}

export async function setGroupByMode(mode: StoredGroupBy): Promise<void> {
  await chrome.storage.local.set({ [TAB_MANAGER_GROUP_BY_KEY]: mode })
}
