/**
 * Clarity Tab Manager — workspace hygiene UI
 */

import { formatAge, laneForLastAccessed, RecencyLane, urlKey } from './buckets'
import { countDuplicateClosures, pickDuplicateTabIds, refreshTabManagerBadge } from './hygiene'
import {
  addParkedTabs,
  clearUndoParkBatch,
  getAutoCloseDuplicates,
  getModuleEnabled,
  getParkedTabs,
  getUndoParkBatch,
  ParkedTab,
  setAutoCloseDuplicates,
  setModuleEnabled,
  setParkedTabs,
  setUndoParkBatch,
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
  lastAccessed?: number
  lane: RecencyLane
}

type WindowScope = 'current' | 'all'

let enabled = true
let scope: WindowScope = 'current'
let currentWindowId: number | null = null
let allTabs: TabRow[] = []
let parkedTabs: ParkedTab[] = []
let hasUndo = false
let autoDupes = true
let query = ''
let toastTimer: ReturnType<typeof setTimeout> | null = null
let booted = false

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
  listActive: document.getElementById('list-active')!,
  listToday: document.getElementById('list-today')!,
  listIdle: document.getElementById('list-idle')!,
  metaActive: document.getElementById('meta-active')!,
  metaToday: document.getElementById('meta-today')!,
  metaIdle: document.getElementById('meta-idle')!,
  parkedMeta: document.getElementById('parked-meta')!,
  parkedList: document.getElementById('parked-list')!,
  parkOthers: document.getElementById('btn-park-others') as HTMLButtonElement,
  parkIdle: document.getElementById('btn-park-idle') as HTMLButtonElement,
  parkIdleMain: document.getElementById('btn-park-idle-main') as HTMLButtonElement,
  closeDupes: document.getElementById('btn-close-dupes') as HTMLButtonElement,
  restore: document.getElementById('btn-restore') as HTMLButtonElement,
  undo: document.getElementById('btn-undo') as HTMLButtonElement,
  idleNudge: document.getElementById('idle-nudge') as HTMLElement,
  idleNudgeText: document.getElementById('idle-nudge-text')!,
  autoDupes: document.getElementById('auto-dupes') as HTMLInputElement,
  scopeCurrent: document.getElementById('scope-current') as HTMLButtonElement,
  scopeAll: document.getElementById('scope-all') as HTMLButtonElement,
  toast: document.getElementById('toast')!,
  toastText: document.getElementById('toast-text')!,
  toastUndo: document.getElementById('toast-undo') as HTMLButtonElement,
}

function showToast(message: string, withUndo = false): void {
  els.toastText.textContent = message
  els.toastUndo.hidden = !withUndo
  els.toast.classList.add('is-visible')
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('is-visible')
  }, withUndo ? 8000 : 2400)
}

function isManagerTab(tab: { url?: string }): boolean {
  return Boolean(tab.url?.includes('tab-manager.html'))
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

function scopedTabs(): TabRow[] {
  if (scope === 'all' || currentWindowId == null) return allTabs
  return allTabs.filter((t) => t.windowId === currentWindowId)
}

function idleParkable(tabs: TabRow[]): TabRow[] {
  return tabs.filter(
    (t) =>
      t.lane === 'idle' &&
      !t.pinned &&
      t.url &&
      !t.url.startsWith('chrome://') &&
      !t.url.startsWith('chrome-extension://')
  )
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
  autoDupes = await getAutoCloseDuplicates()
  hasUndo = Boolean(await getUndoParkBatch())
  els.autoDupes.checked = autoDupes

  const [currentWin, tabs] = await Promise.all([
    chrome.windows.getCurrent(),
    chrome.tabs.query({}),
  ])
  currentWindowId = currentWin.id ?? null
  const groupMeta = await loadGroupMeta(tabs)
  const now = Date.now()

  allTabs = tabs
    .filter((t): t is chrome.tabs.Tab & { id: number } => typeof t.id === 'number')
    .filter((t) => !isManagerTab(t))
    .map((t) => {
      const groupId = t.groupId ?? chrome.tabGroups.TAB_GROUP_ID_NONE
      const meta = groupId === chrome.tabGroups.TAB_GROUP_ID_NONE ? undefined : groupMeta.get(groupId)
      const lastAccessed = t.lastAccessed
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
        lastAccessed,
        lane: laneForLastAccessed(lastAccessed, now),
      }
    })
    .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))

  if (!booted && autoDupes) {
    booted = true
    const closed = await closeDuplicates({ silent: true })
    if (closed > 0) {
      showToast(`Auto-closed ${closed} duplicate${closed === 1 ? '' : 's'}`)
      await loadState()
      return
    }
  } else {
    booted = true
  }

  render()
  void refreshTabManagerBadge(currentWindowId ?? undefined)
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

function renderTabRows(tabs: TabRow[]): string {
  if (tabs.length === 0) {
    return `<div class="tm__empty">None in this lane.</div>`
  }

  return tabs
    .map((tab) => {
      const host = hostnameOf(tab.url)
      const groupTag =
        tab.groupTitle != null
          ? `<span class="tm__group-tag">${escapeHtml(tab.groupTitle)}${tab.groupCollapsed ? ' · collapsed' : ''}</span>`
          : ''
      const age = `<span class="tm__age">${escapeHtml(formatAge(tab.lastAccessed))}</span>`
      return `
        <div class="tm__tab" data-tab-id="${tab.id}">
          ${renderFavicon(tab.favIconUrl, host)}
          <button class="tm__tab-main" type="button" data-action="activate" data-tab-id="${tab.id}">
            <div class="tm__tab-title">${escapeHtml(tab.title)}${tab.active ? ' · current' : ''}${tab.pinned ? ' · pinned' : ''}${groupTag}${age}</div>
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
}

function render(): void {
  setEnabledUi(enabled)

  els.scopeCurrent.classList.toggle('is-active', scope === 'current')
  els.scopeAll.classList.toggle('is-active', scope === 'all')

  const openTabs = scopedTabs().filter((t) => matchesQuery(t.title, t.url))
  const active = openTabs.filter((t) => t.lane === 'active')
  const today = openTabs.filter((t) => t.lane === 'today')
  const idle = openTabs.filter((t) => t.lane === 'idle')
  const parkableIdle = idleParkable(openTabs)
  const dupeCount = countDuplicateClosures(openTabs)
  const parkedFiltered = parkedTabs.filter((t) => matchesQuery(t.title, t.url))

  const otherWindows =
    currentWindowId == null
      ? 0
      : allTabs.filter((t) => t.windowId !== currentWindowId).length

  els.openCount.innerHTML = `${openTabs.length}<span>${scope === 'current' ? 'this window' : 'open'}</span>`

  const statusParts: string[] = []
  if (scope === 'current' && otherWindows > 0) statusParts.push(`${otherWindows} in other windows`)
  if (parkableIdle.length > 0) statusParts.push(`${parkableIdle.length} idle`)
  if (dupeCount > 0) statusParts.push(`${dupeCount} duplicate${dupeCount === 1 ? '' : 's'}`)
  if (parkedTabs.length > 0) statusParts.push(`${parkedTabs.length} parked`)
  els.statusLine.textContent =
    statusParts.length > 0 ? statusParts.join(' · ') : 'Sorted by last touch. Park idle to clear noise.'

  els.metaActive.textContent = String(active.length)
  els.metaToday.textContent = String(today.length)
  els.metaIdle.textContent = String(idle.length)
  els.parkedMeta.textContent = String(parkedFiltered.length)

  const showNudge = parkableIdle.length > 0
  els.idleNudge.hidden = !showNudge
  els.idleNudgeText.textContent = `${parkableIdle.length} idle tab${parkableIdle.length === 1 ? '' : 's'} (6h+) — park them?`
  els.parkIdle.textContent = `Park idle (${parkableIdle.length})`
  els.parkIdleMain.textContent =
    parkableIdle.length > 0 ? `Park idle (${parkableIdle.length})` : 'Park idle'
  els.parkIdleMain.disabled = parkableIdle.length === 0
  els.parkIdle.disabled = parkableIdle.length === 0

  els.closeDupes.textContent =
    dupeCount > 0 ? `Close duplicates (${dupeCount})` : 'Close duplicates'
  els.closeDupes.disabled = dupeCount === 0
  els.restore.disabled = parkedTabs.length === 0
  els.parkOthers.disabled = openTabs.length < 2
  els.undo.hidden = !hasUndo

  els.listActive.innerHTML = renderTabRows(active)
  els.listToday.innerHTML = renderTabRows(today)
  els.listIdle.innerHTML = renderTabRows(idle)
  renderParked(parkedFiltered)
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
  await setUndoParkBatch(payload)
  hasUndo = true
  await chrome.tabs.remove(parkable.map((t) => t.id))
  showToast(`Parked ${parkable.length} tab${parkable.length === 1 ? '' : 's'}`, true)
  await loadState()
}

async function closeDuplicates(opts?: { silent?: boolean }): Promise<number> {
  const tabs = scopedTabs().filter((t) => matchesQuery(t.title, t.url))
  const toClose = pickDuplicateTabIds(tabs)
  if (toClose.length === 0) {
    if (!opts?.silent) showToast('No duplicates')
    return 0
  }
  await chrome.tabs.remove(toClose)
  if (!opts?.silent) {
    showToast(`Closed ${toClose.length} duplicate${toClose.length === 1 ? '' : 's'}`)
    await loadState()
  }
  return toClose.length
}

async function undoLastPark(): Promise<void> {
  const batch = await getUndoParkBatch()
  if (!batch) {
    showToast('Nothing to undo')
    return
  }

  const parked = await getParkedTabs()
  const undoUrls = new Set(batch.tabs.map((t) => urlKey(t.url)))
  const remaining = parked.filter((t) => !undoUrls.has(urlKey(t.url)))
  // Prefer exact batch identity: remove one matching entry per undo tab from the front of parked
  let next = [...parked]
  for (const item of batch.tabs) {
    const idx = next.findIndex(
      (t) => t.url === item.url && t.parkedAt === item.parkedAt
    )
    if (idx >= 0) next.splice(idx, 1)
    else {
      const byUrl = next.findIndex((t) => urlKey(t.url) === urlKey(item.url))
      if (byUrl >= 0) next.splice(byUrl, 1)
    }
  }
  if (next.length === parked.length) next = remaining

  await setParkedTabs(next)
  await clearUndoParkBatch()
  hasUndo = false

  for (const tab of batch.tabs) {
    await chrome.tabs.create({ url: tab.url, active: false })
  }
  showToast(`Restored ${batch.tabs.length} parked tab${batch.tabs.length === 1 ? '' : 's'}`)
  await loadState()
}

async function restoreAll(): Promise<void> {
  if (parkedTabs.length === 0) return
  const toRestore = [...parkedTabs]
  await setParkedTabs([])
  await clearUndoParkBatch()
  hasUndo = false
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
  void refreshTabManagerBadge(currentWindowId ?? undefined)
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

  const parkIdle = () => void parkTabs(idleParkable(scopedTabs()))
  els.parkIdle.addEventListener('click', parkIdle)
  els.parkIdleMain.addEventListener('click', parkIdle)

  els.parkOthers.addEventListener('click', async () => {
    const [current] = await chrome.tabs.query({ active: true, currentWindow: true })
    const keepId = current?.id
    const others = scopedTabs().filter((t) => t.id !== keepId)
    await parkTabs(others)
  })

  els.closeDupes.addEventListener('click', () => void closeDuplicates())
  els.restore.addEventListener('click', () => void restoreAll())
  els.undo.addEventListener('click', () => void undoLastPark())
  els.toastUndo.addEventListener('click', () => void undoLastPark())

  els.autoDupes.addEventListener('change', async () => {
    autoDupes = els.autoDupes.checked
    await setAutoCloseDuplicates(autoDupes)
    showToast(autoDupes ? 'Auto-close duplicates on' : 'Auto-close duplicates off')
  })

  const onOpenListClick = async (event: Event) => {
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
  }

  els.listActive.addEventListener('click', (e) => void onOpenListClick(e))
  els.listToday.addEventListener('click', (e) => void onOpenListClick(e))
  els.listIdle.addEventListener('click', (e) => void onOpenListClick(e))

  els.parkedList.addEventListener('click', async (event) => {
    const target = (event.target as HTMLElement).closest('[data-action]') as HTMLElement | null
    if (!target) return
    const index = Number(target.dataset.parkedIndex)
    if (Number.isNaN(index)) return
    if (target.dataset.action === 'restore-one') await restoreOne(index)
    else if (target.dataset.action === 'discard-parked') await discardParked(index)
  })

  chrome.tabs.onCreated.addListener(() => void loadState())
  chrome.tabs.onRemoved.addListener(() => void loadState())
  chrome.tabs.onActivated.addListener(() => void loadState())
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
