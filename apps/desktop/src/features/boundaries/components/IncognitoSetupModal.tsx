import './IncognitoSetupModal.css'

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
          <span className="incognito-setup-modal__icon">🔒</span>
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
            <span className="incognito-setup-modal__note-icon">💡</span>
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
