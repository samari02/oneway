import './IncognitoSetupModal.css'

// Custom Lock Icon
const LockIcon = () => (
  <svg className="incognito-setup-modal__svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

// Lightbulb Icon
const LightbulbIcon = () => (
  <svg className="incognito-setup-modal__svg-icon incognito-setup-modal__svg-icon--small" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="9" y1="18" x2="15" y2="18" />
    <line x1="10" y1="22" x2="14" y2="22" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
  </svg>
)

interface IncognitoSetupModalProps {
  onClose: () => void
}

export function IncognitoSetupModal({ onClose }: IncognitoSetupModalProps) {
  const handleOpenExtensions = () => {
    // Open chrome://extensions in the default browser
    // Note: We can't open chrome:// URLs directly, so we'll give instructions
    window.open('https://support.google.com/chrome_webstore/answer/2664769', '_blank')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="incognito-setup-modal" onClick={e => e.stopPropagation()}>
        <header className="incognito-setup-modal__header">
          <span className="incognito-setup-modal__icon"><LockIcon /></span>
          <h2>Enable Protection in Incognito</h2>
        </header>

        <div className="incognito-setup-modal__content">
          <p className="incognito-setup-modal__intro">
            By default, Chrome extensions don't run in incognito mode. 
            To stay protected, you need to manually enable Clarity.
          </p>

          <div className="incognito-setup-modal__steps">
            <div className="incognito-setup-modal__step">
              <span className="incognito-setup-modal__step-number">1</span>
              <div className="incognito-setup-modal__step-content">
                <strong>Open Chrome Extensions</strong>
                <p>Type <code>chrome://extensions</code> in your address bar</p>
              </div>
            </div>

            <div className="incognito-setup-modal__step">
              <span className="incognito-setup-modal__step-number">2</span>
              <div className="incognito-setup-modal__step-content">
                <strong>Find Clarity Extension</strong>
                <p>Look for "Clarity - Focus & Flow" in the list</p>
              </div>
            </div>

            <div className="incognito-setup-modal__step">
              <span className="incognito-setup-modal__step-number">3</span>
              <div className="incognito-setup-modal__step-content">
                <strong>Click "Details"</strong>
                <p>Open the extension details page</p>
              </div>
            </div>

            <div className="incognito-setup-modal__step">
              <span className="incognito-setup-modal__step-number">4</span>
              <div className="incognito-setup-modal__step-content">
                <strong>Enable Incognito</strong>
                <p>Toggle <strong>"Allow in incognito"</strong> to ON</p>
              </div>
            </div>
          </div>

          <div className="incognito-setup-modal__note">
            <span className="incognito-setup-modal__note-icon"><LightbulbIcon /></span>
            <p>
              Once enabled, Clarity will block sites and track your browsing 
              in incognito mode too. Your protection will be complete.
            </p>
          </div>
        </div>

        <footer className="incognito-setup-modal__footer">
          <button 
            className="incognito-setup-modal__btn incognito-setup-modal__btn--secondary"
            onClick={onClose}
          >
            I'll do it later
          </button>
          <button 
            className="incognito-setup-modal__btn incognito-setup-modal__btn--primary"
            onClick={onClose}
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  )
}
