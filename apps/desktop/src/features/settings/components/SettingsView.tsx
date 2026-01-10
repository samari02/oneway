import { useState, useEffect } from 'react'
import { useAuth } from '@/features/auth'
import { supabase } from '@/lib/supabase'
import { getApiKey, setApiKey, removeApiKey, hasApiKey } from '@/lib/openai'
import './SettingsView.css'

export function SettingsView() {
  const { user, signOut } = useAuth()
  const [resetting, setResetting] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    setHasKey(hasApiKey())
    const key = getApiKey()
    if (key) {
      setApiKeyInput(key)
    }
  }, [])

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      setApiKey(apiKeyInput.trim())
      setHasKey(true)
    }
  }

  const handleRemoveApiKey = () => {
    removeApiKey()
    setApiKeyInput('')
    setHasKey(false)
  }

  const handleResetOnboarding = async () => {
    if (!user) return
    setResetting(true)
    try {
      await supabase
        .from('user_settings')
        .update({ onboarding_completed: false })
        .eq('user_id', user.id)
      // Reload the page to trigger onboarding
      window.location.reload()
    } catch (e) {
      console.error('Failed to reset onboarding:', e)
      setResetting(false)
    }
  }

  return (
    <div className="settings-view">
      <header className="settings-view__header">
        <h1>Settings</h1>
        <p className="settings-view__subtitle">Manage your preferences</p>
      </header>

      {/* Account Section */}
      <section className="settings-section">
        <h2 className="settings-section__title">Account</h2>
        
        <div className="settings-item">
          <div className="settings-item__info">
            <span className="settings-item__label">Email</span>
            <span className="settings-item__value">{user?.email}</span>
          </div>
        </div>

        <button 
          className="settings-button settings-button--danger"
          onClick={signOut}
        >
          Sign Out
        </button>
      </section>

      {/* Strictness Section (Coming Soon) */}
      <section className="settings-section settings-section--disabled">
        <h2 className="settings-section__title">
          Strictness
          <span className="settings-badge">Coming Soon</span>
        </h2>
        
        <div className="settings-item">
          <div className="settings-item__info">
            <span className="settings-item__label">Blocking Mode</span>
            <span className="settings-item__value">—</span>
          </div>
        </div>
      </section>

      {/* Blocked Sites Section (Coming Soon) */}
      <section className="settings-section settings-section--disabled">
        <h2 className="settings-section__title">
          Blocked Sites
          <span className="settings-badge">Coming Soon</span>
        </h2>
        
        <p className="settings-section__description">
          Configure which sites to block until your habits are complete.
        </p>
      </section>

      {/* Schedule Section (Coming Soon) */}
      <section className="settings-section settings-section--disabled">
        <h2 className="settings-section__title">
          Schedule
          <span className="settings-badge">Coming Soon</span>
        </h2>
        
        <div className="settings-item">
          <div className="settings-item__info">
            <span className="settings-item__label">Wake Time</span>
            <span className="settings-item__value">—</span>
          </div>
        </div>

        <div className="settings-item">
          <div className="settings-item__info">
            <span className="settings-item__label">Screen Off Time</span>
            <span className="settings-item__value">—</span>
          </div>
        </div>
      </section>

      {/* AI Features Section */}
      <section className="settings-section">
        <h2 className="settings-section__title">
          ✨ AI Features
        </h2>
        
        <p className="settings-section__description">
          Use AI to help refine your goals and suggest habits. Requires an OpenAI API key.
        </p>

        <div className="settings-item settings-item--vertical">
          <label className="settings-item__label">OpenAI API Key</label>
          <div className="settings-api-key">
            <input
              type={showApiKey ? 'text' : 'password'}
              className="settings-api-key__input"
              placeholder="sk-..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
            />
            <button
              type="button"
              className="settings-api-key__toggle"
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? '🙈' : '👁️'}
            </button>
          </div>
          <div className="settings-api-key__actions">
            <button
              className="settings-button settings-button--small"
              onClick={handleSaveApiKey}
              disabled={!apiKeyInput.trim()}
            >
              {hasKey ? 'Update Key' : 'Save Key'}
            </button>
            {hasKey && (
              <button
                className="settings-button settings-button--small settings-button--ghost"
                onClick={handleRemoveApiKey}
              >
                Remove
              </button>
            )}
          </div>
          {hasKey && (
            <span className="settings-api-key__status">✓ Key configured</span>
          )}
        </div>
      </section>

      {/* Dev Section - Remove before production */}
      <section className="settings-section settings-section--dev">
        <h2 className="settings-section__title">
          🛠️ Dev
        </h2>
        
        <button 
          className="settings-button settings-button--dev"
          onClick={handleResetOnboarding}
          disabled={resetting}
        >
          {resetting ? 'Resetting...' : 'Reset Onboarding'}
        </button>
      </section>
    </div>
  )
}
