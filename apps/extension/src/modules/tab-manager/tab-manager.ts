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
  TabGroupColor,
} from './grouping'
import { countDuplicateClosures, pickDuplicateTabIds, refreshTabManagerBadge } from './hygiene'
import {
  addParkedTabs,
  clearUndoParkBatch,
  getAutoCloseDuplicates,
  getGroupByMode,
  getModuleEnabled,
  getOpenAiApiKey,
  getParkedTabs,
  getUndoParkBatch,
  ParkedTab,
  setAutoCloseDuplicates,
  setGroupByMode,
  setModuleEnabled,
  setOpenAiApiKey,
  setParkedTabs,
  setUndoParkBatch,
} from './storage'
import {
  SuggestGroupsError,
  SuggestedGroup,
  suggestGroups,
  tabsToSuggestInput,
} from './suggest-groups'
import {
  applySuggestedUserGroups,
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
let suggestDraft: SuggestedGroup[] = []
let suggestUngrouped: number[] = []
let suggestLoading = false

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
  suggestGroups: document.getElementById('btn-suggest-groups') as HTMLButtonElement,
  clearGroups: document.getElementById('btn-clear-groups') as HTMLButtonElement,
  closeDupes: document.getElementById('btn-close-dupes') as HTMLButtonElement,
  restore: document.getElementById('btn-restore') as HTMLButtonElement,
  undo: document.getElementById('btn-undo') as HTMLButtonElement,
  idleNudge: document.getElementById('idle-nudge') as HTMLElement,
  idleNudgeText: document.getElementById('idle-nudge-text')!,
  autoDupes: document.getElementById('auto-dupes') as HTMLInputElement,
  openaiKey: document.getElementById('openai-key') as HTMLInputElement,
  saveKey: document.getElementById('btn-save-key') as HTMLButtonElement,
  clearKey: document.getElementById('btn-clear-key') as HTMLButtonElement,
  openaiKeyStatus: document.getElementById('openai-key-status')!,
  scopeCurrent: document.getElementById('scope-current') as HTMLButtonElement,
  scopeAll: document.getElementById('scope-all') as HTMLButtonElement,
  toast: document.getElementById('toast')!,
  toastText: document.getElementById('toast-text')!,
  toastUndo: document.getElementById('toast-undo') as HTMLButtonElement,
  dialog: document.getElementById('dialog')!,
  dialogTitle: document.getElementById('dialog-title')!,
  dialogBody: document.getElementById('dialog-body')!,
  dialogInput: document.getElementById('dialog-input') as HTMLInputElement,
  dialogCancel: document.getElementById('dialog-cancel') as HTMLButtonElement,
  dialogOk: document.getElementById('dialog-ok') as HTMLButtonElement,
  suggestDialog: document.getElementById('suggest-dialog')!,
  suggestPreview: document.getElementById('suggest-preview')!,
  suggestCancel: document.getElementById('suggest-cancel') as HTMLButtonElement,
  suggestApply: document.getElementById('suggest-apply') as HTMLButtonElement,
  suggestAlsoChrome: document.getElementById('suggest-also-chrome') as HTMLInputElement,
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

type DialogMode = 'confirm' | 'prompt'

interface DialogOptions {
  title: string
  body: string
  mode?: DialogMode
  defaultValue?: string
  okLabel?: string
  danger?: boolean
}

function openDialog(options: DialogOptions): Promise<string | null> {
  const mode = options.mode ?? 'confirm'
  els.dialogTitle.textContent = options.title
  els.dialogBody.textContent = options.body
  els.dialogOk.textContent = options.okLabel ?? (mode === 'prompt' ? 'Save' : 'OK')
  els.dialogOk.classList.toggle('tm__dialog-btn--danger', Boolean(options.danger))
  els.dialogOk.classList.toggle('tm__dialog-btn--primary', !options.danger)
  els.dialogInput.hidden = mode !== 'prompt'
  els.dialogInput.value = options.defaultValue ?? ''
  els.dialog.hidden = false

  return new Promise((resolve) => {
    const finish = (value: string | null) => {
      els.dialog.hidden = true
      els.dialogCancel.removeEventListener('click', onCancel)
      els.dialogOk.removeEventListener('click', onOk)
      els.dialog.removeEventListener('keydown', onKey)
      els.dialog.removeEventListener('click', onBackdrop)
      resolve(value)
    }
    const onCancel = () => finish(null)
    const onOk = () => {
      if (mode === 'prompt') {
        const value = els.dialogInput.value.trim()
        finish(value ? value : null)
        return
      }
      finish('ok')
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
      if (event.key === 'Enter') onOk()
    }
    const onBackdrop = (event: MouseEvent) => {
      if (event.target === els.dialog) onCancel()
    }
    els.dialogCancel.addEventListener('click', onCancel)
    els.dialogOk.addEventListener('click', onOk)
    els.dialog.addEventListener('keydown', onKey)
    els.dialog.addEventListener('click', onBackdrop)
    if (mode === 'prompt') {
      queueMicrotask(() => {
        els.dialogInput.focus()
        els.dialogInput.select()
      })
    } else {
      queueMicrotask(() => els.dialogOk.focus())
    }
  })
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
  void refreshApiKeyStatus()

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
                <button type="button" class="tm__col-btn" data-action="rename-group" data-col-id="${escapeAttr(col.id)}" aria-label="Rename group">R</button>
                <button type="button" class="tm__col-btn" data-action="delete-group" data-col-id="${escapeAttr(col.id)}" aria-label="Delete group">X</button>
              </div>`
            : `<span class="tm__col-badge">${col.tabIds.length}</span>`

        const emptyClass = col.tabIds.length === 0 ? ' tm__col--empty' : ''
        return `
          <section class="tm__col${col.collapsed ? ' tm__col--collapsed-hint' : ''}${emptyClass}" data-col-id="${escapeAttr(col.id)}" data-drop-col="1">
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

async function refreshApiKeyStatus(): Promise<void> {
  const key = await getOpenAiApiKey()
  els.openaiKeyStatus.textContent = key ? 'Key saved for this browser' : 'No key set'
  if (!els.openaiKey.value) {
    els.openaiKey.placeholder = key ? '•••••••• (saved)' : 'sk-…'
  }
}

const SUGGEST_DROP_UNGROUPED = 'ungrouped'

function closeSuggestDialog(): void {
  els.suggestDialog.hidden = true
  suggestDraft = []
  suggestUngrouped = []
}

function suggestTabRowHtml(
  tab: TabRow,
  from: string,
  opts: { removable: boolean; groupIndex?: number }
): string {
  const host = hostnameOf(tab.url)
  const remove =
    opts.removable && opts.groupIndex != null
      ? `<button type="button" class="tm__suggest-remove" data-suggest-remove="${tab.id}" data-suggest-from="${opts.groupIndex}" title="Move to Ungrouped" aria-label="Move to Ungrouped">×</button>`
      : ''
  return `
    <div class="tm__suggest-tab" draggable="true" data-suggest-tab="${tab.id}" data-suggest-from="${escapeAttr(from)}">
      ${faviconHtml(tab.favIconUrl, host)}
      <span class="tm__suggest-tab-title">${escapeHtml(tab.title)}</span>
      <span class="tm__suggest-tab-host">${escapeHtml(host)}</span>
      ${remove}
    </div>
  `
}

function clearSuggestDropTargets(): void {
  els.suggestPreview.querySelectorAll('.tm__suggest-group.is-drop-target').forEach((el) => {
    el.classList.remove('is-drop-target')
  })
}

/** Move a preview tab into a named group index or Ungrouped. Returns whether state changed. */
function moveSuggestTab(tabId: number, to: string): boolean {
  const fromGroupIdx = suggestDraft.findIndex((g) => g.tabIds.includes(tabId))
  const fromUngrouped = suggestUngrouped.includes(tabId)
  if (fromGroupIdx < 0 && !fromUngrouped) return false

  const fromKey = fromUngrouped ? SUGGEST_DROP_UNGROUPED : String(fromGroupIdx)
  if (fromKey === to) return false

  if (fromUngrouped) {
    suggestUngrouped = suggestUngrouped.filter((id) => id !== tabId)
  } else {
    const g = suggestDraft[fromGroupIdx]
    if (!g) return false
    g.tabIds = g.tabIds.filter((id) => id !== tabId)
  }

  if (to === SUGGEST_DROP_UNGROUPED) {
    if (!suggestUngrouped.includes(tabId)) suggestUngrouped.push(tabId)
  } else {
    const toIdx = Number(to)
    if (!Number.isFinite(toIdx) || !suggestDraft[toIdx]) {
      // Restore if destination vanished
      if (fromUngrouped) suggestUngrouped.push(tabId)
      else suggestDraft[fromGroupIdx]?.tabIds.push(tabId)
      return false
    }
    if (!suggestDraft[toIdx]!.tabIds.includes(tabId)) {
      suggestDraft[toIdx]!.tabIds.push(tabId)
    }
  }

  return true
}

function renderSuggestPreview(): void {
  const byId = new Map(allTabs.map((t) => [t.id, t]))
  const blocks: string[] = []

  suggestDraft.forEach((group, groupIndex) => {
    const rows = group.tabIds
      .map((id) => {
        const tab = byId.get(id)
        if (!tab) return ''
        return suggestTabRowHtml(tab, String(groupIndex), { removable: true, groupIndex })
      })
      .join('')

    blocks.push(`
      <div class="tm__suggest-group" data-suggest-group="${groupIndex}" data-suggest-drop="${groupIndex}">
        <div class="tm__suggest-group-head">
          <input class="tm__suggest-title-input" type="text" value="${escapeAttr(group.title)}" data-suggest-title="${groupIndex}" maxlength="40" aria-label="Rename group" title="Click to rename" />
          <span class="tm__suggest-count">${group.tabIds.length}</span>
        </div>
        <div class="tm__suggest-tabs">${rows || '<div class="tm__suggest-empty">Drop tabs here</div>'}</div>
      </div>
    `)
  })

  // Always show Ungrouped as a drop target while the preview is open
  const ungroupedRows = suggestUngrouped
    .map((id) => {
      const tab = byId.get(id)
      if (!tab) return ''
      return suggestTabRowHtml(tab, SUGGEST_DROP_UNGROUPED, { removable: false })
    })
    .join('')

  blocks.push(`
    <div class="tm__suggest-group tm__suggest-group--ungrouped" data-suggest-drop="${SUGGEST_DROP_UNGROUPED}">
      <div class="tm__suggest-group-head">
        <div class="tm__suggest-title-static">Ungrouped</div>
        <span class="tm__suggest-count">${suggestUngrouped.length}</span>
      </div>
      <div class="tm__suggest-tabs">${ungroupedRows || '<div class="tm__suggest-empty">Drop tabs here</div>'}</div>
    </div>
  `)

  els.suggestPreview.innerHTML = blocks.join('') || '<div class="tm__suggest-empty">No groups proposed</div>'
}

function openSuggestPreview(groups: SuggestedGroup[], ungroupedTabIds: number[]): void {
  suggestDraft = groups.map((g) => ({ title: g.title, tabIds: [...g.tabIds] }))
  suggestUngrouped = [...ungroupedTabIds]
  renderSuggestPreview()
  els.suggestDialog.hidden = false
  queueMicrotask(() => els.suggestApply.focus())
}

function syncSuggestTitlesFromDom(): void {
  els.suggestPreview.querySelectorAll('[data-suggest-title]').forEach((el) => {
    const input = el as HTMLInputElement
    const index = Number(input.dataset.suggestTitle)
    if (!Number.isFinite(index) || !suggestDraft[index]) return
    const next = input.value.trim().slice(0, 40)
    if (next) suggestDraft[index]!.title = next
  })
}

async function ensureApiKey(): Promise<string | null> {
  let key = await getOpenAiApiKey()
  if (key) return key

  const entered = await openDialog({
    title: 'OpenAI API key',
    body: 'Suggest groups needs an OpenAI key. Only tab titles and hostnames are sent — never page content. Key stays in this browser.',
    mode: 'prompt',
    okLabel: 'Save & continue',
  })
  if (!entered) return null
  await setOpenAiApiKey(entered)
  await refreshApiKeyStatus()
  key = await getOpenAiApiKey()
  return key
}

async function runSuggestGroups(): Promise<void> {
  if (suggestLoading) return
  const tabs = scopedTabs().filter((t) => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'))
  if (tabs.length === 0) {
    showToast('No tabs to suggest groups for')
    return
  }

  const key = await ensureApiKey()
  if (!key) return

  const { inputs, truncated } = tabsToSuggestInput(tabs)
  suggestLoading = true
  els.suggestGroups.classList.add('is-loading')
  els.suggestGroups.textContent = 'Suggesting…'
  els.suggestGroups.disabled = true

  try {
    const result = await suggestGroups(inputs, key)
    if (truncated) {
      showToast(`Using first ${inputs.length} tabs`)
    }
    openSuggestPreview(result.groups, result.ungroupedTabIds)
  } catch (err) {
    console.error('[Tab Manager] suggest groups failed', err)
    if (err instanceof SuggestGroupsError && err.code === 'NO_API_KEY') {
      showToast('Add an OpenAI API key first')
    } else if (err instanceof SuggestGroupsError) {
      showToast(err.message)
    } else {
      showToast('Could not suggest groups')
    }
  } finally {
    suggestLoading = false
    els.suggestGroups.classList.remove('is-loading')
    els.suggestGroups.textContent = 'Suggest groups'
    els.suggestGroups.disabled = false
  }
}

async function applySuggestPreview(): Promise<void> {
  syncSuggestTitlesFromDom()
  const draft = suggestDraft.filter((g) => g.title.trim() && g.tabIds.length > 0)
  if (draft.length === 0) {
    showToast('Nothing to apply')
    return
  }

  const tabById = new Map(allTabs.map((t) => [t.id, t]))
  const payload = draft.map((g) => ({
    title: g.title.trim(),
    hosts: g.tabIds
      .map((id) => tabById.get(id))
      .filter((t): t is TabRow => Boolean(t))
      .map((t) => hostnameOf(t.url)),
  }))

  const { groups, rememberedHosts, skippedConflictHosts } = await applySuggestedUserGroups(payload)
  userGroups = groups
  groupBy = 'custom'
  await setGroupByMode('custom')

  const alsoChrome = els.suggestAlsoChrome.checked
  if (alsoChrome) {
    const colors: TabGroupColor[] = ['purple', 'blue', 'orange', 'yellow', 'red', 'green', 'pink', 'cyan']
    const columns = draft.map((g, i) => ({
      id: `suggest_${i}`,
      title: g.title,
      collapsed: false,
      color: colors[i % colors.length]!,
      tabIds: g.tabIds,
      editable: true,
    }))
    const tabs = scopedTabs()
    const windowIds =
      scope === 'all'
        ? [...new Set(tabs.map((t) => t.windowId))]
        : currentWindowId != null
          ? [currentWindowId]
          : []
    try {
      await applyColumnsAsChromeGroups('custom', columns, tabs, windowIds)
    } catch (err) {
      console.error('[Tab Manager] suggest chrome apply failed', err)
      showToast('Custom groups saved; Chrome apply failed')
      closeSuggestDialog()
      render()
      return
    }
  }

  closeSuggestDialog()
  const conflictNote =
    skippedConflictHosts > 0 ? ` · ${skippedConflictHosts} shared hosts skipped` : ''
  showToast(
    alsoChrome
      ? `Applied ${draft.length} groups · ${rememberedHosts} hosts remembered${conflictNote}`
      : `Saved ${draft.length} custom groups · ${rememberedHosts} hosts${conflictNote}`
  )
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
  els.suggestGroups.addEventListener('click', () => void runSuggestGroups())
  els.closeDupes.addEventListener('click', () => void closeDuplicates())
  els.restore.addEventListener('click', () => void restoreAll())
  els.undo.addEventListener('click', () => void undoLastPark())
  els.toastUndo.addEventListener('click', () => void undoLastPark())

  els.saveKey.addEventListener('click', () => {
    void (async () => {
      const value = els.openaiKey.value.trim()
      if (!value) {
        showToast('Enter a key or use Clear')
        return
      }
      await setOpenAiApiKey(value)
      els.openaiKey.value = ''
      await refreshApiKeyStatus()
      showToast('OpenAI key saved')
    })()
  })
  els.clearKey.addEventListener('click', () => {
    void (async () => {
      await setOpenAiApiKey(null)
      els.openaiKey.value = ''
      await refreshApiKeyStatus()
      showToast('OpenAI key cleared')
    })()
  })

  els.suggestCancel.addEventListener('click', () => closeSuggestDialog())
  els.suggestApply.addEventListener('click', () => void applySuggestPreview())
  els.suggestDialog.addEventListener('click', (event) => {
    if (event.target === els.suggestDialog) closeSuggestDialog()
  })
  els.suggestDialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSuggestDialog()
  })
  els.suggestPreview.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest('[data-suggest-remove]') as HTMLElement | null
    if (!btn) return
    const tabId = Number(btn.dataset.suggestRemove)
    if (!Number.isFinite(tabId)) return
    syncSuggestTitlesFromDom()
    if (moveSuggestTab(tabId, SUGGEST_DROP_UNGROUPED)) {
      renderSuggestPreview()
    }
  })
  els.suggestPreview.addEventListener('input', (event) => {
    const input = event.target as HTMLInputElement
    if (!input.dataset.suggestTitle) return
    const index = Number(input.dataset.suggestTitle)
    if (!Number.isFinite(index) || !suggestDraft[index]) return
    const next = input.value.trim().slice(0, 40)
    if (next) suggestDraft[index]!.title = next
  })
  els.suggestPreview.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement
    if (!input.dataset.suggestTitle) return
    const index = Number(input.dataset.suggestTitle)
    if (!Number.isFinite(index) || !suggestDraft[index]) return
    const next = input.value.trim().slice(0, 40)
    if (next) suggestDraft[index]!.title = next
  })

  els.suggestPreview.addEventListener('dragstart', (event) => {
    const row = (event.target as HTMLElement).closest('.tm__suggest-tab') as HTMLElement | null
    if (!row || !row.draggable || !event.dataTransfer) return
    // Don't start a drag from the remove button
    if ((event.target as HTMLElement).closest('[data-suggest-remove]')) {
      event.preventDefault()
      return
    }
    const tabId = row.dataset.suggestTab
    if (!tabId) return
    event.dataTransfer.setData('text/clarity-suggest-tab', tabId)
    event.dataTransfer.effectAllowed = 'move'
    row.classList.add('is-dragging')
  })

  els.suggestPreview.addEventListener('dragend', (event) => {
    const row = (event.target as HTMLElement).closest('.tm__suggest-tab')
    row?.classList.remove('is-dragging')
    clearSuggestDropTargets()
  })

  els.suggestPreview.addEventListener('dragover', (event) => {
    const group = (event.target as HTMLElement).closest('[data-suggest-drop]') as HTMLElement | null
    if (!group) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    clearSuggestDropTargets()
    group.classList.add('is-drop-target')
  })

  els.suggestPreview.addEventListener('dragleave', (event) => {
    const group = (event.target as HTMLElement).closest('[data-suggest-drop]') as HTMLElement | null
    if (!group) return
    const related = event.relatedTarget as Node | null
    if (related && group.contains(related)) return
    group.classList.remove('is-drop-target')
  })

  els.suggestPreview.addEventListener('drop', (event) => {
    const group = (event.target as HTMLElement).closest('[data-suggest-drop]') as HTMLElement | null
    if (!group || !event.dataTransfer) return
    event.preventDefault()
    const tabId = Number(event.dataTransfer.getData('text/clarity-suggest-tab'))
    const to = group.dataset.suggestDrop
    group.classList.remove('is-drop-target')
    if (!Number.isFinite(tabId) || !to) return
    syncSuggestTitlesFromDom()
    if (moveSuggestTab(tabId, to)) {
      renderSuggestPreview()
    }
  })

  els.newGroup.addEventListener('click', () => {
    void (async () => {
      const title = await openDialog({
        title: 'New group',
        body: 'Name this group. Domains you drop here will stick.',
        mode: 'prompt',
        okLabel: 'Create',
      })
      if (!title) return
      userGroups = await createUserGroup(title)
      if (groupBy !== 'custom' && groupBy !== 'theme') {
        groupBy = 'custom'
        await setGroupByMode('custom')
      }
      showToast(`Created "${title}"`)
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
      const next = await openDialog({
        title: 'Rename group',
        body: 'Update the group name.',
        mode: 'prompt',
        defaultValue: current?.title ?? '',
        okLabel: 'Rename',
      })
      if (!next) return
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
      const ok = await openDialog({
        title: 'Delete group?',
        body: `"${current?.title ?? id}" will be removed. Domains become ungrouped.`,
        okLabel: 'Delete',
        danger: true,
      })
      if (!ok) return
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
