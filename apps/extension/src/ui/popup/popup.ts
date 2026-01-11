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
