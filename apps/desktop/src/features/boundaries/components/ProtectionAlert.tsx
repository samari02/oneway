/**
 * Protection Alert Component
 * 
 * Displays a banner at the top of the app when protection is compromised.
 * Three levels: ok (hidden), warning (orange), critical (red)
 */

import { type AlertLevel, type ExtensionStatus } from '../hooks/useExtensionStatus'
import './ProtectionAlert.css'

interface ProtectionAlertProps {
  status: ExtensionStatus | null
  onDismiss?: () => void
}

export function ProtectionAlert({ status, onDismiss }: ProtectionAlertProps) {
  // Don't show if no status or everything is OK
  if (!status || status.alertLevel === 'ok') {
    return null
  }

  const isWarning = status.alertLevel === 'warning'
  const isCritical = status.alertLevel === 'critical'

  // Calculate time since last heartbeat
  const getTimeSinceHeartbeat = () => {
    if (!status.lastHeartbeat) return 'never'
    
    const elapsed = Date.now() - status.lastHeartbeat
    const seconds = Math.floor(elapsed / 1000)
    const minutes = Math.floor(seconds / 60)
    
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s ago`
    }
    return `${seconds}s ago`
  }

  // Get alert content based on level
  const getAlertContent = () => {
    if (isCritical) {
      return {
        icon: '🚨',
        title: 'Protection Compromised',
        message: status.lastHeartbeat 
          ? `No signal from extension for ${getTimeSinceHeartbeat()}. Please check that the extension is enabled.`
          : 'Extension has never connected. Please install and enable the Clarity extension.',
        action: 'Check Extension'
      }
    }
    
    // Warning
    return {
      icon: '⚠️',
      title: 'Extension Connection Unstable',
      message: `Last heartbeat: ${getTimeSinceHeartbeat()}. Connection may be interrupted.`,
      action: null
    }
  }

  const content = getAlertContent()

  const handleCheckExtension = () => {
    // Open Chrome extensions page
    // Note: This won't work directly from Tauri, but we show instructions
    alert('Please open chrome://extensions and check that "Clarity - Focus & Flow" is enabled.')
  }

  return (
    <div 
      className={`protection-alert protection-alert--${status.alertLevel}`}
      role="alert"
    >
      <div className="protection-alert__content">
        <span className="protection-alert__icon">{content.icon}</span>
        <div className="protection-alert__text">
          <strong className="protection-alert__title">{content.title}</strong>
          <span className="protection-alert__message">{content.message}</span>
        </div>
      </div>
      
      <div className="protection-alert__actions">
        {content.action && (
          <button 
            className="protection-alert__button protection-alert__button--primary"
            onClick={handleCheckExtension}
          >
            {content.action}
          </button>
        )}
        
        {isWarning && onDismiss && (
          <button 
            className="protection-alert__button protection-alert__button--dismiss"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Helper to get human-readable alert status
 */
export function getAlertDescription(level: AlertLevel): string {
  switch (level) {
    case 'ok':
      return 'Protection active'
    case 'warning':
      return 'Connection unstable'
    case 'critical':
      return 'Protection compromised'
  }
}
