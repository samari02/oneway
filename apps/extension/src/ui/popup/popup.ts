/**
 * Popup UI Logic
 */

// Check incognito access
chrome.extension.isAllowedIncognitoAccess().then((allowed) => {
  const warningEl = document.getElementById('incognito-warning')!
  if (!allowed) {
    warningEl.style.display = 'flex'
  }
})

// Setup incognito button
document.getElementById('btn-setup-incognito')?.addEventListener('click', () => {
  // Can't open chrome:// URLs directly, show instructions
  const extensionId = chrome.runtime.id
  alert(`To enable incognito protection:\n\n1. Open chrome://extensions\n2. Find "Clarity - Focus & Flow"\n3. Click "Details"\n4. Enable "Allow in incognito"\n\nYour extension ID: ${extensionId}`)
})

// ============================================================================
// HEIGHTENED MODE STATUS
// ============================================================================

let heightenedTimerInterval: ReturnType<typeof setInterval> | null = null

// Fetch intelligent blocking status
chrome.runtime.sendMessage({ type: 'GET_INTELLIGENT_BLOCKING_STATUS' }, (status) => {
  if (!status) return
  
  const heightenedSection = document.getElementById('heightened-section')!
  const timerEl = document.getElementById('heightened-timer')!
  const blockedEl = document.getElementById('blocked-searches')!
  const warningsEl = document.getElementById('warnings-count')!
  const activationsEl = document.getElementById('activations-count')!
  
  // Update stats
  blockedEl.textContent = status.blockedSearchesToday.toString()
  warningsEl.textContent = status.warningsToday.toString()
  activationsEl.textContent = status.heightenedActivationsToday.toString()
  
  // Show/hide heightened section
  if (status.heightenedMode.active && status.heightenedMode.expiresAt) {
    heightenedSection.classList.add('active')
    
    // Start countdown timer
    updateHeightenedTimer(status.heightenedMode.expiresAt, timerEl)
    heightenedTimerInterval = setInterval(() => {
      updateHeightenedTimer(status.heightenedMode.expiresAt!, timerEl)
    }, 1000)
  } else {
    heightenedSection.classList.remove('active')
  }
})

/**
 * Update the countdown timer display
 */
function updateHeightenedTimer(expiresAt: number, timerEl: HTMLElement): void {
  const now = Date.now()
  const remaining = Math.max(0, expiresAt - now)
  
  if (remaining <= 0) {
    timerEl.textContent = 'Terminé'
    if (heightenedTimerInterval) {
      clearInterval(heightenedTimerInterval)
      heightenedTimerInterval = null
    }
    // Reload popup to refresh state
    setTimeout(() => window.location.reload(), 1000)
    return
  }
  
  const minutes = Math.floor(remaining / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)
  timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// ============================================================================
// PROTECTION TOGGLE + DISABLE FRICTION
// ============================================================================

const DISABLE_CONFIRM_PHRASE = 'DISABLE'
const FRICTION_OPTIONS = [15, 30, 60] as const

let protectionIsActive = false
let frictionTimerId: ReturnType<typeof setTimeout> | null = null
let frictionRemaining = 0
let frictionDuration = 30
let frictionOpen = false

function $(id: string): HTMLElement {
  return document.getElementById(id)!
}

function clearFrictionTimer(): void {
  if (frictionTimerId != null) {
    clearTimeout(frictionTimerId)
    frictionTimerId = null
  }
}

function updateFrictionUi(): void {
  const timerEl = $('friction-timer')
  const barEl = $('friction-progress-bar') as HTMLElement
  const phraseEl = document.getElementById('friction-phrase') as HTMLInputElement
  const confirmBtn = document.getElementById('btn-friction-confirm') as HTMLButtonElement

  const waitDone = frictionRemaining <= 0
  if (waitDone) {
    timerEl.textContent = `Ready — type ${DISABLE_CONFIRM_PHRASE}`
  } else {
    timerEl.textContent = `Wait ${frictionRemaining}s before you can confirm`
  }

  const elapsed = Math.max(0, frictionDuration - frictionRemaining)
  barEl.style.width = `${(elapsed / Math.max(1, frictionDuration)) * 100}%`

  phraseEl.disabled = !waitDone
  if (!waitDone) {
    phraseEl.value = ''
  }

  const phraseOk = phraseEl.value.trim().toUpperCase() === DISABLE_CONFIRM_PHRASE
  confirmBtn.disabled = !(waitDone && phraseOk)
}

function tickFriction(): void {
  if (!frictionOpen) return
  if (frictionRemaining <= 0) {
    clearFrictionTimer()
    updateFrictionUi()
    return
  }
  frictionTimerId = setTimeout(() => {
    frictionRemaining = Math.max(0, frictionRemaining - 1)
    updateFrictionUi()
    tickFriction()
  }, 1000)
}

function openFriction(durationSecs: number): void {
  frictionOpen = true
  frictionDuration = durationSecs
  frictionRemaining = durationSecs
  $('friction-section').classList.add('active')
  const durationSelect = document.getElementById('friction-duration') as HTMLSelectElement
  durationSelect.value = String(durationSecs)
  const phraseEl = document.getElementById('friction-phrase') as HTMLInputElement
  phraseEl.value = ''
  clearFrictionTimer()
  updateFrictionUi()
  tickFriction()
}

function closeFriction(): void {
  frictionOpen = false
  clearFrictionTimer()
  $('friction-section').classList.remove('active')
  const phraseEl = document.getElementById('friction-phrase') as HTMLInputElement
  phraseEl.value = ''
}

function applyStatusToUi(response: { isActive: boolean; mode: string; blocksToday: number }): void {
  protectionIsActive = Boolean(response.isActive)
  const modeEl = $('mode')
  const activeEl = $('active-until')
  const blocksEl = $('blocks-today')
  const toggleBtn = document.getElementById('btn-toggle') as HTMLButtonElement

  const modeIcon = protectionIsActive ? '🟢' : '⚪️'
  const modeName = response.mode.charAt(0).toUpperCase() + response.mode.slice(1)
  modeEl.textContent = `${modeIcon} ${modeName} Mode`
  activeEl.textContent = protectionIsActive ? 'Active' : 'Paused'
  blocksEl.textContent = response.blocksToday.toString()
  toggleBtn.textContent = protectionIsActive ? 'Pause Mode' : 'Resume Mode'
  toggleBtn.disabled = frictionOpen
}

function setActive(isActive: boolean): void {
  chrome.runtime.sendMessage({ type: 'SET_IS_ACTIVE', data: { isActive } }, (response) => {
    if (response) {
      closeFriction()
      applyStatusToUi(response)
    } else {
      window.location.reload()
    }
  })
}

// Get status from background
chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
  if (response) applyStatusToUi(response)
})

chrome.runtime.sendMessage({ type: 'GET_DISABLE_FRICTION_SECS' }, (res) => {
  if (res?.secs && FRICTION_OPTIONS.includes(res.secs)) {
    frictionDuration = res.secs
    const durationSelect = document.getElementById('friction-duration') as HTMLSelectElement | null
    if (durationSelect) durationSelect.value = String(res.secs)
  }
})

document.getElementById('friction-phrase')?.addEventListener('input', () => {
  if (frictionOpen) updateFrictionUi()
})

document.getElementById('friction-duration')?.addEventListener('change', (e) => {
  const secs = Number((e.target as HTMLSelectElement).value)
  if (!FRICTION_OPTIONS.includes(secs as (typeof FRICTION_OPTIONS)[number])) return
  chrome.runtime.sendMessage({ type: 'SET_DISABLE_FRICTION_SECS', data: { secs } })
  if (frictionOpen) {
    openFriction(secs)
  } else {
    frictionDuration = secs
  }
})

document.getElementById('btn-friction-cancel')?.addEventListener('click', () => {
  closeFriction()
  const toggleBtn = document.getElementById('btn-toggle') as HTMLButtonElement
  toggleBtn.disabled = false
})

document.getElementById('btn-friction-confirm')?.addEventListener('click', () => {
  const phraseEl = document.getElementById('friction-phrase') as HTMLInputElement
  if (frictionRemaining > 0) return
  if (phraseEl.value.trim().toUpperCase() !== DISABLE_CONFIRM_PHRASE) return
  setActive(false)
})

// Toggle button — pause requires friction; resume is instant
document.getElementById('btn-toggle')!.addEventListener('click', () => {
  if (frictionOpen) return

  if (!protectionIsActive) {
    setActive(true)
    return
  }

  chrome.runtime.sendMessage({ type: 'GET_DISABLE_FRICTION_SECS' }, (res) => {
    const secs =
      res?.secs && FRICTION_OPTIONS.includes(res.secs) ? res.secs : frictionDuration
    openFriction(secs)
    const toggleBtn = document.getElementById('btn-toggle') as HTMLButtonElement
    toggleBtn.disabled = true
  })
})

// Settings button
document.getElementById('btn-settings')!.addEventListener('click', () => {
  // TODO: Open settings page in main app
  alert('Settings coming soon!')
})

// Check history permission status
chrome.runtime.sendMessage({ type: 'GET_COLLECTION_STATUS' }, (status) => {
  console.log('[Clarity Popup] GET_COLLECTION_STATUS response:', status)
  
  const historySection = document.getElementById('history-section')!
  const insightsSection = document.getElementById('insights-section')!
  
  // Guard: if no response, show the permission request card
  if (!status) {
    console.log('[Clarity Popup] No status received, showing Enable Insights card')
    historySection.style.display = 'block'
    insightsSection.style.display = 'none'
    return
  }
  
  if (status.hasPermission) {
    console.log('[Clarity Popup] Permission granted, showing insights')
    // Show insights section
    historySection.style.display = 'none'
    insightsSection.style.display = 'block'
    
    // Update stats
    document.getElementById('visits-count')!.textContent = status.totalVisits.toString()
    
    // Update last import time
    if (status.lastImport) {
      const date = new Date(status.lastImport)
      const timeStr = date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
      document.getElementById('last-import')!.textContent = `Last import: ${timeStr}`
      
      // Set period select to match last import
      if (status.periodDays) {
        const periodSelect = document.getElementById('period-select') as HTMLSelectElement
        periodSelect.value = status.periodDays.toString()
      }
    }
    
    // Get detailed stats
    chrome.runtime.sendMessage({ type: 'GET_HISTORY_STATS' }, (stats) => {
      if (stats && stats.topDomains && stats.topDomains.length > 0) {
        const topDistraction = stats.topDomains.find((d: any) => 
          ['social_media', 'news', 'video', 'entertainment'].includes(d.category)
        )
        
        if (topDistraction) {
          document.getElementById('top-distraction')!.textContent = topDistraction.domain
        }
      }
    })
  } else {
    console.log('[Clarity Popup] Permission NOT granted, showing Enable Insights card')
    // Show permission request
    historySection.style.display = 'block'
    insightsSection.style.display = 'none'
  }
})

// Enable history button (first time)
document.getElementById('btn-enable-history')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-enable-history') as HTMLButtonElement
  const periodSelect = document.getElementById('period-select-initial') as HTMLSelectElement
  const days = parseInt(periodSelect.value, 10)
  
  btn.textContent = 'Requesting...'
  btn.disabled = true
  
  try {
    // Request permission directly from popup (required by Chrome)
    const granted = await chrome.permissions.request({
      permissions: ['history']
    })
    
    console.log('[Clarity Popup] Permission request result:', granted)
    
    if (granted) {
      // Permission granted - import history
      btn.textContent = `Importing ${days} days...`
      
      chrome.runtime.sendMessage(
        { type: 'IMPORT_HISTORY', data: { days } },
        (result) => {
          console.log('[Clarity Popup] Import result:', result)
          if (result && result.success) {
            // Refresh UI
            window.location.reload()
          } else {
            btn.textContent = 'Error - Try again'
            btn.disabled = false
          }
        }
      )
    } else {
      btn.textContent = 'Permission denied'
      setTimeout(() => {
        btn.textContent = 'Enable Insights'
        btn.disabled = false
      }, 2000)
    }
  } catch (error) {
    console.error('[Clarity Popup] Permission request error:', error)
    btn.textContent = 'Error - Try again'
    btn.disabled = false
  }
})

// Re-import button (when already enabled)
document.getElementById('btn-reimport')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-reimport') as HTMLButtonElement
  const periodSelect = document.getElementById('period-select') as HTMLSelectElement
  const days = parseInt(periodSelect.value, 10)
  
  btn.textContent = `Importing ${days} days...`
  btn.disabled = true
  
  chrome.runtime.sendMessage(
    { type: 'IMPORT_HISTORY', data: { days } },
    (result) => {
      console.log('[Clarity Popup] Re-import result:', result)
      if (result && result.success) {
        btn.textContent = `✓ Imported ${result.visits} visits`
        
        // Update stats
        document.getElementById('visits-count')!.textContent = result.visits.toString()
        document.getElementById('last-import')!.textContent = `Last import: Just now`
        
        // Refresh top distraction
        chrome.runtime.sendMessage({ type: 'GET_HISTORY_STATS' }, (stats) => {
          if (stats && stats.topDomains && stats.topDomains.length > 0) {
            const topDistraction = stats.topDomains.find((d: any) => 
              ['social_media', 'news', 'video', 'entertainment'].includes(d.category)
            )
            if (topDistraction) {
              document.getElementById('top-distraction')!.textContent = topDistraction.domain
            }
          }
        })
        
        setTimeout(() => {
          btn.textContent = 'Re-import History'
          btn.disabled = false
        }, 2000)
      } else {
        btn.textContent = 'Error - Try again'
        btn.disabled = false
      }
    }
  )
})

// Tab Manager module (independent; on/off toggle lives on the manager page)
document.getElementById('btn-tab-manager')?.addEventListener('click', () => {
  const url = chrome.runtime.getURL('tab-manager.html')
  chrome.tabs.create({ url })
  window.close()
})

// Idle hygiene CTA — open manager focused on parking (manager handles park idle)
void (async () => {
  const nudge = document.getElementById('tabs-nudge') as HTMLElement | null
  const nudgeText = document.getElementById('tabs-nudge-text')
  const nudgeBtn = document.getElementById('btn-tabs-nudge')
  if (!nudge || !nudgeText || !nudgeBtn) return

  try {
    const enabled = (await chrome.storage.local.get('tabManager.enabled'))['tabManager.enabled'] !== false
    if (!enabled) return

    const IDLE_MS = 6 * 60 * 60 * 1000
    const win = await chrome.windows.getCurrent()
    const tabs = await chrome.tabs.query({ windowId: win.id })
    const now = Date.now()
    const idle = tabs.filter((t) => {
      if (!t.id || t.pinned || t.url?.includes('tab-manager.html')) return false
      if (!t.url || t.url.startsWith('chrome://') || t.url.startsWith('chrome-extension://')) return false
      const last = t.lastAccessed
      if (last == null) return true
      return now - last > IDLE_MS
    })

    if (idle.length === 0) return

    nudge.style.display = 'flex'
    nudgeText.textContent = `${idle.length} idle tab${idle.length === 1 ? '' : 's'} (6h+) in this window`
    nudgeBtn.textContent = `Review`
    nudgeBtn.addEventListener('click', () => {
      const url = chrome.runtime.getURL('tab-manager.html')
      chrome.tabs.create({ url })
      window.close()
    })
  } catch (err) {
    console.log('[Clarity Popup] Tab hygiene nudge skipped', err)
  }
})()

// Check sync status and show sync section
chrome.runtime.sendMessage({ type: 'GET_SYNC_STATUS' }, (status) => {
  console.log('[Clarity Popup] Sync status:', status)
  
  const syncSection = document.getElementById('sync-section')!
  const syncIcon = document.getElementById('sync-icon')!
  const syncText = document.getElementById('sync-text')!
  const syncBtn = document.getElementById('btn-sync') as HTMLButtonElement
  
  // Only show sync section if history is enabled
  chrome.runtime.sendMessage({ type: 'GET_COLLECTION_STATUS' }, (collectionStatus) => {
    if (collectionStatus?.hasPermission) {
      syncSection.style.display = 'block'
      
      if (status?.isAuthenticated) {
        if (status.pendingCount > 0) {
          syncIcon.textContent = '🔄'
          syncText.textContent = `${status.pendingCount} visits pending sync`
          syncBtn.textContent = 'Sync Now'
        } else {
          syncIcon.textContent = '✅'
          syncText.textContent = 'All synced to cloud'
          syncBtn.textContent = 'Synced'
        }
      } else {
        syncIcon.textContent = '🔐'
        syncText.textContent = 'Sign in to sync to cloud'
        syncBtn.textContent = 'Sign In'
      }
    }
  })
})

// Sync button
document.getElementById('btn-sync')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-sync') as HTMLButtonElement
  const syncIcon = document.getElementById('sync-icon')!
  const syncText = document.getElementById('sync-text')!
  
  // Check if authenticated
  chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' }, async (authStatus) => {
    if (!authStatus?.authenticated) {
      // Not authenticated - prompt for email
      const email = prompt('Enter your email to sync:')
      if (email) {
        btn.textContent = 'Sending link...'
        btn.disabled = true
        
        chrome.runtime.sendMessage({ type: 'SIGN_IN', data: { email } }, (result) => {
          if (result?.error) {
            alert('Error: ' + result.error.message)
            btn.textContent = 'Sign In'
            btn.disabled = false
          } else {
            alert('Check your email for the sign-in link!')
            btn.textContent = 'Check email'
            btn.disabled = false
          }
        })
      }
    } else {
      // Authenticated - sync
      btn.textContent = 'Syncing...'
      btn.disabled = true
      syncIcon.textContent = '🔄'
      
      chrome.runtime.sendMessage({ type: 'SYNC_TO_SUPABASE' }, (result) => {
        console.log('[Clarity Popup] Sync result:', result)
        
        if (result?.success) {
          syncIcon.textContent = '✅'
          syncText.textContent = `Synced ${result.synced} visits`
          btn.textContent = 'Synced!'
        } else {
          syncIcon.textContent = '❌'
          syncText.textContent = 'Sync failed'
          btn.textContent = 'Retry'
        }
        
        btn.disabled = false
      })
    }
  })
})
