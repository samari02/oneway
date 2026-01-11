/**
 * Native Messaging Module
 * 
 * Handles communication between the Chrome extension and the Clarity Desktop App.
 * Uses Chrome's Native Messaging API for secure, local communication.
 */

import { log } from '../shared/utils'
import type { CategorizedVisit, BlockEvent } from '../shared/types'

// Native host identifier (must match the manifest)
const HOST_NAME = 'com.clarity.app'

// Connection state
let port: chrome.runtime.Port | null = null
let isConnected = false
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY = 5000

// Message types
export type MessageToDesktop = 
  | { type: 'GET_AUTH_STATUS' }
  | { type: 'GET_CONFIG' }
  | { type: 'NAVIGATION_EVENT'; data: CategorizedVisit }
  | { type: 'BLOCK_EVENT'; data: BlockEvent }
  | { type: 'HISTORY_SYNC'; data: { visits: CategorizedVisit[] } }
  | { type: 'PING' }

export type MessageFromDesktop =
  | { type: 'AUTH_STATUS'; data: { authenticated: boolean; user: { id: string; email: string } | null } }
  | { type: 'CONFIG_UPDATE'; data: { mode: string; rules: any[]; isActive: boolean } }
  | { type: 'SYNC_REQUEST'; data: { since: number } }
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
      
      port = null
      isConnected = false
      
      // Update storage
      chrome.storage.local.set({ desktopAppConnected: false })
      
      // Attempt reconnection if we haven't exceeded max attempts
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++
        log(`Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${RECONNECT_DELAY}ms`)
        setTimeout(connectToDesktopApp, RECONNECT_DELAY)
      } else {
        log('Max reconnect attempts reached, desktop app not available')
      }
    })
    
    // Connection successful
    isConnected = true
    reconnectAttempts = 0
    
    // Update storage
    chrome.storage.local.set({ desktopAppConnected: true })
    
    // Request initial status
    sendToDesktop({ type: 'PING' })
    sendToDesktop({ type: 'GET_AUTH_STATUS' })
    sendToDesktop({ type: 'GET_CONFIG' })
    
    log('Connected to desktop app')
    return true
    
  } catch (error) {
    log('Failed to connect to desktop app:', error)
    isConnected = false
    chrome.storage.local.set({ desktopAppConnected: false })
    return false
  }
}

/**
 * Disconnect from Desktop App
 */
export function disconnectFromDesktopApp() {
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
 * Handle sync request from desktop
 */
async function handleSyncRequest(data: { since: number }) {
  log('Sync request from desktop, since:', new Date(data.since).toISOString())
  
  const { navigationHistory = [] } = await chrome.storage.local.get('navigationHistory')
  
  // Filter visits since the requested timestamp
  const visitsToSync = (navigationHistory as CategorizedVisit[]).filter(
    visit => visit.visitTime > data.since
  )
  
  // Send to desktop
  sendToDesktop({
    type: 'HISTORY_SYNC',
    data: { visits: visitsToSync }
  })
  
  log(`Sent ${visitsToSync.length} visits to desktop`)
}

/**
 * Send a navigation event to desktop (called when user visits a page)
 */
export function sendNavigationEvent(visit: CategorizedVisit) {
  if (isConnected) {
    sendToDesktop({
      type: 'NAVIGATION_EVENT',
      data: visit
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
