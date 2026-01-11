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
    const historySection = document.getElementById('history-section');
    const insightsSection = document.getElementById('insights-section');
    // Guard: if no response, show the permission request card
    if (!status) {
        console.log('[Clarity Popup] No status received, showing Enable Insights card');
        historySection.style.display = 'block';
        insightsSection.style.display = 'none';
        return;
    }
    if (status.hasPermission) {
        console.log('[Clarity Popup] Permission granted, showing insights');
        // Show insights section
        historySection.style.display = 'none';
        insightsSection.style.display = 'block';
        // Update stats
        document.getElementById('visits-count').textContent = status.totalVisits.toString();
        // Update last import time
        if (status.lastImport) {
            const date = new Date(status.lastImport);
            const timeStr = date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });
            document.getElementById('last-import').textContent = `Last import: ${timeStr}`;
            // Set period select to match last import
            if (status.periodDays) {
                const periodSelect = document.getElementById('period-select');
                periodSelect.value = status.periodDays.toString();
            }
        }
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
        insightsSection.style.display = 'none';
    }
});
// Enable history button (first time)
document.getElementById('btn-enable-history')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-enable-history');
    const periodSelect = document.getElementById('period-select-initial');
    const days = parseInt(periodSelect.value, 10);
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
            btn.textContent = `Importing ${days} days...`;
            chrome.runtime.sendMessage({ type: 'IMPORT_HISTORY', data: { days } }, (result) => {
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
// Re-import button (when already enabled)
document.getElementById('btn-reimport')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-reimport');
    const periodSelect = document.getElementById('period-select');
    const days = parseInt(periodSelect.value, 10);
    btn.textContent = `Importing ${days} days...`;
    btn.disabled = true;
    chrome.runtime.sendMessage({ type: 'IMPORT_HISTORY', data: { days } }, (result) => {
        console.log('[Clarity Popup] Re-import result:', result);
        if (result && result.success) {
            btn.textContent = `✓ Imported ${result.visits} visits`;
            // Update stats
            document.getElementById('visits-count').textContent = result.visits.toString();
            document.getElementById('last-import').textContent = `Last import: Just now`;
            // Refresh top distraction
            chrome.runtime.sendMessage({ type: 'GET_HISTORY_STATS' }, (stats) => {
                if (stats && stats.topDomains && stats.topDomains.length > 0) {
                    const topDistraction = stats.topDomains.find((d) => ['social_media', 'news', 'video', 'entertainment'].includes(d.category));
                    if (topDistraction) {
                        document.getElementById('top-distraction').textContent = topDistraction.domain;
                    }
                }
            });
            setTimeout(() => {
                btn.textContent = 'Re-import History';
                btn.disabled = false;
            }, 2000);
        }
        else {
            btn.textContent = 'Error - Try again';
            btn.disabled = false;
        }
    });
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
// Check sync status and show sync section
chrome.runtime.sendMessage({ type: 'GET_SYNC_STATUS' }, (status) => {
    console.log('[Clarity Popup] Sync status:', status);
    const syncSection = document.getElementById('sync-section');
    const syncIcon = document.getElementById('sync-icon');
    const syncText = document.getElementById('sync-text');
    const syncBtn = document.getElementById('btn-sync');
    // Only show sync section if history is enabled
    chrome.runtime.sendMessage({ type: 'GET_COLLECTION_STATUS' }, (collectionStatus) => {
        if (collectionStatus?.hasPermission) {
            syncSection.style.display = 'block';
            if (status?.isAuthenticated) {
                if (status.pendingCount > 0) {
                    syncIcon.textContent = '🔄';
                    syncText.textContent = `${status.pendingCount} visits pending sync`;
                    syncBtn.textContent = 'Sync Now';
                }
                else {
                    syncIcon.textContent = '✅';
                    syncText.textContent = 'All synced to cloud';
                    syncBtn.textContent = 'Synced';
                }
            }
            else {
                syncIcon.textContent = '🔐';
                syncText.textContent = 'Sign in to sync to cloud';
                syncBtn.textContent = 'Sign In';
            }
        }
    });
});
// Sync button
document.getElementById('btn-sync')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync');
    const syncIcon = document.getElementById('sync-icon');
    const syncText = document.getElementById('sync-text');
    // Check if authenticated
    chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' }, async (authStatus) => {
        if (!authStatus?.authenticated) {
            // Not authenticated - prompt for email
            const email = prompt('Enter your email to sync:');
            if (email) {
                btn.textContent = 'Sending link...';
                btn.disabled = true;
                chrome.runtime.sendMessage({ type: 'SIGN_IN', data: { email } }, (result) => {
                    if (result?.error) {
                        alert('Error: ' + result.error.message);
                        btn.textContent = 'Sign In';
                        btn.disabled = false;
                    }
                    else {
                        alert('Check your email for the sign-in link!');
                        btn.textContent = 'Check email';
                        btn.disabled = false;
                    }
                });
            }
        }
        else {
            // Authenticated - sync
            btn.textContent = 'Syncing...';
            btn.disabled = true;
            syncIcon.textContent = '🔄';
            chrome.runtime.sendMessage({ type: 'SYNC_TO_SUPABASE' }, (result) => {
                console.log('[Clarity Popup] Sync result:', result);
                if (result?.success) {
                    syncIcon.textContent = '✅';
                    syncText.textContent = `Synced ${result.synced} visits`;
                    btn.textContent = 'Synced!';
                }
                else {
                    syncIcon.textContent = '❌';
                    syncText.textContent = 'Sync failed';
                    btn.textContent = 'Retry';
                }
                btn.disabled = false;
            });
        }
    });
});
