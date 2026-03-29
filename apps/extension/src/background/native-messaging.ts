/**
 * Native Messaging Module
 * 
 * Handles communication between the Chrome extension and the Clarity Desktop App.
 * Uses Chrome's Native Messaging API for secure, local communication.
 */

import { log } from '../shared/utils'
import type { CategorizedVisit, BlockEvent, ProtectionStatus, AoiPreferences } from '../shared/types'

// Native host identifier (must match the manifest)
const HOST_NAME = 'com.clarity.app'

// Connection state
let port: chrome.runtime.Port | null = null
let isConnected = false
let reconnectAttempts = 0
const RECONNECT_BASE_DELAY_MS = 5000
/** Cap backoff so we keep retrying forever (e.g. after desktop was closed for days). */
const RECONNECT_MAX_DELAY_MS = 5 * 60_000
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null

function clearReconnectSchedule() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }
}

function scheduleReconnect() {
  clearReconnectSchedule()
  const attempt = reconnectAttempts++
  const delay = Math.min(
    RECONNECT_BASE_DELAY_MS * Math.pow(2, Math.min(attempt, 8)),
    RECONNECT_MAX_DELAY_MS
  )
  log(`Reconnect scheduled in ${delay}ms (attempt ${attempt + 1})`)
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null
    connectToDesktopApp()
  }, delay)
}

let lastHeartbeatFailureReconnect = 0
const HEARTBEAT_FAILURE_RECONNECT_COOLDOWN_MS = 120_000

/** When postMessage fails or heartbeat cannot be sent, force a new native port (same effect as reloading the extension). */
function maybeReconnectAfterHeartbeatFailure(reason: string) {
  const now = Date.now()
  if (now - lastHeartbeatFailureReconnect > HEARTBEAT_FAILURE_RECONNECT_COOLDOWN_MS) {
    lastHeartbeatFailureReconnect = now
    log(`Heartbeat native reconnect (${reason})`)
    disconnectFromDesktopApp()
    connectToDesktopApp()
  }
}

// Heartbeat configuration
const HEARTBEAT_INTERVAL_MS = 60_000 // Send heartbeat every 60 seconds
let heartbeatInterval: ReturnType<typeof setInterval> | null = null

/** Poll desktop file for Aoi prefs (e.g. after Clarity Settings saves) */
const AOI_PREFERENCES_POLL_MS = 30_000
let aoiPreferencesPollInterval: ReturnType<typeof setInterval> | null = null

function startAoiPreferencesPolling() {
  if (aoiPreferencesPollInterval) return
  aoiPreferencesPollInterval = setInterval(() => {
    if (port && isConnected) {
      sendToDesktop({ type: 'GET_AOI_PREFERENCES' })
    }
  }, AOI_PREFERENCES_POLL_MS)
}

function stopAoiPreferencesPolling() {
  if (aoiPreferencesPollInterval) {
    clearInterval(aoiPreferencesPollInterval)
    aoiPreferencesPollInterval = null
  }
}

// Message types
export type MessageToDesktop = 
  | { type: 'GET_AUTH_STATUS' }
  | { type: 'GET_CONFIG' }
  | { type: 'NAVIGATION_EVENT'; data: CategorizedVisit }
  | { type: 'BLOCK_EVENT'; data: BlockEvent }
  | { type: 'HISTORY_SYNC'; data: { visits: CategorizedVisit[] } }
  | { type: 'PING' }
  | { type: 'PROTECTION_STATUS'; data: ProtectionStatusPayload }
  | { type: 'HEARTBEAT'; data: HeartbeatPayload }
  | { type: 'AOI_PREFERENCES_UPDATE'; data: AoiPreferences }
  | { type: 'GET_AOI_PREFERENCES' }

// Protection status payload for desktop
export interface ProtectionStatusPayload {
  incognitoEnabled: boolean
  safeSearchEnforced: boolean
  searchFilterActive: boolean
  blockedSearchesToday: number
}

// Heartbeat payload - includes protection status + timestamp
export interface HeartbeatPayload {
  timestamp: number
  incognitoEnabled: boolean
  safeSearchEnforced: boolean
  searchFilterActive: boolean
  blockedSearchesToday: number
  extensionVersion: string
}

export type MessageFromDesktop =
  | { type: 'AUTH_STATUS'; data: { authenticated: boolean; user: { id: string; email: string } | null } }
  | { type: 'CONFIG_UPDATE'; data: { mode: string; rules: any[]; isActive: boolean } }
  | { type: 'SYNC_REQUEST'; data: { since: number } }
  | { type: 'AOI_PREFERENCES'; data: AoiPreferences }
  | { type: 'ACK' }
  | { type: 'PONG' }
  | { type: 'ERROR'; data: { message: string } }

// Callbacks for handling messages from desktop
type MessageHandler = (message: MessageFromDesktop) => void
const messageHandlers: MessageHandler[] = []

/**
 * Register a handler for messages from desktop
 */
export function onMessageFromDesktop(handler: MessageHandler) {
  messageHandlers.push(handler)
  return () => {
    const index = messageHandlers.indexOf(handler)
    if (index > -1) messageHandlers.splice(index, 1)
  }
}

/**
 * Connect to the Desktop App via Native Messaging
 */
export function connectToDesktopApp(): boolean {
  if (port) {
    log('Already connected to desktop app')
    return true
  }

  // Check if nativeMessaging is available
  if (!chrome.runtime.connectNative) {
    log('Native messaging not available')
    return false
  }

  try {
    log('Connecting to desktop app...')
    port = chrome.runtime.connectNative(HOST_NAME)
    
    port.onMessage.addListener((message: MessageFromDesktop) => {
      log('Message from desktop:', message.type)
      handleMessageFromDesktop(message)
    })
    
    port.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError?.message || 'Unknown error'
      log('Disconnected from desktop app:', error)
      // #region agent log
      fetch('http://127.0.0.1:7380/ingest/57142764-769f-4ca9-ac2e-b433ea5b37af',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ead3dc'},body:JSON.stringify({sessionId:'ead3dc',location:'native-messaging.ts:onDisconnect',message:'port_disconnect',data:{error},timestamp:Date.now(),hypothesisId:'H2',runId:'pre-fix'})}).catch(()=>{})
      // #endregion
      
      // Stop heartbeat
      stopHeartbeat()
      stopAoiPreferencesPolling()
      
      port = null
      isConnected = false
      
      // Update storage
      chrome.storage.local.set({ desktopAppConnected: false })
      
      // Keep retrying forever (desktop may be closed for hours/days)
      scheduleReconnect()
    })
    
    // Connection successful
    isConnected = true
    reconnectAttempts = 0
    clearReconnectSchedule()
    
    // Update storage
    chrome.storage.local.set({ desktopAppConnected: true })
    
    // Request initial status
    sendToDesktop({ type: 'PING' })
    sendToDesktop({ type: 'GET_AUTH_STATUS' })
    sendToDesktop({ type: 'GET_CONFIG' })
    sendToDesktop({ type: 'GET_AOI_PREFERENCES' })
    startAoiPreferencesPolling()
    
    // Send protection status to desktop
    sendProtectionStatusToDesktop()
    
    // Start heartbeat system
    startHeartbeat()
    
    log('Connected to desktop app')
    return true
    
  } catch (error) {
    log('Failed to connect to desktop app:', error)
    isConnected = false
    chrome.storage.local.set({ desktopAppConnected: false })
    scheduleReconnect()
    return false
  }
}

/**
 * Disconnect from Desktop App
 */
export function disconnectFromDesktopApp() {
  // Stop heartbeat first
  stopHeartbeat()
  stopAoiPreferencesPolling()
  
  if (port) {
    port.disconnect()
    port = null
    isConnected = false
    chrome.storage.local.set({ desktopAppConnected: false })
    log('Disconnected from desktop app')
  }
}

/**
 * Check if connected to Desktop App
 */
export function isDesktopAppConnected(): boolean {
  return isConnected && port !== null
}

/**
 * Send message to Desktop App
 */
export function sendToDesktop(message: MessageToDesktop): boolean {
  if (!port) {
    log('Cannot send message: not connected to desktop app')
    return false
  }
  
  try {
    port.postMessage(message)
    return true
  } catch (error) {
    log('Error sending message to desktop:', error)
    return false
  }
}

/**
 * Handle incoming messages from Desktop App
 */
function handleMessageFromDesktop(message: MessageFromDesktop) {
  // Notify all registered handlers
  messageHandlers.forEach(handler => {
    try {
      handler(message)
    } catch (error) {
      log('Error in message handler:', error)
    }
  })
  
  // Built-in handling
  switch (message.type) {
    case 'AUTH_STATUS':
      handleAuthStatus(message.data)
      break
      
    case 'CONFIG_UPDATE':
      handleConfigUpdate(message.data)
      break
      
    case 'SYNC_REQUEST':
      handleSyncRequest(message.data)
      break
      
    case 'PONG':
      log('Desktop app is alive')
      break
      
    case 'AOI_PREFERENCES':
      handleAoiPreferences(message.data)
      break
      
    case 'ERROR':
      log('Error from desktop app:', message.data.message)
      break
  }
}

/**
 * Handle auth status from desktop
 */
async function handleAuthStatus(data: { authenticated: boolean; user: { id: string; email: string } | null }) {
  log('Auth status from desktop:', data.authenticated ? 'authenticated' : 'not authenticated')
  
  await chrome.storage.local.set({
    isAuthenticated: data.authenticated,
    user: data.user
  })
}

/**
 * Handle config update from desktop
 */
async function handleConfigUpdate(data: { mode: string; rules: any[]; isActive: boolean }) {
  log('Config update from desktop:', data.mode, data.isActive ? 'active' : 'inactive')
  
  await chrome.storage.local.set({
    mode: data.mode,
    rules: data.rules,
    isActive: data.isActive
  })
}

/**
 * Handle Aoi preferences from desktop
 * Updates local storage with preferences from Supabase
 */
async function handleAoiPreferences(data: AoiPreferences) {
  log('Aoi preferences from desktop:', data)
  
  await chrome.storage.local.set({
    clarity_hidden_global: data.hiddenGlobal,
    clarity_hidden_domains: data.hiddenDomains
  })
  
  log('Aoi preferences synced to local storage')
}

/**
 * Send Aoi preferences update to desktop (for Supabase sync)
 */
export function sendAoiPreferencesUpdate(preferences: AoiPreferences) {
  if (isConnected) {
    sendToDesktop({
      type: 'AOI_PREFERENCES_UPDATE',
      data: preferences
    })
    log('Sent Aoi preferences update to desktop:', preferences)
  } else {
    log('Cannot send Aoi preferences: not connected to desktop')
  }
}

/**
 * Handle sync request from desktop
 */
async function handleSyncRequest(data: { since: number }) {
  log('Sync request from desktop, since:', new Date(data.since).toISOString())
  
  const { navigationHistory = [] } = await chrome.storage.local.get('navigationHistory')
  
  // Filter visits since the requested timestamp
  const visitsToSync = (navigationHistory as CategorizedVisit[]).filter(
    visit => visit.visitTime > data.since
  )
  
  // Send in batches
  await sendHistorySync(visitsToSync)
}

/**
 * Send a navigation event to desktop (called when user visits a page)
 */
export function sendNavigationEvent(visit: CategorizedVisit) {
  if (isConnected) {
    // Sanitize: convert visitTime float to integer (Rust expects i64)
    sendToDesktop({
      type: 'NAVIGATION_EVENT',
      data: {
        ...visit,
        visitTime: Math.floor(visit.visitTime)
      }
    })
  }
}

/**
 * Send a block event to desktop (called when a site is blocked/bypassed)
 */
export function sendBlockEvent(event: BlockEvent) {
  if (isConnected) {
    sendToDesktop({
      type: 'BLOCK_EVENT',
      data: event
    })
  }
}

/**
 * Send history sync to desktop (called after importing history)
 * Chunks the data to avoid Native Messaging's 1MB limit
 */
export async function sendHistorySync(visits: CategorizedVisit[]) {
  if (!isConnected) {
    log('Cannot send history sync: not connected to desktop')
    return
  }
  
  if (visits.length === 0) {
    log('No visits to sync')
    return
  }
  
  // Sanitize: convert visitTime floats to integers (Rust expects i64)
  const sanitizedVisits = visits.map(v => ({
    ...v,
    visitTime: Math.floor(v.visitTime)
  }))
  
  // Native Messaging limit is ~1MB, each visit is ~200-300 bytes
  // Use batch size of 500 to be safe (~150KB per batch)
  const BATCH_SIZE = 500
  const totalBatches = Math.ceil(sanitizedVisits.length / BATCH_SIZE)
  
  log(`Sending ${sanitizedVisits.length} visits to desktop in ${totalBatches} batches`)
  
  for (let i = 0; i < sanitizedVisits.length; i += BATCH_SIZE) {
    const batch = sanitizedVisits.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    
    log(`Sending batch ${batchNum}/${totalBatches} (${batch.length} visits)`)
    
    sendToDesktop({
      type: 'HISTORY_SYNC',
      data: { visits: batch }
    })
    
    // Small delay between batches to avoid overwhelming the receiver
    if (i + BATCH_SIZE < visits.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  log(`History sync complete: ${sanitizedVisits.length} visits sent`)
}

/**
 * Get connection status for UI
 */
export async function getConnectionStatus(): Promise<{
  connected: boolean
  authenticated: boolean
  user: { id: string; email: string } | null
}> {
  const { desktopAppConnected, isAuthenticated, user } = await chrome.storage.local.get([
    'desktopAppConnected',
    'isAuthenticated', 
    'user'
  ])
  
  return {
    connected: desktopAppConnected || false,
    authenticated: isAuthenticated || false,
    user: user || null
  }
}

/**
 * Send protection status to desktop app
 * Called on connection and periodically
 */
export async function sendProtectionStatusToDesktop() {
  if (!isConnected) {
    return
  }
  
  try {
    // Check incognito access
    let incognitoEnabled = false
    try {
      incognitoEnabled = await chrome.extension.isAllowedIncognitoAccess()
    } catch (e) {
      log('Could not check incognito access:', e)
    }
    
    // Get blocked searches count for today
    const today = new Date().toISOString().split('T')[0]
    const key = `blockedSearches_${today}`
    const data = await chrome.storage.local.get(key)
    const blockedSearchesToday = data[key] || 0
    
    const statusPayload: ProtectionStatusPayload = {
      incognitoEnabled,
      safeSearchEnforced: true, // Always true (rules.json enforces it)
      searchFilterActive: true, // Always active
      blockedSearchesToday
    }
    
    sendToDesktop({
      type: 'PROTECTION_STATUS',
      data: statusPayload
    })
    
    log('Sent protection status to desktop:', statusPayload)
  } catch (error) {
    log('Error sending protection status:', error)
  }
}

/**
 * Start the heartbeat system
 * Sends periodic heartbeats to desktop to confirm extension is alive
 */
export function startHeartbeat() {
  // Clear any existing interval
  stopHeartbeat()
  
  log('Starting heartbeat system (interval: ' + HEARTBEAT_INTERVAL_MS + 'ms)')
  
  // Send first heartbeat immediately
  sendHeartbeat()
  
  // Then send periodically
  heartbeatInterval = setInterval(() => {
    sendHeartbeat()
  }, HEARTBEAT_INTERVAL_MS)
}

/**
 * Stop the heartbeat system
 */
export function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
    log('Heartbeat system stopped')
  }
}

/**
 * Send a single heartbeat to desktop
 */
async function sendHeartbeat() {
  // #region agent log
  fetch('http://127.0.0.1:7380/ingest/57142764-769f-4ca9-ac2e-b433ea5b37af',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ead3dc'},body:JSON.stringify({sessionId:'ead3dc',location:'native-messaging.ts:sendHeartbeat',message:'heartbeat_attempt',data:{isConnected,hasPort:port!==null},timestamp:Date.now(),hypothesisId:'H4',runId:'pre-fix'})}).catch(()=>{})
  // #endregion
  if (!isConnected) {
    log('Cannot send heartbeat: not connected')
    // #region agent log
    fetch('http://127.0.0.1:7380/ingest/57142764-769f-4ca9-ac2e-b433ea5b37af',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ead3dc'},body:JSON.stringify({sessionId:'ead3dc',location:'native-messaging.ts:sendHeartbeat',message:'heartbeat_skipped_not_connected',data:{},timestamp:Date.now(),hypothesisId:'H4',runId:'pre-fix'})}).catch(()=>{})
    // #endregion
    return
  }
  
  try {
    // Gather protection status
    let incognitoEnabled = false
    try {
      incognitoEnabled = await chrome.extension.isAllowedIncognitoAccess()
    } catch (e) {
      // Ignore errors
    }
    
    // Get blocked searches count for today
    const today = new Date().toISOString().split('T')[0]
    const key = `blockedSearches_${today}`
    const data = await chrome.storage.local.get(key)
    const blockedSearchesToday = data[key] || 0
    
    // Get extension version from manifest
    const manifest = chrome.runtime.getManifest()
    
    const heartbeatPayload: HeartbeatPayload = {
      timestamp: Date.now(),
      incognitoEnabled,
      safeSearchEnforced: true,
      searchFilterActive: true,
      blockedSearchesToday,
      extensionVersion: manifest.version
    }
    
    const posted = sendToDesktop({
      type: 'HEARTBEAT',
      data: heartbeatPayload
    })
    // #region agent log
    fetch('http://127.0.0.1:7380/ingest/57142764-769f-4ca9-ac2e-b433ea5b37af',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ead3dc'},body:JSON.stringify({sessionId:'ead3dc',location:'native-messaging.ts:sendHeartbeat',message:'heartbeat_post',data:{posted,ts:heartbeatPayload.timestamp},timestamp:Date.now(),hypothesisId:'H1',runId:'post-fix'})}).catch(()=>{})
    // #endregion

    if (!posted) {
      maybeReconnectAfterHeartbeatFailure('post_failed')
    } else {
      log('Heartbeat sent:', new Date().toISOString())
    }
  } catch (error) {
    log('Error sending heartbeat:', error)
    // #region agent log
    fetch('http://127.0.0.1:7380/ingest/57142764-769f-4ca9-ac2e-b433ea5b37af',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ead3dc'},body:JSON.stringify({sessionId:'ead3dc',location:'native-messaging.ts:sendHeartbeat',message:'heartbeat_error',data:{err:String(error)},timestamp:Date.now(),hypothesisId:'H1',runId:'post-fix'})}).catch(()=>{})
    // #endregion
    maybeReconnectAfterHeartbeatFailure('exception')
  }
}

/**
 * After sleep / lock, Chrome may leave a stale Port; connectToDesktopApp() early-returns while heartbeats stop.
 * Reconnect when the OS returns from idle or locked to active (same outcome as reloading the extension).
 */
function setupIdleReconnect() {
  if (typeof chrome === 'undefined' || !chrome.idle?.onStateChanged) return
  let lastIdleState: chrome.idle.IdleState | null = null
  try {
    chrome.idle.setDetectionInterval(60)
  } catch (e) {
    log('idle.setDetectionInterval failed', e)
  }
  chrome.idle.queryState(60, (state) => {
    lastIdleState = state
  })
  chrome.idle.onStateChanged.addListener((newState) => {
    const prev = lastIdleState
    lastIdleState = newState
    if (newState === 'active' && (prev === 'locked' || prev === 'idle')) {
      log('Idle: active after idle/locked; reconnecting desktop native port')
      disconnectFromDesktopApp()
      connectToDesktopApp()
    }
  })
}
setupIdleReconnect()
