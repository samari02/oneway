"use strict";
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
function log(...args) {
    console.log(`[Clarity ${new Date().toISOString()}]`, ...args);
}
// Don't inject on extension pages or chrome:// pages
const EXCLUDED_URLS = [
    'chrome://',
    'chrome-extension://',
    'about:',
    'edge://',
    'moz-extension://',
    'file://'
];
function shouldInject() {
    const url = window.location.href;
    return !EXCLUDED_URLS.some(prefix => url.startsWith(prefix));
}
// Time tracking
let pageLoadTime = Date.now();
let lastStatusCheck = 0;
const STATUS_CHECK_INTERVAL = 30000; // Check status every 30s
/**
 * Create and inject the Aoi widget
 */
function createAoiWidget() {
    // Create container
    const container = document.createElement('div');
    container.id = 'clarity-aoi-widget';
    // Use Shadow DOM to isolate styles
    const shadow = container.attachShadow({ mode: 'closed' });
    // Inject styles
    const styles = document.createElement('style');
    styles.textContent = getWidgetStyles();
    shadow.appendChild(styles);
    // Create widget HTML
    const widget = document.createElement('div');
    widget.className = 'aoi-widget';
    widget.innerHTML = getWidgetHTML();
    shadow.appendChild(widget);
    // Add to page
    document.body.appendChild(container);
    // Setup event listeners
    setupWidgetEvents(shadow);
    // Initial status check
    updateAoiStatus(shadow);
    // Periodic status updates
    setInterval(() => updateAoiStatus(shadow), STATUS_CHECK_INTERVAL);
    // Track time on page
    setInterval(() => updateTimeOnSite(shadow), 60000); // Every minute
    log('Aoi widget injected');
}
/**
 * Widget CSS styles
 */
function getWidgetStyles() {
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
    
    /* Minimize state */
    .aoi-widget.minimized .aoi-bubble {
      width: 32px;
      height: 32px;
    }
    
    .aoi-widget.minimized .aoi-character {
      transform: scale(0.6);
    }
  `;
}
/**
 * Widget HTML structure
 */
function getWidgetHTML() {
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
  `;
}
/**
 * Setup widget event listeners
 */
function setupWidgetEvents(shadow) {
    const bubble = shadow.querySelector('.aoi-bubble');
    if (!bubble)
        return;
    // Click to toggle details or take action
    bubble.addEventListener('click', () => {
        const status = bubble.dataset.status;
        if (status === 'alert') {
            // Open extension popup for alert issues
            chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
        }
        else {
            // Toggle minimized state
            const widget = shadow.querySelector('.aoi-widget');
            widget?.classList.toggle('minimized');
        }
    });
}
/**
 * Update Aoi's status based on current context
 */
async function updateAoiStatus(shadow) {
    try {
        // Get status from service worker
        const response = await chrome.runtime.sendMessage({ type: 'GET_AOI_STATUS' });
        if (!response) {
            setAoiState(shadow, {
                status: 'ok',
                message: 'Protection active ✓',
                siteCategory: 'unknown',
                timeOnSite: Math.floor((Date.now() - pageLoadTime) / 1000),
                isDistraction: false
            });
            return;
        }
        const timeOnSite = Math.floor((Date.now() - pageLoadTime) / 1000);
        const timeMinutes = Math.floor(timeOnSite / 60);
        // Determine status based on response
        let state;
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
            };
        }
        else if (response.isDistraction && timeMinutes >= 10) {
            // Nudge for time on distraction site
            state = {
                status: 'nudge',
                message: `Tu es ici depuis ${timeMinutes} min...`,
                siteCategory: response.siteCategory || 'distraction',
                timeOnSite,
                isDistraction: true
            };
        }
        else if (response.isDistraction) {
            // On distraction but not too long yet
            state = {
                status: 'ok',
                message: 'Je garde un œil 👀',
                siteCategory: response.siteCategory || 'distraction',
                timeOnSite,
                isDistraction: true
            };
        }
        else {
            // All good
            state = {
                status: 'ok',
                message: getRandomOkMessage(),
                siteCategory: response.siteCategory || 'productive',
                timeOnSite,
                isDistraction: false
            };
        }
        setAoiState(shadow, state);
    }
    catch (error) {
        log('Error updating Aoi status:', error);
        // Default to OK state
        setAoiState(shadow, {
            status: 'ok',
            message: 'Tout va bien ✓',
            siteCategory: 'unknown',
            timeOnSite: Math.floor((Date.now() - pageLoadTime) / 1000),
            isDistraction: false
        });
    }
}
/**
 * Update time display
 */
function updateTimeOnSite(shadow) {
    const timeOnSite = Math.floor((Date.now() - pageLoadTime) / 1000);
    const timeMinutes = Math.floor(timeOnSite / 60);
    const badge = shadow.querySelector('.aoi-time-badge');
    if (badge && timeMinutes > 0) {
        badge.textContent = `${timeMinutes}m`;
    }
    // Trigger status update if we've been here a while
    if (timeMinutes > 0 && timeMinutes % 5 === 0) {
        updateAoiStatus(shadow);
    }
}
/**
 * Set Aoi's visual state
 */
function setAoiState(shadow, state) {
    const bubble = shadow.querySelector('.aoi-bubble');
    const face = shadow.querySelector('.aoi-face');
    const message = shadow.querySelector('.aoi-message');
    const badge = shadow.querySelector('.aoi-time-badge');
    if (!bubble || !face || !message)
        return;
    // Update status
    bubble.dataset.status = state.status;
    // Update mood
    const mood = state.status === 'ok' ? 'happy'
        : state.status === 'nudge' ? 'concerned'
            : 'worried';
    face.dataset.mood = mood;
    // Update message
    message.textContent = state.message;
    // Update time badge
    const timeMinutes = Math.floor(state.timeOnSite / 60);
    if (badge && timeMinutes > 0) {
        badge.textContent = `${timeMinutes}m`;
    }
}
/**
 * Random OK messages for variety
 */
function getRandomOkMessage() {
    const messages = [
        'Tout roule ! ✓',
        'Tu es focus 💪',
        'Protection active ✓',
        'Continue comme ça !',
        'Beau travail 🌱',
        'Je veille sur toi ✓'
    ];
    return messages[Math.floor(Math.random() * messages.length)];
}
// Initialize widget when DOM is ready
if (shouldInject()) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createAoiWidget);
    }
    else {
        createAoiWidget();
    }
}
