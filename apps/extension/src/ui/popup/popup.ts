/**
 * Popup UI Logic
 */

// Get status from background
chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
  if (response) {
    const modeEl = document.getElementById('mode')!
    const activeEl = document.getElementById('active-until')!
    const blocksEl = document.getElementById('blocks-today')!
    const toggleBtn = document.getElementById('btn-toggle') as HTMLButtonElement
    
    // Update mode display
    const modeIcon = response.isActive ? '🟢' : '⚪️'
    const modeName = response.mode.charAt(0).toUpperCase() + response.mode.slice(1)
    modeEl.textContent = `${modeIcon} ${modeName} Mode`
    
    // Update active status
    activeEl.textContent = response.isActive ? 'Active' : 'Paused'
    
    // Update blocks count
    blocksEl.textContent = response.blocksToday.toString()
    
    // Update toggle button
    toggleBtn.textContent = response.isActive ? 'Pause Mode' : 'Resume Mode'
  }
})

// Check history permission status
chrome.runtime.sendMessage({ type: 'GET_COLLECTION_STATUS' }, (status) => {
  const historySection = document.getElementById('history-section')!
  const historyStats = document.getElementById('history-stats')!
  
  if (status.hasPermission) {
    // Show stats
    historySection.style.display = 'none'
    historyStats.style.display = 'block'
    
    // Update stats
    document.getElementById('visits-count')!.textContent = status.totalVisits.toString()
    
    // Get detailed stats
    chrome.runtime.sendMessage({ type: 'GET_HISTORY_STATS' }, (stats) => {
      if (stats && stats.topDomains && stats.topDomains.length > 0) {
        const topDistraction = stats.topDomains.find((d: any) => 
          ['social_media', 'news', 'video', 'entertainment'].includes(d.category)
        )
        
        if (topDistraction) {
          document.getElementById('top-distraction')!.textContent = topDistraction.domain
        }
      }
    })
  } else {
    // Show permission request
    historySection.style.display = 'block'
    historyStats.style.display = 'none'
  }
})

// Enable history button
document.getElementById('btn-enable-history')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-enable-history') as HTMLButtonElement
  btn.textContent = 'Requesting...'
  btn.disabled = true
  
  chrome.runtime.sendMessage({ type: 'REQUEST_HISTORY_PERMISSION' }, async (granted) => {
    if (granted) {
      // Permission granted - import history
      btn.textContent = 'Importing history...'
      
      chrome.runtime.sendMessage(
        { type: 'IMPORT_HISTORY', data: { days: 30 } },
        (result) => {
          if (result.success) {
            // Refresh UI
            window.location.reload()
          } else {
            btn.textContent = 'Error - Try again'
            btn.disabled = false
          }
        }
      )
    } else {
      btn.textContent = 'Permission denied'
      setTimeout(() => {
        btn.textContent = 'Enable Insights'
        btn.disabled = false
      }, 2000)
    }
  })
})

// Toggle button
document.getElementById('btn-toggle')!.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'TOGGLE_MODE' }, () => {
    // Refresh UI
    window.location.reload()
  })
})

// Settings button
document.getElementById('btn-settings')!.addEventListener('click', () => {
  // TODO: Open settings page in main app
  alert('Settings coming soon!')
})
