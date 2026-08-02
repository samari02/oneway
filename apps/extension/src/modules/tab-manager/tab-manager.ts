/**
 * Clarity Tab Manager — standalone extension module
 */

import {
  addParkedTabs,
  getModuleEnabled,
  getParkedTabs,
  ParkedTab,
  setModuleEnabled,
  setParkedTabs,
} from './storage'

interface TabRow {
  id: number
  title: string
  url: string
  favIconUrl?: string
  active: boolean
  pinned: boolean
  windowId: number
  groupId: number
  groupTitle?: string
  groupCollapsed?: boolean
}

type WindowScope = 'current' | 'all'

let enabled = true
let scope: WindowScope = 'current'
let currentWindowId: number | null = null
let allTabs: TabRow[] = []
let parkedTabs: ParkedTab[] = []
let query = ''
let toastTimer: ReturnType<typeof setTimeout> | null = null

const els = {
  toggle: document.getElementById('btn-toggle') as HTMLButtonElement,
  toggleLabel: document.getElementById('toggle-label')!,
  enable: document.getElementById('btn-enable') as HTMLButtonElement,
  close: document.getElementById('btn-close') as HTMLButtonElement,
  disabled: document.getElementById('disabled-state')!,
  body: document.getElementById('main-body')!,
  search: document.getElementById('search') as HTMLInputElement,
  openCount: document.getElementById('open-count')!,
  statusLine: document.getElementById('status-line')!,
  openMeta: document.getElementById('open-meta')!,
  parkedMeta: document.getElementById('parked-meta')!,
  openList: document.getElementById('open-list')!,
  parkedList: document.getElementById('parked-list')!,
  parkOthers: document.getElementById('btn-park-others') as HTMLButtonElement,
  closeDupes: document.getElementById('btn-close-dupes') as HTMLButtonElement,
  restore: document.getElementById('btn-restore') as HTMLButtonElement,
  scopeCurrent: document.getElementById('scope-current') as HTMLButtonElement,
  scopeAll: document.getElementById('scope-all') as HTMLButtonElement,
  toast: document.getElementById('toast')!,
}

function showToast(message: string): void {
  els.toast.textContent = message
  els.toast.classList.add('is-visible')
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('is-visible')
  }, 2200)
}

function isManagerTab(tab: chrome.tabs.Tab | TabRow): boolean {
  const url = tab.url ?? ''
  return url.includes('tab-manager.html')
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || 'Other'
  } catch {
    return 'Other'
  }
}

function faviconFallback(host: string): string {
  return host.slice(0, 1).toUpperCase() || '?'
}

function matchesQuery(title: string, url: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return title.toLowerCase().includes(q) || url.toLowerCase().includes(q)
}

function urlKey(url: string): string {
  return url.split('#')[0]
}

function scopedTabs(): TabRow[] {
  if (scope === 'all' || currentWindowId == null) return allTabs
  return allTabs.filter((t) => t.windowId === currentWindowId)
}

function countDuplicateClosures(tabs: TabRow[]): number {
  const seen = new Set<string>()
  let count = 0
  for (const tab of tabs) {
    if (!tab.url || tab.pinned) continue
    const key = urlKey(tab.url)
    if (seen.has(key)) count += 1
    else seen.add(key)
  }
  return count
}

async function loadGroupMeta(
  tabs: chrome.tabs.Tab[]
): Promise<Map<number, { title: string; collapsed: boolean }>> {
  const map = new Map<number, { title: string; collapsed: boolean }>()
  const ids = [
    ...new Set(
      tabs
        .map((t) => t.groupId)
        .filter((id): id is number => typeof id === 'number' && id !== chrome.tabGroups.TAB_GROUP_ID_NONE)
    ),
  ]

  await Promise.all(
    ids.map(async (id) => {
      try {
        const group = await chrome.tabGroups.get(id)
        map.set(id, {
          title: group.title?.trim() || 'Group',
          collapsed: Boolean(group.collapsed),
        })
      } catch {
        map.set(id, { title: 'Group', collapsed: false })
      }
    })
  )

  return map
}

async function loadState(): Promise<void> {
  enabled = await getModuleEnabled()
  parkedTabs = await getParkedTabs()

  const [currentWin, tabs] = await Promise.all([
    chrome.windows.getCurrent(),
    chrome.tabs.query({}),
  ])
  currentWindowId = currentWin.id ?? null

  const groupMeta = await loadGroupMeta(tabs)

  allTabs = tabs
    .filter((t): t is chrome.tabs.Tab & { id: number } => typeof t.id === 'number')
    .filter((t) => !isManagerTab(t))
    .map((t) => {
      const groupId = t.groupId ?? chrome.tabGroups.TAB_GROUP_ID_NONE
      const meta = groupId === chrome.tabGroups.TAB_GROUP_ID_NONE ? undefined : groupMeta.get(groupId)
      return {
        id: t.id,
        title: t.title || 'Untitled',
        url: t.url || '',
        favIconUrl: t.favIconUrl,
        active: Boolean(t.active),
        pinned: Boolean(t.pinned),
        windowId: t.windowId,
        groupId,
        groupTitle: meta?.title,
        groupCollapsed: meta?.collapsed,
      }
    })

  render()
}

function setEnabledUi(next: boolean): void {
  enabled = next
  els.toggle.setAttribute('aria-checked', String(next))
  els.toggleLabel.textContent = next ? 'On' : 'Off'
  els.disabled.classList.toggle('is-visible', !next)
  els.body.classList.toggle('is-hidden', !next)
}

function renderFavicon(url: string | undefined, host: string): string {
  if (url) {
    return `<img class="tm__group-favicon" src="${escapeAttr(url)}" alt="" />`
  }
  return `<div class="tm__group-favicon tm__group-favicon--fallback">${escapeHtml(faviconFallback(host))}</div>`
}

function buildStatusLine(visible: TabRow[], dupeCount: number): string {
  const parts: string[] = []
  const otherWindows = allTabs.length - (currentWindowId == null
    ? allTabs.length
    : allTabs.filter((t) => t.windowId === currentWindowId).length)

  if (scope === 'current' && otherWindows > 0) {
    parts.push(`${otherWindows} in other windows`)
  } else if (scope === 'all') {
    const windowCount = new Set(allTabs.map((t) => t.windowId)).size
    parts.push(`${windowCount} window${windowCount === 1 ? '' : 's'}`)
  }

  const inGroups = visible.filter((t) => t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE).length
  const collapsedGrouped = visible.filter((t) => t.groupCollapsed).length
  if (inGroups > 0) {
    parts.push(
      collapsedGrouped > 0
        ? `${inGroups} in Chrome groups (${collapsedGrouped} collapsed)`
        : `${inGroups} in Chrome groups`
    )
  }

  if (dupeCount > 0) parts.push(`${dupeCount} duplicate${dupeCount === 1 ? '' : 's'}`)
  if (parkedTabs.length > 0) parts.push(`${parkedTabs.length} parked`)

  return parts.length > 0 ? parts.join(' · ') : 'Park the noise. Keep what you need.'
}

function render(): void {
  setEnabledUi(enabled)

  els.scopeCurrent.classList.toggle('is-active', scope === 'current')
  els.scopeAll.classList.toggle('is-active', scope === 'all')

  const openTabs = scopedTabs()
  const filtered = openTabs.filter((t) => matchesQuery(t.title, t.url))
  const parkedFiltered = parkedTabs.filter((t) => matchesQuery(t.title, t.url))
  const dupeCount = countDuplicateClosures(filtered)

  els.openCount.innerHTML = `${filtered.length}<span>${scope === 'current' ? 'this window' : 'open'}</span>`
  els.openMeta.textContent = String(filtered.length)
  els.parkedMeta.textContent = String(parkedFiltered.length)
  els.statusLine.textContent = buildStatusLine(filtered, dupeCount)

  els.closeDupes.textContent =
    dupeCount > 0 ? `Close duplicates (${dupeCount})` : 'Close duplicates'
  els.closeDupes.disabled = dupeCount === 0
  els.restore.disabled = parkedTabs.length === 0
  els.parkOthers.disabled = filtered.length < 2

  renderOpenGroups(filtered)
  renderParked(parkedFiltered)
}

function renderOpenGroups(tabs: TabRow[]): void {
  if (tabs.length === 0) {
    els.openList.innerHTML = `<div class="tm__empty">No open tabs match.</div>`
    return
  }

  const groups = new Map<string, TabRow[]>()
  for (const tab of tabs) {
    const host = hostnameOf(tab.url)
    const list = groups.get(host) ?? []
    list.push(tab)
    groups.set(host, list)
  }

  const html = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([host, list]) => {
      const icon = renderFavicon(list.find((t) => t.favIconUrl)?.favIconUrl, host)
      const rows = list
        .map((tab) => {
          const groupTag =
            tab.groupTitle != null
              ? `<span class="tm__group-tag">${escapeHtml(tab.groupTitle)}${tab.groupCollapsed ? ' · collapsed' : ''}</span>`
              : ''
          return `
            <div class="tm__tab" data-tab-id="${tab.id}">
              ${renderFavicon(tab.favIconUrl, host)}
              <button class="tm__tab-main" type="button" data-action="activate" data-tab-id="${tab.id}">
                <div class="tm__tab-title">${escapeHtml(tab.title)}${tab.active ? ' · current' : ''}${tab.pinned ? ' · pinned' : ''}${groupTag}</div>
                <div class="tm__tab-url">${escapeHtml(tab.url)}</div>
              </button>
              <button class="tm__icon-btn" type="button" data-action="park" data-tab-id="${tab.id}" title="Park" aria-label="Park tab">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              </button>
              <button class="tm__icon-btn tm__icon-btn--danger" type="button" data-action="close" data-tab-id="${tab.id}" title="Close" aria-label="Close tab">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            </div>
          `
        })
        .join('')

      return `
        <div class="tm__group">
          <div class="tm__group-head">
            ${icon}
            <span class="tm__group-name">${escapeHtml(host)}</span>
            <span class="tm__badge">${list.length}</span>
          </div>
          ${rows}
        </div>
      `
    })
    .join('')

  els.openList.innerHTML = html
}

function renderParked(tabs: ParkedTab[]): void {
  if (tabs.length === 0) {
    els.parkedList.innerHTML = `<div class="tm__empty">Nothing parked yet.</div>`
    return
  }

  els.parkedList.innerHTML = tabs
    .map((tab, index) => {
      const host = hostnameOf(tab.url)
      return `
        <div class="tm__tab" data-parked-index="${index}">
          ${renderFavicon(tab.favIconUrl, host)}
          <button class="tm__tab-main" type="button" data-action="restore-one" data-parked-index="${index}">
            <div class="tm__tab-title">${escapeHtml(tab.title)}</div>
            <div class="tm__tab-url">${escapeHtml(tab.url)}</div>
          </button>
          <button class="tm__icon-btn tm__icon-btn--danger" type="button" data-action="discard-parked" data-parked-index="${index}" title="Remove" aria-label="Remove parked tab">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
      `
    })
    .join('')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;')
}

async function parkTabs(tabs: TabRow[]): Promise<void> {
  const parkable = tabs.filter((t) => t.url && !t.pinned && !t.url.startsWith('chrome://'))
  if (parkable.length === 0) {
    showToast('Nothing to park')
    return
  }

  const payload: ParkedTab[] = parkable.map((t) => ({
    title: t.title,
    url: t.url,
    favIconUrl: t.favIconUrl,
    parkedAt: Date.now(),
  }))

  await addParkedTabs(payload)
  await chrome.tabs.remove(parkable.map((t) => t.id))
  showToast(`Parked ${parkable.length} tab${parkable.length === 1 ? '' : 's'}`)
  await loadState()
}

async function closeDuplicates(): Promise<void> {
  const tabs = scopedTabs().filter((t) => matchesQuery(t.title, t.url))
  const seen = new Set<string>()
  const toClose: number[] = []

  for (const tab of tabs) {
    if (!tab.url || tab.pinned) continue
    const key = urlKey(tab.url)
    if (seen.has(key)) toClose.push(tab.id)
    else seen.add(key)
  }

  if (toClose.length === 0) {
    showToast('No duplicates')
    return
  }

  await chrome.tabs.remove(toClose)
  showToast(`Closed ${toClose.length} duplicate${toClose.length === 1 ? '' : 's'}`)
  await loadState()
}

async function restoreAll(): Promise<void> {
  if (parkedTabs.length === 0) return
  const toRestore = [...parkedTabs]
  await setParkedTabs([])
  for (const tab of toRestore) {
    await chrome.tabs.create({ url: tab.url, active: false })
  }
  showToast(`Restored ${toRestore.length}`)
  await loadState()
}

async function restoreOne(index: number): Promise<void> {
  const tab = parkedTabs[index]
  if (!tab) return
  const next = parkedTabs.filter((_, i) => i !== index)
  await setParkedTabs(next)
  await chrome.tabs.create({ url: tab.url, active: true })
  showToast('Restored tab')
  await loadState()
}

async function discardParked(index: number): Promise<void> {
  const next = parkedTabs.filter((_, i) => i !== index)
  await setParkedTabs(next)
  parkedTabs = next
  render()
}

async function onToggle(next: boolean): Promise<void> {
  await setModuleEnabled(next)
  enabled = next
  render()
  showToast(next ? 'Tab Manager on' : 'Tab Manager off')
}

function setScope(next: WindowScope): void {
  scope = next
  render()
}

function wireEvents(): void {
  els.toggle.addEventListener('click', () => {
    void onToggle(!(els.toggle.getAttribute('aria-checked') === 'true'))
  })
  els.enable.addEventListener('click', () => void onToggle(true))
  els.close.addEventListener('click', () => window.close())
  els.search.addEventListener('input', () => {
    query = els.search.value.trim()
    render()
  })

  els.scopeCurrent.addEventListener('click', () => setScope('current'))
  els.scopeAll.addEventListener('click', () => setScope('all'))

  els.parkOthers.addEventListener('click', async () => {
    const [current] = await chrome.tabs.query({ active: true, currentWindow: true })
    const keepId = current?.id
    const others = scopedTabs().filter((t) => t.id !== keepId)
    await parkTabs(others)
  })

  els.closeDupes.addEventListener('click', () => void closeDuplicates())
  els.restore.addEventListener('click', () => void restoreAll())

  els.openList.addEventListener('click', async (event) => {
    const target = (event.target as HTMLElement).closest('[data-action]') as HTMLElement | null
    if (!target) return
    const action = target.dataset.action
    const id = Number(target.dataset.tabId)
    if (!id) return

    const openTabs = scopedTabs()

    if (action === 'activate') {
      const tab = openTabs.find((t) => t.id === id)
      if (!tab) return
      await chrome.tabs.update(id, { active: true })
      await chrome.windows.update(tab.windowId, { focused: true })
      return
    }

    if (action === 'close') {
      await chrome.tabs.remove(id)
      await loadState()
      return
    }

    if (action === 'park') {
      const tab = openTabs.find((t) => t.id === id)
      if (tab) await parkTabs([tab])
    }
  })

  els.parkedList.addEventListener('click', async (event) => {
    const target = (event.target as HTMLElement).closest('[data-action]') as HTMLElement | null
    if (!target) return
    const index = Number(target.dataset.parkedIndex)
    if (Number.isNaN(index)) return

    if (target.dataset.action === 'restore-one') {
      await restoreOne(index)
    } else if (target.dataset.action === 'discard-parked') {
      await discardParked(index)
    }
  })

  chrome.tabs.onCreated.addListener(() => void loadState())
  chrome.tabs.onRemoved.addListener(() => void loadState())
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.status === 'complete' || changeInfo.title || changeInfo.url || changeInfo.groupId != null) {
      void loadState()
    }
  })
  if (chrome.tabGroups?.onUpdated) {
    chrome.tabGroups.onUpdated.addListener(() => void loadState())
  }
}

void (async () => {
  wireEvents()
  await loadState()
})()
