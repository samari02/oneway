import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAuth } from '@/features/auth'
import { supabase } from '@/lib/supabase'
import { getApiKey, setApiKey, removeApiKey, hasApiKey } from '@/lib/openai'
import { SiteClassificationModal, type SiteClassification, type SiteCategory } from '@/features/stats/components/SiteClassificationModal'
import './SettingsView.css'

interface DataStats {
  totalVisits: number
  periodStart?: string
  periodEnd?: string
  topSites?: Array<{ domain: string; visits: number; category: string }>
}

export function SettingsView() {
  const { user, signOut } = useAuth()
  const [resetting, setResetting] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [dataStats, setDataStats] = useState<DataStats | null>(null)
  const [clearingData, setClearingData] = useState(false)
  const [isClassificationModalOpen, setIsClassificationModalOpen] = useState(false)

  useEffect(() => {
    setHasKey(hasApiKey())
    const key = getApiKey()
    if (key) {
      setApiKeyInput(key)
    }
    
    // Fetch browsing data stats
    fetchDataStats()
  }, [])

  const fetchDataStats = async () => {
    try {
      const stats = await invoke<{ 
        totalVisits: number
        periodStart?: string
        periodEnd?: string 
        topSites?: Array<{ domain: string; visits: number; category: string }>
      }>('get_browsing_stats')
      setDataStats({
        totalVisits: stats.totalVisits,
        periodStart: stats.periodStart,
        periodEnd: stats.periodEnd,
        topSites: stats.topSites,
      })
    } catch (e) {
      console.error('Failed to fetch data stats:', e)
    }
  }

  const handleClassificationSave = async (classifications: Record<string, SiteCategory>) => {
    console.log('[Settings] Saving classifications:', classifications)
    try {
      await invoke('save_site_classifications', { classifications })
      console.log('[Settings] Classifications saved successfully')
      // Refresh data stats
      await fetchDataStats()
    } catch (e) {
      console.error('[Settings] Failed to save classifications:', e)
    }
  }

  const handleClearData = async () => {
    if (!confirm('Are you sure you want to clear all browsing data? This cannot be undone.')) {
      return
    }
    setClearingData(true)
    try {
      await invoke('clear_browsing_data')
      await fetchDataStats()
      alert('✅ Browsing data cleared successfully!')
    } catch (e) {
      console.error('Failed to clear data:', e)
      alert('❌ Failed to clear data: ' + e)
    } finally {
      setClearingData(false)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

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

      {/* Browsing Data Section */}
      <section className="settings-section">
        <h2 className="settings-section__title">
          📊 Browsing Data
        </h2>
        
        <p className="settings-section__description">
          Manage your browsing history data synced from the Clarity extension.
        </p>

        <div className="settings-item">
          <div className="settings-item__info">
            <span className="settings-item__label">Total visits tracked</span>
            <span className="settings-item__value">{dataStats?.totalVisits?.toLocaleString() || '0'}</span>
          </div>
        </div>

        <div className="settings-item">
          <div className="settings-item__info">
            <span className="settings-item__label">Data period</span>
            <span className="settings-item__value">
              {dataStats?.periodStart && dataStats?.periodEnd 
                ? `${formatDate(dataStats.periodStart)} – ${formatDate(dataStats.periodEnd)}`
                : 'No data'
              }
            </span>
          </div>
        </div>

        <p className="settings-section__hint">
          To import more history, use the "Re-import History" button in the Clarity browser extension popup.
        </p>

        <div className="settings-section__actions">
          <button 
            className="settings-button settings-button--secondary settings-button--small"
            onClick={() => setIsClassificationModalOpen(true)}
          >
            <span className="settings-button__icon">★</span>
            Manage Site Classification
          </button>
          
          <button 
            className="settings-button settings-button--danger settings-button--small"
            onClick={handleClearData}
            disabled={clearingData}
          >
            {clearingData ? 'Clearing...' : 'Clear All Data'}
          </button>
        </div>

        {/* Classification modal */}
        <SiteClassificationModal
          isOpen={isClassificationModalOpen}
          onClose={() => setIsClassificationModalOpen(false)}
          sites={(dataStats?.topSites || []).map((s): SiteClassification => ({
            domain: s.domain,
            visits: s.visits,
            category: s.category === 'productive' || s.category === 'distraction' ? s.category : 'neutral'
          }))}
          onSave={handleClassificationSave}
        />
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
