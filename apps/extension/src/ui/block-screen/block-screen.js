"use strict";
/**
 * Block Screen UI Logic
 * No bypass: user can only go back (history).
 */
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
const domain = extractDomain(blockedUrl);
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
