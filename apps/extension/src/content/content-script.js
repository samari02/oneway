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
// Hidden state (binary: full widget visible vs fully hidden — no minimize mode)
let isHidden = false;
const HIDDEN_DOMAINS_KEY = 'clarity_hidden_domains';
const HIDDEN_GLOBAL_KEY = 'clarity_hidden_global';
let shadowRootRef = null;
let aoiHostContainer = null;
/**
 * Get current domain
 */
function getCurrentDomain() {
    return window.location.hostname.replace(/^www\./, '');
}
/**
 * Check if widget should be hidden (globally or on this domain)
 */
async function shouldBeHidden() {
    try {
        const result = await chrome.storage.local.get([HIDDEN_GLOBAL_KEY, HIDDEN_DOMAINS_KEY]);
        // Check global hide first
        if (result[HIDDEN_GLOBAL_KEY] === true) {
            return { hidden: true, reason: 'global' };
        }
        // Check domain-specific hide
        const hiddenDomains = result[HIDDEN_DOMAINS_KEY] || [];
        const domain = getCurrentDomain();
        if (hiddenDomains.includes(domain)) {
            return { hidden: true, reason: 'domain' };
        }
        return { hidden: false, reason: null };
    }
    catch {
        return { hidden: false, reason: null };
    }
}
/**
 * Set global hidden state
 */
async function setGlobalHidden(hidden) {
    try {
        await chrome.storage.local.set({ [HIDDEN_GLOBAL_KEY]: hidden });
        log(`Aoi ${hidden ? 'hidden' : 'shown'} globally`);
        // Sync to desktop/Supabase
        await syncPreferencesToDesktop();
    }
    catch (error) {
        log('Error setting global hidden state:', error);
    }
}
/**
 * Toggle hidden state for current domain
 */
async function toggleHiddenOnDomain(hidden) {
    const domain = getCurrentDomain();
    try {
        const result = await chrome.storage.local.get(HIDDEN_DOMAINS_KEY);
        let hiddenDomains = result[HIDDEN_DOMAINS_KEY] || [];
        if (hidden && !hiddenDomains.includes(domain)) {
            hiddenDomains.push(domain);
        }
        else if (!hidden) {
            hiddenDomains = hiddenDomains.filter(d => d !== domain);
        }
        await chrome.storage.local.set({ [HIDDEN_DOMAINS_KEY]: hiddenDomains });
        log(`Aoi ${hidden ? 'hidden' : 'shown'} on ${domain}`);
        // Sync to desktop/Supabase
        await syncPreferencesToDesktop();
    }
    catch (error) {
        log('Error toggling hidden state:', error);
    }
}
/**
 * Sync current preferences to desktop app (for Supabase persistence)
 */
async function syncPreferencesToDesktop() {
    try {
        const result = await chrome.storage.local.get([HIDDEN_GLOBAL_KEY, HIDDEN_DOMAINS_KEY]);
        const preferences = {
            hiddenGlobal: result[HIDDEN_GLOBAL_KEY] || false,
            hiddenDomains: result[HIDDEN_DOMAINS_KEY] || []
        };
        // Send to service worker → desktop app → Supabase
        chrome.runtime.sendMessage({
            type: 'AOI_PREFERENCES_UPDATE',
            data: preferences
        });
    }
    catch (error) {
        log('Error syncing preferences to desktop:', error);
    }
}
/**
 * Create and inject the Aoi widget
 */
function setHostVisibility(hidden) {
    isHidden = hidden;
    if (aoiHostContainer) {
        aoiHostContainer.style.display = hidden ? 'none' : '';
    }
    if (!hidden && shadowRootRef) {
        updateAoiStatus(shadowRootRef);
    }
}
async function createAoiWidget() {
    // Create container
    const container = document.createElement('div');
    container.id = 'clarity-aoi-widget';
    aoiHostContainer = container;
    shadowRootRef = null;
    // Use Shadow DOM to isolate styles
    const shadow = container.attachShadow({ mode: 'closed' });
    shadowRootRef = shadow;
    // Inject styles
    const styles = document.createElement('style');
    styles.textContent = getWidgetStyles();
    shadow.appendChild(styles);
    // Create widget HTML
    const widget = document.createElement('div');
    widget.className = 'aoi-widget';
    widget.innerHTML = getWidgetHTML();
    shadow.appendChild(widget);
    // Check if hidden (globally or on this domain) — entire host node hidden (no in-page restore chip)
    const hideStatus = await shouldBeHidden();
    if (hideStatus.hidden) {
        log(`Aoi hidden (${hideStatus.reason}) on ${getCurrentDomain()}`);
    }
    setHostVisibility(hideStatus.hidden);
    // Add to page
    document.body.appendChild(container);
    // Sync when extension storage changes (e.g. Clarity Settings or other tabs)
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local')
            return;
        if (!changes[HIDDEN_GLOBAL_KEY] && !changes[HIDDEN_DOMAINS_KEY])
            return;
        void (async () => {
            const next = await shouldBeHidden();
            setHostVisibility(next.hidden);
        })();
    });
    // Setup event listeners
    setupWidgetEvents(shadow);
    // Initial status check (only if visible)
    if (!isHidden) {
        updateAoiStatus(shadow);
    }
    // Periodic status updates
    setInterval(() => {
        if (!isHidden) {
            updateAoiStatus(shadow);
        }
    }, STATUS_CHECK_INTERVAL);
    // Track time on page
    setInterval(() => {
        if (!isHidden) {
            updateTimeOnSite(shadow);
        }
    }, 60000); // Every minute
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
    
    /* Options menu */
    .aoi-menu {
      position: absolute;
      bottom: calc(100% + 8px);
      right: 0;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      padding: 6px 0;
      min-width: 180px;
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
    
    .aoi-menu-item--analysis:hover {
      background: #ecfdf5;
      color: #059669;
    }
    
    /* Analysis Panel */
    .aoi-analysis-panel {
      position: absolute;
      bottom: calc(100% + 12px);
      right: 0;
      background: white;
      border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
      padding: 16px;
      width: 340px;
      opacity: 0;
      transform: translateY(8px) scale(0.95);
      pointer-events: none;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 11;
      font-size: 12px;
      max-height: 520px;
      overflow-y: auto;
    }
    
    .aoi-analysis-panel.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }
    
    .aoi-analysis-panel::after {
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
    
    .aoi-analysis-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .aoi-analysis-title {
      font-weight: 600;
      font-size: 13px;
      color: #1f2937;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .aoi-analysis-close {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      border: none;
      background: #f3f4f6;
      color: #6b7280;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: all 0.15s ease;
    }
    
    .aoi-analysis-close:hover {
      background: #e5e7eb;
      color: #374151;
    }
    
    .aoi-analysis-score {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
      border-radius: 10px;
      margin-bottom: 12px;
    }
    
    .aoi-analysis-score.warning {
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
    }
    
    .aoi-analysis-score.danger {
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
    }
    
    .aoi-score-value {
      font-size: 28px;
      font-weight: 700;
      color: #059669;
      line-height: 1;
    }
    
    .aoi-analysis-score.warning .aoi-score-value {
      color: #d97706;
    }
    
    .aoi-analysis-score.danger .aoi-score-value {
      color: #dc2626;
    }
    
    .aoi-score-details { flex: 1; }
    
    .aoi-score-label {
      font-size: 11px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    
    .aoi-score-action {
      font-size: 13px;
      font-weight: 500;
      color: #374151;
    }
    
    .aoi-analysis-section { margin-bottom: 12px; }
    
    .aoi-analysis-section-title {
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    
    .aoi-analysis-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 10px;
      background: #f9fafb;
      border-radius: 8px;
      margin-bottom: 6px;
      font-size: 12px;
    }
    
    .aoi-analysis-item-icon {
      flex-shrink: 0;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .aoi-analysis-item-content { flex: 1; min-width: 0; }
    
    .aoi-analysis-item-label {
      color: #374151;
      font-weight: 500;
      word-break: break-word;
    }
    
    .aoi-analysis-item-value {
      color: #6b7280;
      font-size: 11px;
      margin-top: 2px;
    }
    
    .aoi-analysis-item-score {
      font-weight: 600;
      color: #059669;
      font-size: 12px;
      flex-shrink: 0;
    }
    
    .aoi-analysis-item-score.positive { color: #dc2626; }
    
    .aoi-analysis-empty {
      color: #9ca3af;
      font-style: italic;
      text-align: center;
      padding: 12px;
    }
    
    .aoi-analysis-mode {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 500;
      margin-bottom: 12px;
    }
    
    .aoi-analysis-mode.normal {
      background: #ecfdf5;
      color: #059669;
    }
    
    .aoi-analysis-mode.heightened {
      background: #fef2f2;
      color: #dc2626;
    }
    
    /* Decision badge */
    .aoi-analysis-decision {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 16px;
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      border-radius: 10px;
      margin-bottom: 10px;
      font-weight: 600;
      font-size: 14px;
      color: #059669;
    }
    
    .aoi-analysis-decision.warning {
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
      color: #d97706;
    }
    
    .aoi-analysis-decision.danger {
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
      color: #dc2626;
    }
    
    .aoi-decision-icon { font-size: 16px; }
    
    .aoi-analysis-domain {
      font-size: 11px;
      color: #9ca3af;
      text-align: center;
      margin-bottom: 12px;
      font-family: monospace;
    }
    
    /* Layers */
    .aoi-analysis-layer {
      margin-bottom: 10px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      overflow: hidden;
    }
    
    .aoi-layer-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .aoi-layer-number {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #6b7280;
      color: white;
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .aoi-layer-title {
      flex: 1;
      font-weight: 600;
      font-size: 12px;
      color: #374151;
    }
    
    .aoi-layer-status {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 12px;
      background: #ecfdf5;
      color: #059669;
    }
    
    .aoi-layer-status.warn {
      background: #fffbeb;
      color: #d97706;
    }
    
    .aoi-layer-status.fail {
      background: #fef2f2;
      color: #dc2626;
    }
    
    .aoi-layer-content {
      padding: 8px;
    }
    
    .aoi-analysis-item.pass {
      background: #f0fdf4;
      border-left: 3px solid #22c55e;
    }
    
    .aoi-analysis-item.warn {
      background: #fffbeb;
      border-left: 3px solid #f59e0b;
    }
    
    .aoi-analysis-item.fail {
      background: #fef2f2;
      border-left: 3px solid #ef4444;
    }
    
    .aoi-analysis-item.thresholds {
      background: #f3f4f6;
      border-left: 3px solid #6b7280;
      margin-top: 6px;
    }
    
    /* Stats row */
    .aoi-analysis-stats {
      display: flex;
      justify-content: space-around;
      padding: 10px;
      background: #f9fafb;
      border-radius: 8px;
      margin-top: 10px;
    }
    
    .aoi-stat {
      text-align: center;
    }
    
    .aoi-stat-value {
      display: block;
      font-size: 18px;
      font-weight: 700;
      color: #374151;
    }
    
    .aoi-stat-label {
      font-size: 10px;
      color: #9ca3af;
      text-transform: uppercase;
    }
    
    /* Visibility is toggled on #clarity-aoi-widget (display: none) — no minimize / no in-page restore chip */
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
    <div class="aoi-menu">
      <div class="aoi-menu-item aoi-menu-item--analysis" data-action="show-analysis">
        <span class="aoi-menu-item-icon">🔍</span>
        <span>Show analysis</span>
      </div>
      <div class="aoi-menu-divider"></div>
      <div class="aoi-menu-item aoi-menu-item--hide-domain" data-action="hide-domain">
        <span class="aoi-menu-item-icon">📍</span>
        <span>Hide on this site</span>
      </div>
      <div class="aoi-menu-item aoi-menu-item--hide-global" data-action="hide-global">
        <span class="aoi-menu-item-icon">🌐</span>
        <span>Hide on all sites</span>
      </div>
    </div>
    <div class="aoi-analysis-panel">
      <div class="aoi-analysis-header">
        <div class="aoi-analysis-title">
          <span>🔍</span>
          <span>Blocking Analysis</span>
        </div>
        <button class="aoi-analysis-close">✕</button>
      </div>
      <div class="aoi-analysis-content">
        <div class="aoi-analysis-empty">Loading...</div>
      </div>
    </div>
  `;
}
/**
 * Setup widget event listeners
 */
function setupWidgetEvents(shadow) {
    const widget = shadow.querySelector('.aoi-widget');
    const bubble = shadow.querySelector('.aoi-bubble');
    const menu = shadow.querySelector('.aoi-menu');
    const hideGlobalItem = shadow.querySelector('.aoi-menu-item--hide-global');
    const hideDomainItem = shadow.querySelector('.aoi-menu-item--hide-domain');
    const analysisItem = shadow.querySelector('.aoi-menu-item--analysis');
    const analysisPanel = shadow.querySelector('.aoi-analysis-panel');
    const analysisClose = shadow.querySelector('.aoi-analysis-close');
    if (!bubble || !widget || !menu)
        return;
    let menuOpen = false;
    let analysisPanelOpen = false;
    // Click on Aoi to toggle menu
    bubble.addEventListener('click', (e) => {
        e.stopPropagation();
        const status = bubble.dataset.status;
        if (status === 'alert') {
            // Open extension popup for alert issues
            chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
        }
        else {
            // Close analysis panel if open
            if (analysisPanelOpen) {
                analysisPanelOpen = false;
                analysisPanel?.classList.remove('open');
            }
            // Toggle options menu
            menuOpen = !menuOpen;
            menu.classList.toggle('open', menuOpen);
        }
    });
    // Click on "Show Analysis" option
    analysisItem?.addEventListener('click', async (e) => {
        e.stopPropagation();
        menuOpen = false;
        menu.classList.remove('open');
        // Open analysis panel
        analysisPanelOpen = true;
        analysisPanel?.classList.add('open');
        // Fetch and display analysis data
        await updateAnalysisPanel(shadow);
    });
    // Click on close button in analysis panel
    analysisClose?.addEventListener('click', (e) => {
        e.stopPropagation();
        analysisPanelOpen = false;
        analysisPanel?.classList.remove('open');
    });
    // Click on "Hide everywhere" option — widget removed from page; show again from Clarity Settings
    hideGlobalItem?.addEventListener('click', async (e) => {
        e.stopPropagation();
        menuOpen = false;
        menu.classList.remove('open');
        await setGlobalHidden(true);
        setHostVisibility(true);
    });
    // Click on "Hide on this site" option
    hideDomainItem?.addEventListener('click', async (e) => {
        e.stopPropagation();
        menuOpen = false;
        menu.classList.remove('open');
        await toggleHiddenOnDomain(true);
        setHostVisibility(true);
    });
    // Close menu/panel when clicking outside
    document.addEventListener('click', () => {
        if (menuOpen) {
            menuOpen = false;
            menu.classList.remove('open');
        }
        if (analysisPanelOpen) {
            analysisPanelOpen = false;
            analysisPanel?.classList.remove('open');
        }
    });
    // Prevent clicks inside panel from closing it
    analysisPanel?.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}
/**
 * Fetch and update the analysis panel with current blocking data
 */
async function updateAnalysisPanel(shadow) {
    const contentDiv = shadow.querySelector('.aoi-analysis-content');
    if (!contentDiv)
        return;
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'GET_PAGE_ANALYSIS',
            data: { url: window.location.href, domain: getCurrentDomain() }
        });
        if (!response) {
            contentDiv.innerHTML = renderAnalysisEmpty();
            return;
        }
        contentDiv.innerHTML = renderAnalysisContent(response);
    }
    catch (error) {
        log('Error fetching analysis:', error);
        contentDiv.innerHTML = `<div class="aoi-analysis-empty">Could not load analysis</div>`;
    }
}
function renderAnalysisEmpty() {
    return `
    <div class="aoi-analysis-empty">Loading analysis...</div>
  `;
}
function renderAnalysisContent(data) {
    const { domain, layer1, layer2, layer3, heightenedMode, thresholds, finalDecision, dailyStats } = data;
    // Decision badge
    const decisionClass = finalDecision === 'block' ? 'danger' : finalDecision === 'warn' ? 'warning' : '';
    const decisionText = finalDecision === 'block' ? '✕ BLOCKED' : finalDecision === 'warn' ? '⚠ WARNING' : '✓ ALLOWED';
    const decisionIcon = finalDecision === 'block' ? '🛑' : finalDecision === 'warn' ? '⚠️' : '✅';
    // Mode indicator
    const modeHtml = heightenedMode?.active
        ? `<div class="aoi-analysis-mode heightened">🔥 Heightened Mode (${Math.ceil((heightenedMode.expiresAt - Date.now()) / 60000)}min left)</div>`
        : `<div class="aoi-analysis-mode normal">✓ Normal Mode</div>`;
    // === LAYER 1: Blocklist ===
    const layer1Status = layer1.blocked ? 'fail' : 'pass';
    const layer1Icon = layer1.blocked ? '🚫' : '✓';
    const layer1Html = `
    <div class="aoi-analysis-layer">
      <div class="aoi-layer-header">
        <span class="aoi-layer-number">1</span>
        <span class="aoi-layer-title">Hard Blocklist</span>
        <span class="aoi-layer-status ${layer1Status}">${layer1Icon}</span>
      </div>
      <div class="aoi-layer-content">
        ${layer1.blocked
        ? `<div class="aoi-analysis-item fail">
              <div class="aoi-analysis-item-icon">🚫</div>
              <div class="aoi-analysis-item-content">
                <div class="aoi-analysis-item-label">Domain blocked</div>
                <div class="aoi-analysis-item-value">${escapeHtml(layer1.matchedRule?.pattern || '')}</div>
                <div class="aoi-analysis-item-value">${escapeHtml(layer1.matchedRule?.reason || '')}</div>
              </div>
            </div>`
        : `<div class="aoi-analysis-item pass">
              <div class="aoi-analysis-item-icon">✓</div>
              <div class="aoi-analysis-item-content">
                <div class="aoi-analysis-item-label">Domain not on blocklist</div>
                <div class="aoi-analysis-item-value">${escapeHtml(domain)}</div>
              </div>
            </div>`}
      </div>
    </div>
  `;
    // === LAYER 2: Search Intelligence ===
    const layer2HasActivity = layer2.searchCount > 0;
    const layer2Html = `
    <div class="aoi-analysis-layer">
      <div class="aoi-layer-header">
        <span class="aoi-layer-number">2</span>
        <span class="aoi-layer-title">Search Intelligence</span>
        <span class="aoi-layer-status ${layer2HasActivity && layer2.sessionScore > 20 ? 'warn' : 'pass'}">
          ${layer2.isSearchEngine ? '🔍' : '—'}
        </span>
      </div>
      <div class="aoi-layer-content">
        ${layer2.isSearchEngine
        ? `<div class="aoi-analysis-item">
              <div class="aoi-analysis-item-icon">🔍</div>
              <div class="aoi-analysis-item-content">
                <div class="aoi-analysis-item-label">Search engine detected</div>
              </div>
            </div>`
        : ''}
        ${layer2.lastSearch
        ? `<div class="aoi-analysis-item ${layer2.lastSearch.score > 30 ? 'warn' : ''}">
              <div class="aoi-analysis-item-icon">💬</div>
              <div class="aoi-analysis-item-content">
                <div class="aoi-analysis-item-label">Last search: "${escapeHtml(layer2.lastSearch.query.slice(0, 25))}${layer2.lastSearch.query.length > 25 ? '...' : ''}"</div>
                <div class="aoi-analysis-item-value">
                  Score: ${layer2.lastSearch.score} → ${layer2.lastSearch.action.toUpperCase()}
                  ${layer2.lastSearch.flags && layer2.lastSearch.flags.length > 0 ? `<br>Flags: ${layer2.lastSearch.flags.join(', ')}` : ''}
                </div>
              </div>
              <div class="aoi-analysis-item-score ${layer2.lastSearch.score > 0 ? 'positive' : ''}">${layer2.lastSearch.score}</div>
            </div>`
        : `<div class="aoi-analysis-item">
              <div class="aoi-analysis-item-icon">—</div>
              <div class="aoi-analysis-item-content">
                <div class="aoi-analysis-item-label">No recent searches in session</div>
              </div>
            </div>`}
        ${layer2HasActivity
        ? `<div class="aoi-analysis-item">
              <div class="aoi-analysis-item-icon">Σ</div>
              <div class="aoi-analysis-item-content">
                <div class="aoi-analysis-item-label">Session total (${layer2.searchCount} searches)</div>
              </div>
              <div class="aoi-analysis-item-score ${layer2.sessionScore > 20 ? 'positive' : ''}">${layer2.sessionScore}</div>
            </div>`
        : ''}
      </div>
    </div>
  `;
    // === LAYER 3: Content Analysis ===
    const layer3Status = layer3.isExplicit ? 'fail' : layer3.totalScore >= thresholds.warn ? 'warn' : 'pass';
    const layer3Html = `
    <div class="aoi-analysis-layer">
      <div class="aoi-layer-header">
        <span class="aoi-layer-number">3</span>
        <span class="aoi-layer-title">Content Analysis</span>
        <span class="aoi-layer-status ${layer3Status}">
          ${layer3.totalScore}
        </span>
      </div>
      <div class="aoi-layer-content">
        ${!layer3.analyzed
        ? `<div class="aoi-analysis-item">
              <div class="aoi-analysis-item-icon">⏳</div>
              <div class="aoi-analysis-item-content">
                <div class="aoi-analysis-item-label">Analysis pending or skipped</div>
              </div>
            </div>`
        : layer3.checks.map((check) => `
            <div class="aoi-analysis-item ${check.status}">
              <div class="aoi-analysis-item-icon">${check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✕'}</div>
              <div class="aoi-analysis-item-content">
                <div class="aoi-analysis-item-label">${escapeHtml(check.name)}</div>
                <div class="aoi-analysis-item-value">${escapeHtml(check.detail)}</div>
              </div>
              ${check.score > 0 ? `<div class="aoi-analysis-item-score positive">+${check.score}</div>` : ''}
            </div>
          `).join('')}
        <div class="aoi-analysis-item thresholds">
          <div class="aoi-analysis-item-icon">📊</div>
          <div class="aoi-analysis-item-content">
            <div class="aoi-analysis-item-label">Thresholds</div>
            <div class="aoi-analysis-item-value">Warn: ${thresholds.warn} | Block: ${thresholds.block}</div>
          </div>
        </div>
      </div>
    </div>
  `;
    // === Stats ===
    const statsHtml = dailyStats ? `
    <div class="aoi-analysis-stats">
      <div class="aoi-stat">
        <span class="aoi-stat-value">${dailyStats.blockedSearches || 0}</span>
        <span class="aoi-stat-label">blocked</span>
      </div>
      <div class="aoi-stat">
        <span class="aoi-stat-value">${dailyStats.warnings || 0}</span>
        <span class="aoi-stat-label">warnings</span>
      </div>
      <div class="aoi-stat">
        <span class="aoi-stat-value">${dailyStats.heightenedActivations || 0}</span>
        <span class="aoi-stat-label">heightened</span>
      </div>
    </div>
  ` : '';
    return `
    <div class="aoi-analysis-decision ${decisionClass}">
      <span class="aoi-decision-icon">${decisionIcon}</span>
      <span class="aoi-decision-text">${decisionText}</span>
    </div>
    ${modeHtml}
    <div class="aoi-analysis-domain">${escapeHtml(domain)}</div>
    ${layer1Html}
    ${layer2Html}
    ${layer3Html}
    ${statsHtml}
  `;
}
function escapeHtml(str) {
    if (!str)
        return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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
// ============================================================================
// PAGE CONTENT ANALYSIS — Layer 3
// Analyzes page content for explicit material
// ============================================================================
import { analyzePage, isSPALikely } from './page-analyzer';
import { initGoogleImagesHide } from './google-images-hide';
// ============================================================================
// GOOGLE IMAGES — hide related / "See more" endless-browse UI
// ============================================================================
if (shouldInject()) {
    initGoogleImagesHide();
}
const ANALYSIS_DELAY_MS = 500; // Wait for initial render
const SPA_RECHECK_DELAY_MS = 1500; // Recheck for SPAs
let hasAnalyzed = false;
let pageAnalysisScore = 0;
/**
 * Run page analysis and send results to background
 */
async function runPageAnalysis(isRecheck = false) {
    // Skip if already analyzed with high score (already sent to background)
    if (hasAnalyzed && pageAnalysisScore >= 70 && !isRecheck) {
        return;
    }
    try {
        const result = analyzePage();
        pageAnalysisScore = result.score;
        // Only send to background if score is significant
        if (result.score >= 10 || result.isExplicit) {
            log(`[PageAnalysis] Score: ${result.score}, Explicit: ${result.isExplicit}, Reasons: ${result.reasons.join(', ')}`);
            chrome.runtime.sendMessage({
                type: 'PAGE_ANALYSIS_RESULT',
                data: {
                    url: window.location.href,
                    domain: getCurrentDomain(),
                    result,
                    timestamp: Date.now(),
                    isRecheck
                }
            });
        }
        hasAnalyzed = true;
        // If this was initial analysis and looks like SPA, schedule recheck
        if (!isRecheck && isSPALikely() && result.score < 70) {
            log('[PageAnalysis] SPA detected, scheduling recheck...');
            setTimeout(() => runPageAnalysis(true), SPA_RECHECK_DELAY_MS);
        }
    }
    catch (error) {
        log('[PageAnalysis] Error:', error);
    }
}
// Run analysis when page is ready
if (shouldInject()) {
    // Wait a bit for page to render
    setTimeout(() => {
        runPageAnalysis(false);
    }, ANALYSIS_DELAY_MS);
}
