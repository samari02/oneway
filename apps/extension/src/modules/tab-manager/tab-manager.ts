/**
 * Clarity Workspace — board + group-by + editable custom groups + park
 */

import { formatAge, laneForLastAccessed } from './buckets'
import { applyColumnsAsChromeGroups, clearClarityGroups } from './chrome-groups'
import {
  buildColumns,
  GroupByMode,
  GROUP_BY_LABELS,
  hostnameOf,
} from './grouping'
import { countDuplicateClosures, pickDuplicateTabIds, refreshTabManagerBadge } from './hygiene'
import {
  addParkedTabs,
  clearUndoParkBatch,
  getAutoCloseDuplicates,
  getGroupByMode,
  getModuleEnabled,
  getParkedTabs,
  getUndoParkBatch,
  ParkedTab,
  setAutoCloseDuplicates,
  setGroupByMode,
  setModuleEnabled,
  setParkedTabs,
  setUndoParkBatch,
} from './storage'
import {
  assignHostToGroup,
  createUserGroup,
  deleteUserGroup,
  getUserGroups,
  renameUserGroup,
  UserGroup,
} from './user-groups'

interface TabRow {
  id: number
  title: string
  url: string
  favIconUrl?: string
  active: boolean
  pinned: boolean
  windowId: number
  lastAccessed?: number
}

type WindowScope = 'current' | 'all'

const GROUP_HINTS: Record<GroupByMode, string> = {
  time: 'Time uses last touch (1h active · 1–6h today · 6h+ idle)',
  theme: 'Theme uses your saved domain rules (same as Custom)',
  site: 'Site groups top domains; Other sites collapsed',
  window: 'Window is for browsing — switch mode to apply Chrome groups',
  custom: 'Drag tabs between columns to teach domains · rename / new / delete',
}

const CHIP_PREVIEW = 6

let enabled = true
let scope: WindowScope = 'current'
let groupBy: GroupByMode = 'time'
let currentWindowId: number | null = null
let allTabs: TabRow[] = []
let parkedTabs: ParkedTab[] = []
let userGroups: UserGroup[] = []
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
  board: document.getElementById('board')!,
  groupHint: document.getElementById('groupby-hint')!,
  parkedMeta: document.getElementById('parked-meta')!,
  parkedList: document.getElementById('parked-list')!,
  parkOthers: document.getElementById('btn-park-others') as HTMLButtonElement,
  parkIdle: document.getElementById('btn-park-idle') as HTMLButtonElement,
  parkIdleMain: document.getElementById('btn-park-idle-main') as HTMLButtonElement,
  applyGroups: document.getElementById('btn-apply-groups') as HTMLButtonElement,
  newGroup: document.getElementById('btn-new-group') as HTMLButtonElement,
  clearGroups: document.getElementById('btn-clear-groups') as HTMLButtonElement,
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

function isEditableMode(): boolean {
  return groupBy === 'custom' || groupBy === 'theme'
}

function showToast(message: string, withUndo = false): void {
  els.toastText.textContent = message
  els.toastUndo.hidden = !withUndo
  els.toast.classList.add('is-visible')
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('is-visible')
  }, withUndo ? 8000 : 2600)
}

function isManagerTab(tab: { url?: string }): boolean {
  return Boolean(tab.url?.includes('tab-manager.html'))
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

function filteredTabs(): TabRow[] {
  return scopedTabs().filter((t) => matchesQuery(t.title, t.url))
}

function idleParkable(tabs: TabRow[]): TabRow[] {
  const now = Date.now()
  return tabs.filter((t) => {
    if (t.pinned || !t.url) return false
    if (t.url.startsWith('chrome://') || t.url.startsWith('chrome-extension://')) return false
    return laneForLastAccessed(t.lastAccessed, now) === 'idle'
  })
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

function faviconHtml(url: string | undefined, host: string): string {
  if (url) return `<img class="tm__group-favicon" src="${escapeAttr(url)}" alt="" />`
  const letter = host.slice(0, 1).toUpperCase() || '?'
  return `<div class="tm__group-favicon tm__group-favicon--fallback">${escapeHtml(letter)}</div>`
}

async function loadState(): Promise<void> {
  enabled = await getModuleEnabled()
  parkedTabs = await getParkedTabs()
  autoDupes = await getAutoCloseDuplicates()
  groupBy = await getGroupByMode()
  userGroups = await getUserGroups()
  hasUndo = Boolean(await getUndoParkBatch())
  els.autoDupes.checked = autoDupes

  const [currentWin, tabs] = await Promise.all([
    chrome.windows.getCurrent(),
    chrome.tabs.query({}),
  ])
  currentWindowId = currentWin.id ?? null

  allTabs = tabs
    .filter((t): t is chrome.tabs.Tab & { id: number } => typeof t.id === 'number')
    .filter((t) => !isManagerTab(t))
    .map((t) => ({
      id: t.id,
      title: t.title || 'Untitled',
      url: t.url || '',
      favIconUrl: t.favIconUrl,
      active: Boolean(t.active),
      pinned: Boolean(t.pinned),
      windowId: t.windowId,
      lastAccessed: t.lastAccessed,
    }))
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

function syncGroupByUi(): void {
  document.querySelectorAll('.tm__groupby-btn').forEach((btn) => {
    const el = btn as HTMLElement
    el.classList.toggle('is-active', el.dataset.groupby === groupBy)
  })
  els.groupHint.textContent = GROUP_HINTS[groupBy]
  els.newGroup.hidden = !isEditableMode()
}

function renderBoard(tabs: TabRow[]): void {
  const columns = buildColumns(groupBy, tabs, { currentWindowId, userGroups })
  const byId = new Map(tabs.map((t) => [t.id, t]))
  const editable = isEditableMode()

  const hint = editable
    ? `<p class="tm__edit-hint">Drag a tab onto a group to remember its domain. Rename / Delete on columns · New group above.</p>`
    : ''

  els.board.innerHTML =
    hint +
    columns
      .map((col) => {
        const previewIds = col.tabIds.slice(0, CHIP_PREVIEW)
        const extra = col.tabIds.length - previewIds.length
        const chips = previewIds
          .map((id) => {
            const tab = byId.get(id)
            if (!tab) return ''
            const host = hostnameOf(tab.url)
            const drag = editable ? `draggable="true" data-host="${escapeAttr(host)}"` : ''
            return `
              <button class="tm__tabchip" type="button" data-action="activate" data-tab-id="${tab.id}" ${drag}>
                ${faviconHtml(tab.favIconUrl, host)}
                <span class="tm__tabchip-title">${escapeHtml(tab.title)}</span>
                <span class="tm__tabchip-age">${escapeHtml(formatAge(tab.lastAccessed))}</span>
              </button>
            `
          })
          .join('')

        const empty =
          col.tabIds.length === 0
            ? `<div class="tm__empty">${editable ? 'Drop tabs here' : 'Empty'}</div>`
            : `${chips}${extra > 0 ? `<div class="tm__more-count">+${extra} more</div>` : ''}`

        const actions =
          editable && col.editable
            ? `<div class="tm__col-actions">
                <button type="button" class="tm__col-btn" data-action="rename-group" data-col-id="${escapeAttr(col.id)}" title="Rename">R</button>
                <button type="button" class="tm__col-btn" data-action="delete-group" data-col-id="${escapeAttr(col.id)}" title="Delete">X</button>
              </div>`
            : `<span class="tm__col-badge">${col.tabIds.length}</span>`

        return `
          <section class="tm__col${col.collapsed ? ' tm__col--collapsed-hint' : ''}" data-col-id="${escapeAttr(col.id)}" data-drop-col="1">
            <div class="tm__col-head">
              <div>
                <div class="tm__col-title">${escapeHtml(col.title)}</div>
                ${col.subtitle ? `<div class="tm__col-sub">${escapeHtml(col.subtitle)}</div>` : ''}
              </div>
              ${actions}
            </div>
            <div class="tm__chip-row">${empty}</div>
          </section>
        `
      })
      .join('')
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
          ${faviconHtml(tab.favIconUrl, host)}
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

function render(): void {
  setEnabledUi(enabled)
  syncGroupByUi()

  els.scopeCurrent.classList.toggle('is-active', scope === 'current')
  els.scopeAll.classList.toggle('is-active', scope === 'all')

  const tabs = filteredTabs()
  const parkableIdle = idleParkable(tabs)
  const dupeCount = countDuplicateClosures(tabs)
  const parkedFiltered = parkedTabs.filter((t) => matchesQuery(t.title, t.url))
  const otherWindows =
    currentWindowId == null
      ? 0
      : allTabs.filter((t) => t.windowId !== currentWindowId).length

  els.openCount.innerHTML = `${tabs.length}<span>${scope === 'current' ? 'this window' : 'open'}</span>`

  const parts: string[] = []
  if (scope === 'current' && otherWindows > 0) parts.push(`${otherWindows} in other windows`)
  parts.push(`Group by ${GROUP_BY_LABELS[groupBy]}`)
  if (parkedTabs.length > 0) parts.push(`${parkedTabs.length} parked`)
  els.statusLine.textContent = parts.join(' · ')

  els.idleNudge.hidden = parkableIdle.length === 0
  els.idleNudgeText.textContent = `${parkableIdle.length} idle (6h+) — park them?`
  const idleLabel = parkableIdle.length > 0 ? `Park idle (${parkableIdle.length})` : 'Park idle'
  els.parkIdle.textContent = idleLabel
  els.parkIdleMain.textContent = idleLabel
  els.parkIdle.disabled = parkableIdle.length === 0
  els.parkIdleMain.disabled = parkableIdle.length === 0

  els.closeDupes.textContent =
    dupeCount > 0 ? `Close duplicates (${dupeCount})` : 'Close duplicates'
  els.closeDupes.disabled = dupeCount === 0
  els.restore.disabled = parkedTabs.length === 0
  els.parkOthers.disabled = tabs.length < 2
  els.undo.hidden = !hasUndo

  const canApply = groupBy !== 'window'
  els.applyGroups.disabled = !canApply || tabs.length === 0
  els.applyGroups.title = canApply
    ? 'Create Clarity Chrome groups from this board'
    : 'Switch mode to apply groups'

  renderBoard(tabs)
  els.parkedMeta.textContent = String(parkedFiltered.length)
  renderParked(parkedFiltered)
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
  showToast(`Parked ${parkable.length}`, true)
  await loadState()
}

async function closeDuplicates(opts?: { silent?: boolean }): Promise<number> {
  const tabs = filteredTabs()
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
  let next = [...parked]
  for (const item of batch.tabs) {
    const idx = next.findIndex((t) => t.url === item.url && t.parkedAt === item.parkedAt)
    if (idx >= 0) next.splice(idx, 1)
  }
  await setParkedTabs(next)
  await clearUndoParkBatch()
  hasUndo = false
  for (const tab of batch.tabs) {
    await chrome.tabs.create({ url: tab.url, active: false })
  }
  showToast(`Restored ${batch.tabs.length}`)
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

async function applyGroups(): Promise<void> {
  if (groupBy === 'window') {
    showToast('Pick Time, Custom, Theme, or Site')
    return
  }
  const tabs = filteredTabs()
  const columns = buildColumns(groupBy, tabs, { currentWindowId, userGroups })
  const windowIds =
    scope === 'all'
      ? [...new Set(tabs.map((t) => t.windowId))]
      : currentWindowId != null
        ? [currentWindowId]
        : []

  els.applyGroups.disabled = true
  try {
    const result = await applyColumnsAsChromeGroups(groupBy, columns, tabs, windowIds)
    if (result.created === 0) showToast('No groupable tabs')
    else showToast(`Applied ${result.created} Chrome group${result.created === 1 ? '' : 's'}`)
    await loadState()
  } catch (err) {
    console.error('[Tab Manager] apply groups failed', err)
    showToast('Could not apply groups')
    els.applyGroups.disabled = false
  }
}

async function clearGroups(): Promise<void> {
  const tabs = filteredTabs()
  const windowIds =
    scope === 'all'
      ? [...new Set(tabs.map((t) => t.windowId))]
      : currentWindowId != null
        ? [currentWindowId]
        : []
  await clearClarityGroups(windowIds)
  showToast('Cleared Clarity groups')
  await loadState()
}

async function onDropHost(host: string, colId: string): Promise<void> {
  if (!isEditableMode()) return
  const target = colId === 'ungrouped' ? null : colId
  userGroups = await assignHostToGroup(host, target)
  const label = target ? userGroups.find((g) => g.id === target)?.title ?? 'group' : 'Ungrouped'
  showToast(`Remembered ${host} → ${label}`)
  render()
}

function wireBoardDnD(): void {
  els.board.addEventListener('dragstart', (event) => {
    const chip = (event.target as HTMLElement).closest('.tm__tabchip') as HTMLElement | null
    if (!chip || !chip.draggable) return
    const host = chip.dataset.host
    if (!host || !event.dataTransfer) return
    event.dataTransfer.setData('text/clarity-host', host)
    event.dataTransfer.effectAllowed = 'move'
    chip.classList.add('is-dragging')
  })

  els.board.addEventListener('dragend', (event) => {
    const chip = (event.target as HTMLElement).closest('.tm__tabchip')
    chip?.classList.remove('is-dragging')
    els.board.querySelectorAll('.tm__col.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'))
  })

  els.board.addEventListener('dragover', (event) => {
    if (!isEditableMode()) return
    const col = (event.target as HTMLElement).closest('[data-drop-col]') as HTMLElement | null
    if (!col) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    els.board.querySelectorAll('.tm__col.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'))
    col.classList.add('is-drop-target')
  })

  els.board.addEventListener('drop', (event) => {
    const col = (event.target as HTMLElement).closest('[data-drop-col]') as HTMLElement | null
    if (!col || !event.dataTransfer) return
    event.preventDefault()
    const host = event.dataTransfer.getData('text/clarity-host')
    const colId = col.dataset.colId
    col.classList.remove('is-drop-target')
    if (host && colId) void onDropHost(host, colId)
  })
}

function wireEvents(): void {
  els.toggle.addEventListener('click', () => {
    void (async () => {
      const next = !(els.toggle.getAttribute('aria-checked') === 'true')
      await setModuleEnabled(next)
      enabled = next
      render()
      showToast(next ? 'Tab Manager on' : 'Tab Manager off')
    })()
  })
  els.enable.addEventListener('click', () => {
    void (async () => {
      await setModuleEnabled(true)
      enabled = true
      render()
    })()
  })
  els.close.addEventListener('click', () => window.close())
  els.search.addEventListener('input', () => {
    query = els.search.value.trim()
    render()
  })

  els.scopeCurrent.addEventListener('click', () => {
    scope = 'current'
    render()
  })
  els.scopeAll.addEventListener('click', () => {
    scope = 'all'
    render()
  })

  document.querySelectorAll('.tm__groupby-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = (btn as HTMLElement).dataset.groupby as GroupByMode
      void (async () => {
        groupBy = mode
        await setGroupByMode(mode)
        render()
      })()
    })
  })

  const parkIdle = () => void parkTabs(idleParkable(filteredTabs()))
  els.parkIdle.addEventListener('click', parkIdle)
  els.parkIdleMain.addEventListener('click', parkIdle)
  els.applyGroups.addEventListener('click', () => void applyGroups())
  els.clearGroups.addEventListener('click', () => void clearGroups())
  els.closeDupes.addEventListener('click', () => void closeDuplicates())
  els.restore.addEventListener('click', () => void restoreAll())
  els.undo.addEventListener('click', () => void undoLastPark())
  els.toastUndo.addEventListener('click', () => void undoLastPark())

  els.newGroup.addEventListener('click', () => {
    const title = prompt('New group name')
    if (!title?.trim()) return
    void (async () => {
      userGroups = await createUserGroup(title)
      if (groupBy !== 'custom' && groupBy !== 'theme') {
        groupBy = 'custom'
        await setGroupByMode('custom')
      }
      showToast(`Created "${title.trim()}"`)
      render()
    })()
  })

  els.parkOthers.addEventListener('click', async () => {
    const [current] = await chrome.tabs.query({ active: true, currentWindow: true })
    const keepId = current?.id
    await parkTabs(filteredTabs().filter((t) => t.id !== keepId))
  })

  els.autoDupes.addEventListener('change', async () => {
    autoDupes = els.autoDupes.checked
    await setAutoCloseDuplicates(autoDupes)
    showToast(autoDupes ? 'Auto-close duplicates on' : 'Auto-close duplicates off')
  })

  els.board.addEventListener('click', async (event) => {
    const renameBtn = (event.target as HTMLElement).closest('[data-action="rename-group"]') as HTMLElement | null
    if (renameBtn) {
      const id = renameBtn.dataset.colId
      if (!id) return
      const current = userGroups.find((g) => g.id === id)
      const next = prompt('Rename group', current?.title ?? '')
      if (!next?.trim()) return
      userGroups = await renameUserGroup(id, next)
      showToast('Group renamed')
      render()
      return
    }

    const deleteBtn = (event.target as HTMLElement).closest('[data-action="delete-group"]') as HTMLElement | null
    if (deleteBtn) {
      const id = deleteBtn.dataset.colId
      if (!id) return
      const current = userGroups.find((g) => g.id === id)
      if (!confirm(`Delete group "${current?.title ?? id}"? Domains become ungrouped.`)) return
      userGroups = await deleteUserGroup(id)
      showToast('Group deleted')
      render()
      return
    }

    const target = (event.target as HTMLElement).closest('[data-action="activate"]') as HTMLElement | null
    if (!target) return
    const id = Number(target.dataset.tabId)
    const tab = allTabs.find((t) => t.id === id)
    if (!tab) return
    await chrome.tabs.update(id, { active: true })
    await chrome.windows.update(tab.windowId, { focused: true })
  })

  wireBoardDnD()

  els.parkedList.addEventListener('click', async (event) => {
    const target = (event.target as HTMLElement).closest('[data-action]') as HTMLElement | null
    if (!target) return
    const index = Number(target.dataset.parkedIndex)
    if (Number.isNaN(index)) return
    if (target.dataset.action === 'restore-one') {
      const tab = parkedTabs[index]
      if (!tab) return
      const next = parkedTabs.filter((_, i) => i !== index)
      await setParkedTabs(next)
      await chrome.tabs.create({ url: tab.url, active: true })
      await loadState()
    } else if (target.dataset.action === 'discard-parked') {
      const next = parkedTabs.filter((_, i) => i !== index)
      await setParkedTabs(next)
      parkedTabs = next
      render()
    }
  })

  chrome.tabs.onCreated.addListener(() => void loadState())
  chrome.tabs.onRemoved.addListener(() => void loadState())
  chrome.tabs.onActivated.addListener(() => void loadState())
  chrome.tabs.onUpdated.addListener((_id, info) => {
    if (info.status === 'complete' || info.title || info.url || info.groupId != null) {
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
