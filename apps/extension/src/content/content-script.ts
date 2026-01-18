/**
 * Content Script - Aoi Widget
 * 
 * Injects Aoi mascot into every page as a floating companion.
 * Shows protection status, nudges, and coaching messages.
 * 
 * Note: This file must be self-contained (no imports) because
 * Chrome content scripts don't support ES modules.
 */

// Inline log function (can't import in content scripts)
function log(...args: any[]) {
  console.log(`[Clarity ${new Date().toISOString()}]`, ...args)
}

// Widget status types
type AoiStatus = 'ok' | 'nudge' | 'alert'

interface AoiState {
  status: AoiStatus
  message: string
  siteCategory: string
  timeOnSite: number // seconds
  isDistraction: boolean
}

// Don't inject on extension pages or chrome:// pages
const EXCLUDED_URLS = [
  'chrome://',
  'chrome-extension://',
  'about:',
  'edge://',
  'moz-extension://',
  'file://'
]

function shouldInject(): boolean {
  const url = window.location.href
  return !EXCLUDED_URLS.some(prefix => url.startsWith(prefix))
}

// Time tracking
let pageLoadTime = Date.now()
let lastStatusCheck = 0
const STATUS_CHECK_INTERVAL = 30_000 // Check status every 30s

// Hidden state
let isHidden = false
const HIDDEN_DOMAINS_KEY = 'clarity_hidden_domains'
const HIDDEN_GLOBAL_KEY = 'clarity_hidden_global'

/**
 * Get current domain
 */
function getCurrentDomain(): string {
  return window.location.hostname.replace(/^www\./, '')
}

/**
 * Check if widget should be hidden (globally or on this domain)
 */
async function shouldBeHidden(): Promise<{ hidden: boolean; reason: 'global' | 'domain' | null }> {
  try {
    const result = await chrome.storage.local.get([HIDDEN_GLOBAL_KEY, HIDDEN_DOMAINS_KEY])
    
    // Check global hide first
    if (result[HIDDEN_GLOBAL_KEY] === true) {
      return { hidden: true, reason: 'global' }
    }
    
    // Check domain-specific hide
    const hiddenDomains: string[] = result[HIDDEN_DOMAINS_KEY] || []
    const domain = getCurrentDomain()
    if (hiddenDomains.includes(domain)) {
      return { hidden: true, reason: 'domain' }
    }
    
    return { hidden: false, reason: null }
  } catch {
    return { hidden: false, reason: null }
  }
}

/**
 * Set global hidden state
 */
async function setGlobalHidden(hidden: boolean): Promise<void> {
  try {
    await chrome.storage.local.set({ [HIDDEN_GLOBAL_KEY]: hidden })
    log(`Aoi ${hidden ? 'hidden' : 'shown'} globally`)
  } catch (error) {
    log('Error setting global hidden state:', error)
  }
}

/**
 * Toggle hidden state for current domain
 */
async function toggleHiddenOnDomain(hidden: boolean): Promise<void> {
  const domain = getCurrentDomain()
  try {
    const result = await chrome.storage.local.get(HIDDEN_DOMAINS_KEY)
    let hiddenDomains: string[] = result[HIDDEN_DOMAINS_KEY] || []
    
    if (hidden && !hiddenDomains.includes(domain)) {
      hiddenDomains.push(domain)
    } else if (!hidden) {
      hiddenDomains = hiddenDomains.filter(d => d !== domain)
    }
    
    await chrome.storage.local.set({ [HIDDEN_DOMAINS_KEY]: hiddenDomains })
    log(`Aoi ${hidden ? 'hidden' : 'shown'} on ${domain}`)
  } catch (error) {
    log('Error toggling hidden state:', error)
  }
}

/**
 * Create and inject the Aoi widget
 */
async function createAoiWidget(): Promise<void> {
  // Create container
  const container = document.createElement('div')
  container.id = 'clarity-aoi-widget'
  
  // Use Shadow DOM to isolate styles
  const shadow = container.attachShadow({ mode: 'closed' })
  
  // Inject styles
  const styles = document.createElement('style')
  styles.textContent = getWidgetStyles()
  shadow.appendChild(styles)
  
  // Create widget HTML
  const widget = document.createElement('div')
  widget.className = 'aoi-widget'
  widget.innerHTML = getWidgetHTML()
  shadow.appendChild(widget)
  
  // Check if hidden (globally or on this domain)
  const hideStatus = await shouldBeHidden()
  isHidden = hideStatus.hidden
  hiddenReason = hideStatus.reason
  if (isHidden) {
    widget.classList.add('hidden')
    log(`Aoi hidden (${hiddenReason}) on ${getCurrentDomain()}`)
  }
  
  // Add to page
  document.body.appendChild(container)
  
  // Setup event listeners
  setupWidgetEvents(shadow)
  
  // Initial status check (only if visible)
  if (!isHidden) {
    updateAoiStatus(shadow)
  }
  
  // Periodic status updates
  setInterval(() => {
    if (!isHidden) {
      updateAoiStatus(shadow)
    }
  }, STATUS_CHECK_INTERVAL)
  
  // Track time on page
  setInterval(() => {
    if (!isHidden) {
      updateTimeOnSite(shadow)
    }
  }, 60_000) // Every minute
  
  log('Aoi widget injected')
}

/**
 * Widget CSS styles
 */
function getWidgetStyles(): string {
  return `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    .aoi-widget {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647; /* Max z-index */
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    /* Main bubble */
    .aoi-bubble {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #e8f5f2 0%, #d4f0ea 50%, #e8dff5 100%);
      box-shadow: 0 4px 20px rgba(125, 216, 196, 0.3), 0 2px 8px rgba(0, 0, 0, 0.1);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: visible;
    }
    
    .aoi-bubble:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 24px rgba(125, 216, 196, 0.4), 0 3px 10px rgba(0, 0, 0, 0.15);
    }
    
    /* Status ring */
    .aoi-bubble::before {
      content: '';
      position: absolute;
      inset: -3px;
      border-radius: 50%;
      border: 2px solid var(--status-color, #7dd8c4);
      opacity: 0.8;
      transition: all 0.3s ease;
    }
    
    .aoi-bubble[data-status="ok"]::before {
      --status-color: #7dd8c4;
    }
    
    .aoi-bubble[data-status="nudge"]::before {
      --status-color: #f59e0b;
      animation: nudgePulse 2s ease-in-out infinite;
    }
    
    .aoi-bubble[data-status="alert"]::before {
      --status-color: #ef4444;
      animation: alertPulse 1s ease-in-out infinite;
    }
    
    @keyframes nudgePulse {
      0%, 100% { opacity: 0.6; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.05); }
    }
    
    @keyframes alertPulse {
      0%, 100% { opacity: 0.8; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.1); }
    }
    
    /* Aoi character */
    .aoi-character {
      width: 40px;
      height: 44px;
      position: relative;
    }
    
    /* Body (blob) */
    .aoi-body {
      width: 36px;
      height: 36px;
      background: linear-gradient(180deg, #c4b5fd 0%, #a78bfa 100%);
      border-radius: 50% 50% 45% 45%;
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      animation: aoiFloat 3s ease-in-out infinite;
    }
    
    @keyframes aoiFloat {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(-2px); }
    }
    
    /* Face */
    .aoi-face {
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      width: 24px;
      height: 16px;
    }
    
    /* Eyes */
    .aoi-eyes {
      display: flex;
      justify-content: space-between;
      width: 16px;
      margin: 0 auto;
    }
    
    .aoi-eye {
      width: 4px;
      height: 4px;
      background: #1f2937;
      border-radius: 50%;
    }
    
    /* Happy eyes (curved) */
    .aoi-face[data-mood="happy"] .aoi-eye {
      height: 2px;
      border-radius: 2px 2px 0 0;
      transform: translateY(1px);
    }
    
    /* Concerned eyes */
    .aoi-face[data-mood="concerned"] .aoi-eye {
      height: 5px;
      border-radius: 50%;
    }
    
    /* Worried eyes */
    .aoi-face[data-mood="worried"] .aoi-eye {
      height: 5px;
      border-radius: 50%;
      animation: worriedBlink 3s ease-in-out infinite;
    }
    
    @keyframes worriedBlink {
      0%, 90%, 100% { transform: scaleY(1); }
      95% { transform: scaleY(0.1); }
    }
    
    /* Cheeks */
    .aoi-cheeks {
      display: flex;
      justify-content: space-between;
      width: 28px;
      margin: 4px auto 0;
    }
    
    .aoi-cheek {
      width: 6px;
      height: 4px;
      background: rgba(251, 191, 193, 0.6);
      border-radius: 50%;
    }
    
    /* Sprout */
    .aoi-sprout {
      position: absolute;
      top: -6px;
      left: 50%;
      transform: translateX(-50%);
      width: 8px;
      height: 10px;
    }
    
    .aoi-sprout::before {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 2px;
      height: 6px;
      background: #6ee7b7;
    }
    
    .aoi-sprout::after {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 8px;
      height: 6px;
      background: #6ee7b7;
      border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
    }
    
    /* Legs */
    .aoi-legs {
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 6px;
    }
    
    .aoi-leg {
      width: 6px;
      height: 8px;
      background: #a78bfa;
      border-radius: 0 0 4px 4px;
      animation: legWiggle 1s ease-in-out infinite;
    }
    
    .aoi-leg:nth-child(2) {
      animation-delay: 0.2s;
    }
    
    @keyframes legWiggle {
      0%, 100% { transform: rotate(-2deg); }
      50% { transform: rotate(2deg); }
    }
    
    /* Message bubble */
    .aoi-message {
      position: absolute;
      bottom: calc(100% + 12px);
      right: 0;
      background: white;
      padding: 10px 14px;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      font-size: 13px;
      color: #374151;
      white-space: nowrap;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.2s ease;
      pointer-events: none;
      max-width: 200px;
      white-space: normal;
      text-align: center;
      line-height: 1.4;
    }
    
    .aoi-message::after {
      content: '';
      position: absolute;
      bottom: -6px;
      right: 20px;
      width: 12px;
      height: 12px;
      background: white;
      transform: rotate(45deg);
      box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.05);
    }
    
    .aoi-bubble:hover .aoi-message {
      opacity: 1;
      transform: translateY(0);
    }
    
    /* Status-specific message styling */
    .aoi-bubble[data-status="nudge"] .aoi-message {
      background: #fffbeb;
      border: 1px solid #fcd34d;
    }
    
    .aoi-bubble[data-status="nudge"] .aoi-message::after {
      background: #fffbeb;
      border-right: 1px solid #fcd34d;
      border-bottom: 1px solid #fcd34d;
    }
    
    .aoi-bubble[data-status="alert"] .aoi-message {
      background: #fef2f2;
      border: 1px solid #fca5a5;
    }
    
    .aoi-bubble[data-status="alert"] .aoi-message::after {
      background: #fef2f2;
      border-right: 1px solid #fca5a5;
      border-bottom: 1px solid #fca5a5;
    }
    
    /* Time badge */
    .aoi-time-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #6b7280;
      color: white;
      font-size: 9px;
      font-weight: 600;
      padding: 2px 5px;
      border-radius: 8px;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    
    .aoi-bubble:hover .aoi-time-badge {
      opacity: 1;
    }
    
    .aoi-bubble[data-status="nudge"] .aoi-time-badge {
      background: #f59e0b;
    }
    
    /* Options menu */
    .aoi-menu {
      position: absolute;
      bottom: calc(100% + 8px);
      right: 0;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      padding: 6px 0;
      min-width: 140px;
      opacity: 0;
      transform: translateY(8px) scale(0.95);
      pointer-events: none;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 10;
    }
    
    .aoi-menu.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }
    
    .aoi-menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      font-size: 13px;
      color: #374151;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    
    .aoi-menu-item:hover {
      background: #f3f4f6;
    }
    
    .aoi-menu-item-icon {
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }
    
    .aoi-menu-item--hide-global:hover,
    .aoi-menu-item--hide-domain:hover {
      background: #fef2f2;
      color: #dc2626;
    }
    
    .aoi-menu-divider {
      height: 1px;
      background: #e5e7eb;
      margin: 4px 0;
    }
    
    /* Arrow on menu */
    .aoi-menu::after {
      content: '';
      position: absolute;
      bottom: -6px;
      right: 18px;
      width: 12px;
      height: 12px;
      background: white;
      transform: rotate(45deg);
      box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.05);
    }
    
    /* Minimize state */
    .aoi-widget.minimized .aoi-bubble {
      width: 32px;
      height: 32px;
    }
    
    .aoi-widget.minimized .aoi-character {
      transform: scale(0.6);
    }
    
    /* Hidden state */
    .aoi-widget.hidden .aoi-bubble {
      opacity: 0;
      transform: scale(0.3);
      pointer-events: none;
    }
    
    .aoi-widget.hidden .aoi-restore {
      opacity: 0.4;
      pointer-events: auto;
    }
    
    .aoi-widget.hidden .aoi-restore:hover {
      opacity: 1;
    }
    
    /* Restore button (visible when hidden) */
    .aoi-restore {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, #e8f5f2 0%, #d4f0ea 100%);
      border: 1px solid rgba(125, 216, 196, 0.5);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      opacity: 0;
      pointer-events: none;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .aoi-restore:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(125, 216, 196, 0.3);
    }
    
    .aoi-restore-icon {
      width: 14px;
      height: 14px;
      background: linear-gradient(180deg, #c4b5fd 0%, #a78bfa 100%);
      border-radius: 50%;
      position: relative;
    }
    
    /* Mini sprout on restore button */
    .aoi-restore-icon::before {
      content: '';
      position: absolute;
      top: -3px;
      left: 50%;
      transform: translateX(-50%);
      width: 4px;
      height: 5px;
      background: #6ee7b7;
      border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
    }
  `
}

/**
 * Widget HTML structure
 */
function getWidgetHTML(): string {
  return `
    <div class="aoi-bubble" data-status="ok">
      <div class="aoi-character">
        <div class="aoi-sprout"></div>
        <div class="aoi-body">
          <div class="aoi-face" data-mood="happy">
            <div class="aoi-eyes">
              <div class="aoi-eye"></div>
              <div class="aoi-eye"></div>
            </div>
            <div class="aoi-cheeks">
              <div class="aoi-cheek"></div>
              <div class="aoi-cheek"></div>
            </div>
          </div>
        </div>
        <div class="aoi-legs">
          <div class="aoi-leg"></div>
          <div class="aoi-leg"></div>
        </div>
      </div>
      <div class="aoi-message">Protection active ✓</div>
      <div class="aoi-time-badge"></div>
    </div>
    <div class="aoi-menu">
      <div class="aoi-menu-item aoi-menu-item--hide-global" data-action="hide-global">
        <span class="aoi-menu-item-icon">🌐</span>
        <span>Hide everywhere</span>
      </div>
      <div class="aoi-menu-item aoi-menu-item--hide-domain" data-action="hide-domain">
        <span class="aoi-menu-item-icon">📍</span>
        <span>Hide on this site</span>
      </div>
    </div>
    <div class="aoi-restore" title="Show Aoi">
      <div class="aoi-restore-icon"></div>
    </div>
  `
}

// Track why Aoi is hidden (to know what to undo on restore)
let hiddenReason: 'global' | 'domain' | null = null

/**
 * Setup widget event listeners
 */
function setupWidgetEvents(shadow: ShadowRoot): void {
  const widget = shadow.querySelector('.aoi-widget') as HTMLElement
  const bubble = shadow.querySelector('.aoi-bubble') as HTMLElement
  const menu = shadow.querySelector('.aoi-menu') as HTMLElement
  const restore = shadow.querySelector('.aoi-restore') as HTMLElement
  const hideGlobalItem = shadow.querySelector('.aoi-menu-item--hide-global') as HTMLElement
  const hideDomainItem = shadow.querySelector('.aoi-menu-item--hide-domain') as HTMLElement
  
  if (!bubble || !widget || !restore || !menu) return
  
  let menuOpen = false
  
  // Click on Aoi to toggle menu
  bubble.addEventListener('click', (e) => {
    e.stopPropagation()
    const status = bubble.dataset.status as AoiStatus
    
    if (status === 'alert') {
      // Open extension popup for alert issues
      chrome.runtime.sendMessage({ type: 'OPEN_POPUP' })
    } else {
      // Toggle options menu
      menuOpen = !menuOpen
      menu.classList.toggle('open', menuOpen)
    }
  })
  
  // Click on "Hide everywhere" option
  hideGlobalItem?.addEventListener('click', async (e) => {
    e.stopPropagation()
    menuOpen = false
    menu.classList.remove('open')
    
    // Hide Aoi globally
    isHidden = true
    hiddenReason = 'global'
    widget.classList.add('hidden')
    await setGlobalHidden(true)
  })
  
  // Click on "Hide on this site" option
  hideDomainItem?.addEventListener('click', async (e) => {
    e.stopPropagation()
    menuOpen = false
    menu.classList.remove('open')
    
    // Hide Aoi on this domain only
    isHidden = true
    hiddenReason = 'domain'
    widget.classList.add('hidden')
    await toggleHiddenOnDomain(true)
  })
  
  // Click on restore button to show Aoi again
  restore.addEventListener('click', async () => {
    isHidden = false
    widget.classList.remove('hidden')
    
    // Undo the appropriate hide action
    if (hiddenReason === 'global') {
      await setGlobalHidden(false)
    } else if (hiddenReason === 'domain') {
      await toggleHiddenOnDomain(false)
    }
    hiddenReason = null
  })
  
  // Close menu when clicking outside
  document.addEventListener('click', () => {
    if (menuOpen) {
      menuOpen = false
      menu.classList.remove('open')
    }
  })
}

/**
 * Update Aoi's status based on current context
 */
async function updateAoiStatus(shadow: ShadowRoot): Promise<void> {
  try {
    // Get status from service worker
    const response = await chrome.runtime.sendMessage({ type: 'GET_AOI_STATUS' })
    
    if (!response) {
      setAoiState(shadow, {
        status: 'ok',
        message: 'Protection active ✓',
        siteCategory: 'unknown',
        timeOnSite: Math.floor((Date.now() - pageLoadTime) / 1000),
        isDistraction: false
      })
      return
    }
    
    const timeOnSite = Math.floor((Date.now() - pageLoadTime) / 1000)
    const timeMinutes = Math.floor(timeOnSite / 60)
    
    // Determine status based on response
    let state: AoiState
    
    if (response.alertLevel === 'critical' || response.alertLevel === 'warning') {
      // Protection issue
      state = {
        status: 'alert',
        message: response.alertLevel === 'critical' 
          ? '⚠️ Protection inactive !' 
          : '⚠️ Connexion instable',
        siteCategory: response.siteCategory || 'unknown',
        timeOnSite,
        isDistraction: false
      }
    } else if (response.isDistraction && timeMinutes >= 10) {
      // Nudge for time on distraction site
      state = {
        status: 'nudge',
        message: `Tu es ici depuis ${timeMinutes} min...`,
        siteCategory: response.siteCategory || 'distraction',
        timeOnSite,
        isDistraction: true
      }
    } else if (response.isDistraction) {
      // On distraction but not too long yet
      state = {
        status: 'ok',
        message: 'Je garde un œil 👀',
        siteCategory: response.siteCategory || 'distraction',
        timeOnSite,
        isDistraction: true
      }
    } else {
      // All good
      state = {
        status: 'ok',
        message: getRandomOkMessage(),
        siteCategory: response.siteCategory || 'productive',
        timeOnSite,
        isDistraction: false
      }
    }
    
    setAoiState(shadow, state)
    
  } catch (error) {
    log('Error updating Aoi status:', error)
    // Default to OK state
    setAoiState(shadow, {
      status: 'ok',
      message: 'Tout va bien ✓',
      siteCategory: 'unknown',
      timeOnSite: Math.floor((Date.now() - pageLoadTime) / 1000),
      isDistraction: false
    })
  }
}

/**
 * Update time display
 */
function updateTimeOnSite(shadow: ShadowRoot): void {
  const timeOnSite = Math.floor((Date.now() - pageLoadTime) / 1000)
  const timeMinutes = Math.floor(timeOnSite / 60)
  
  const badge = shadow.querySelector('.aoi-time-badge') as HTMLElement
  if (badge && timeMinutes > 0) {
    badge.textContent = `${timeMinutes}m`
  }
  
  // Trigger status update if we've been here a while
  if (timeMinutes > 0 && timeMinutes % 5 === 0) {
    updateAoiStatus(shadow)
  }
}

/**
 * Set Aoi's visual state
 */
function setAoiState(shadow: ShadowRoot, state: AoiState): void {
  const bubble = shadow.querySelector('.aoi-bubble') as HTMLElement
  const face = shadow.querySelector('.aoi-face') as HTMLElement
  const message = shadow.querySelector('.aoi-message') as HTMLElement
  const badge = shadow.querySelector('.aoi-time-badge') as HTMLElement
  
  if (!bubble || !face || !message) return
  
  // Update status
  bubble.dataset.status = state.status
  
  // Update mood
  const mood = state.status === 'ok' ? 'happy' 
    : state.status === 'nudge' ? 'concerned' 
    : 'worried'
  face.dataset.mood = mood
  
  // Update message
  message.textContent = state.message
  
  // Update time badge
  const timeMinutes = Math.floor(state.timeOnSite / 60)
  if (badge && timeMinutes > 0) {
    badge.textContent = `${timeMinutes}m`
  }
}

/**
 * Random OK messages for variety
 */
function getRandomOkMessage(): string {
  const messages = [
    'Tout roule ! ✓',
    'Tu es focus 💪',
    'Protection active ✓',
    'Continue comme ça !',
    'Beau travail 🌱',
    'Je veille sur toi ✓'
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

// Initialize widget when DOM is ready
if (shouldInject()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createAoiWidget)
  } else {
    createAoiWidget()
  }
}
