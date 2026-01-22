/**
 * Protection Alert Component
 * 
 * Displays a banner at the top of the app when protection is compromised.
 * Three levels: ok (hidden), warning (orange), critical (red)
 */

import { type AlertLevel, type ExtensionStatus } from '../hooks/useExtensionStatus'
import './ProtectionAlert.css'

// Custom SVG Icons
const WarningIcon = () => (
  <svg className="protection-alert__svg-icon protection-alert__svg-icon--warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

const AlertIcon = () => (
  <svg className="protection-alert__svg-icon protection-alert__svg-icon--alert" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

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
        icon: <AlertIcon />,
        title: 'Protection Compromised',
        message: status.lastHeartbeat 
          ? `No signal from extension for ${getTimeSinceHeartbeat()}. Please check that the extension is enabled.`
          : 'Extension has never connected. Please install and enable the Clarity extension.',
        action: 'Check Extension'
      }
    }
    
    // Warning
    return {
      icon: <WarningIcon />,
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
