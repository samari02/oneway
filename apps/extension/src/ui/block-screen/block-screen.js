"use strict";
/**
 * Block Screen UI Logic
 * No bypass: user can only go back (history).
 */
/** Ensure tab favicon is the packaged Clarity icon (never a blocked site icon). */
function ensureExtensionFavicon() {
    const href = chrome.runtime.getURL('icons/icon-128.png');
    let link = document.querySelector('link[rel="icon"][data-clarity-icon]');
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/png';
        link.dataset.clarityIcon = '1';
        document.head.appendChild(link);
    }
    link.href = href;
}
ensureExtensionFavicon();
const params = new URLSearchParams(window.location.search);
const blockedUrl = params.get('url') || '';
const reason = params.get('reason') || "This site isn't available while you're in Focus Mode";
function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    }
    catch {
        return url;
    }
}
// DNR redirects may not pass the original URL — fall back to a clear label
const domain = extractDomain(blockedUrl) || (params.get('type') === 'content' ? 'Blocked site' : 'this site');
document.getElementById('blocked-domain').textContent = domain;
document.getElementById('reason').textContent = reason;
chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (response) {
        document.querySelector('.block-screen__mode').textContent =
            `You're in ${response.mode.charAt(0).toUpperCase() + response.mode.slice(1)} Mode`;
        document.getElementById('blocks-today').textContent =
            `${response.blocksToday} ${response.blocksToday === 1 ? 'site' : 'sites'} blocked today`;
    }
});
document.getElementById('btn-cancel').addEventListener('click', () => {
    window.history.back();
});
