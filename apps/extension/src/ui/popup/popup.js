"use strict";
/**
 * Popup UI Logic
 */
// Get status from background
chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (response) {
        const modeEl = document.getElementById('mode');
        const activeEl = document.getElementById('active-until');
        const blocksEl = document.getElementById('blocks-today');
        const toggleBtn = document.getElementById('btn-toggle');
        // Update mode display
        const modeIcon = response.isActive ? '🟢' : '⚪️';
        const modeName = response.mode.charAt(0).toUpperCase() + response.mode.slice(1);
        modeEl.textContent = `${modeIcon} ${modeName} Mode`;
        // Update active status
        activeEl.textContent = response.isActive ? 'Active' : 'Paused';
        // Update blocks count
        blocksEl.textContent = response.blocksToday.toString();
        // Update toggle button
        toggleBtn.textContent = response.isActive ? 'Pause Mode' : 'Resume Mode';
    }
});
// Check history permission status
chrome.runtime.sendMessage({ type: 'GET_COLLECTION_STATUS' }, (status) => {
    console.log('[Clarity Popup] GET_COLLECTION_STATUS response:', status);
    console.log('[Clarity Popup] chrome.runtime.lastError:', chrome.runtime.lastError);
    const historySection = document.getElementById('history-section');
    const historyStats = document.getElementById('history-stats');
    // Guard: if no response, show the permission request card
    if (!status) {
        console.log('[Clarity Popup] No status received, showing Enable Insights card');
        historySection.style.display = 'block';
        historyStats.style.display = 'none';
        return;
    }
    if (status.hasPermission) {
        console.log('[Clarity Popup] Permission granted, showing stats');
        // Show stats
        historySection.style.display = 'none';
        historyStats.style.display = 'block';
        // Update stats
        document.getElementById('visits-count').textContent = status.totalVisits.toString();
        // Get detailed stats
        chrome.runtime.sendMessage({ type: 'GET_HISTORY_STATS' }, (stats) => {
            if (stats && stats.topDomains && stats.topDomains.length > 0) {
                const topDistraction = stats.topDomains.find((d) => ['social_media', 'news', 'video', 'entertainment'].includes(d.category));
                if (topDistraction) {
                    document.getElementById('top-distraction').textContent = topDistraction.domain;
                }
            }
        });
    }
    else {
        console.log('[Clarity Popup] Permission NOT granted, showing Enable Insights card');
        // Show permission request
        historySection.style.display = 'block';
        historyStats.style.display = 'none';
    }
});
// Enable history button
document.getElementById('btn-enable-history')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-enable-history');
    btn.textContent = 'Requesting...';
    btn.disabled = true;
    try {
        // Request permission directly from popup (required by Chrome)
        const granted = await chrome.permissions.request({
            permissions: ['history']
        });
        console.log('[Clarity Popup] Permission request result:', granted);
        if (granted) {
            // Permission granted - import history
            btn.textContent = 'Importing history...';
            chrome.runtime.sendMessage({ type: 'IMPORT_HISTORY', data: { days: 30 } }, (result) => {
                console.log('[Clarity Popup] Import result:', result);
                if (result && result.success) {
                    // Refresh UI
                    window.location.reload();
                }
                else {
                    btn.textContent = 'Error - Try again';
                    btn.disabled = false;
                }
            });
        }
        else {
            btn.textContent = 'Permission denied';
            setTimeout(() => {
                btn.textContent = 'Enable Insights';
                btn.disabled = false;
            }, 2000);
        }
    }
    catch (error) {
        console.error('[Clarity Popup] Permission request error:', error);
        btn.textContent = 'Error - Try again';
        btn.disabled = false;
    }
});
// Toggle button
document.getElementById('btn-toggle').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'TOGGLE_MODE' }, () => {
        // Refresh UI
        window.location.reload();
    });
});
// Settings button
document.getElementById('btn-settings').addEventListener('click', () => {
    // TODO: Open settings page in main app
    alert('Settings coming soon!');
});
