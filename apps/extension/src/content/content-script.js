/**
 * Content Script
 * Injected into every page
 */
import { log } from '../shared/utils';
log('Content script loaded on:', window.location.href);
// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    log('Content script received message:', message);
    // Handle any page-specific logic here
    sendResponse({ received: true });
});
// Monitor page interactions (for future analytics)
// TODO: Track time on page, scroll depth, etc.
