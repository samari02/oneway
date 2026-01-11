/**
 * Block Screen UI Logic
 */

// Parse URL parameters
const params = new URLSearchParams(window.location.search)
const blockedUrl = params.get('url') || ''
const reason = params.get('reason') || 'This site is blocked in Focus Mode'

// Extract domain
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace('www.', '')
  } catch {
    return url
  }
}

// Update UI
const domain = extractDomain(blockedUrl)
document.getElementById('blocked-domain')!.textContent = domain
document.getElementById('reason')!.textContent = reason

// Get status from background
chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
  if (response) {
    document.querySelector('.block-screen__mode')!.textContent = 
      `You're in ${response.mode.charAt(0).toUpperCase() + response.mode.slice(1)} Mode`
    
    document.getElementById('blocks-today')!.textContent = 
      `${response.blocksToday} ${response.blocksToday === 1 ? 'site' : 'sites'} blocked today`
  }
})

// Handle radio button selection
const radioButtons = document.querySelectorAll('input[name="reason"]')
const continueBtn = document.getElementById('btn-continue') as HTMLButtonElement

radioButtons.forEach(radio => {
  radio.addEventListener('change', () => {
    continueBtn.disabled = false
  })
})

// Cancel button
document.getElementById('btn-cancel')!.addEventListener('click', () => {
  window.history.back()
})

// Continue button
continueBtn.addEventListener('click', async () => {
  const selectedReason = (document.querySelector('input[name="reason"]:checked') as HTMLInputElement)?.value
  
  if (!selectedReason) return
  
  // Send bypass request to background
  chrome.runtime.sendMessage({
    type: 'BYPASS_BLOCK',
    data: {
      url: blockedUrl,
      method: selectedReason
    }
  }, (response) => {
    if (response.success) {
      // Navigate to the original URL
      window.location.href = blockedUrl
    }
  })
})
