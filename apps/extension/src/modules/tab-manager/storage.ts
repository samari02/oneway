/**
 * Tab Manager storage — independent Clarity module
 */

export const TAB_MANAGER_ENABLED_KEY = 'tabManager.enabled'
export const TAB_MANAGER_PARKED_KEY = 'tabManager.parked'

export interface ParkedTab {
  title: string
  url: string
  favIconUrl?: string
  parkedAt: number
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
