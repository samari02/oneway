import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAuth } from '@/features/auth'
import { supabase } from '@/lib/supabase'
import { setApiKey, removeApiKey, hasApiKey, getMaskedApiKey } from '@/lib/openai'

type ApiKeySaveState = 'idle' | 'saving' | 'saved' | 'error'
import { SiteClassificationModal, type SiteClassification, type SiteCategory } from '@/features/stats/components/SiteClassificationModal'
import { useAoiPreferences } from '@/features/settings/hooks/useAoiPreferences'
import { DeleteSiteDomainPicker } from '@/features/settings/components/DeleteSiteDomainPicker'
import './SettingsView.css'

function normalizeDomainInput(raw: string): string {
  let s = raw.trim().toLowerCase()
  s = s.replace(/^https?:\/\//, '')
  s = s.split('/')[0] ?? ''
  s = s.replace(/^www\./, '')
  return s
}

interface DataStats {
  totalVisits: number
  periodStart?: string
  periodEnd?: string
  topSites?: Array<{ domain: string; visits: number; category: string }>
}

export function SettingsView() {
  const { user, signOut } = useAuth()
  const { preferences: aoiPrefs, isLoading: aoiLoading, updatePreferences: updateAoiPrefs } =
    useAoiPreferences()
  const [aoiDomainInput, setAoiDomainInput] = useState('')
  const [resetting, setResetting] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [maskedKey, setMaskedKey] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeySaveState, setApiKeySaveState] = useState<ApiKeySaveState>('idle')
  const [apiKeySaveError, setApiKeySaveError] = useState<string | null>(null)
  const [dataStats, setDataStats] = useState<DataStats | null>(null)
  const [clearingData, setClearingData] = useState(false)
  const [isClassificationModalOpen, setIsClassificationModalOpen] = useState(false)

  useEffect(() => {
    setHasKey(hasApiKey())
    setMaskedKey(getMaskedApiKey())

    // Fetch browsing data stats
    fetchDataStats()
  }, [])

  useEffect(() => {
    if (apiKeySaveState !== 'saved') return
    const timer = window.setTimeout(() => setApiKeySaveState('idle'), 3000)
    return () => window.clearTimeout(timer)
  }, [apiKeySaveState])

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

  const handleDeleteSiteForever = async () => {
    const domain = normalizeDomainInput(deleteSiteInput)
    if (!domain) {
      alert('Enter a domain (e.g. youtube.com)')
      return
    }
    if (
      !confirm(
        `Delete all visits, block events, and saved classification for “${domain}” on this Mac? This cannot be undone.`
      )
    ) {
      return
    }
    setDeleteSiteBusy(true)
    try {
      const result = await invoke<{
        visitsRemoved: number
        blocksRemoved: number
        classificationRemoved: boolean
      }>('delete_browsing_data_for_domain', { domain })
      await fetchDataStats()
      setDeleteSiteInput('')
      const parts = [
        `${result.visitsRemoved} visit row(s)`,
        `${result.blocksRemoved} block event(s)`,
      ]
      if (result.classificationRemoved) parts.push('saved site classification')
      alert(`Removed: ${parts.join(', ')}.`)
    } catch (e) {
      console.error('delete_browsing_data_for_domain:', e)
      alert('Failed to delete: ' + e)
    } finally {
      setDeleteSiteBusy(false)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const apiKeyDirty = apiKeyInput.trim().length > 0
  const canSaveApiKey = apiKeyDirty && apiKeySaveState !== 'saving'

  const handleApiKeyInputChange = (value: string) => {
    setApiKeyInput(value)
    if (apiKeySaveState === 'saved' || apiKeySaveState === 'error') {
      setApiKeySaveState('idle')
    }
    setApiKeySaveError(null)
  }

  const handleSaveApiKey = async () => {
    const trimmed = apiKeyInput.trim()
    if (!trimmed) {
      setApiKeySaveState('error')
      setApiKeySaveError('Enter an API key before saving.')
      return
    }

    setApiKeySaveState('saving')
    setApiKeySaveError(null)

    await new Promise((resolve) => window.setTimeout(resolve, 150))

    try {
      setApiKey(trimmed)
      if (!hasApiKey()) {
        throw new Error('Key was not persisted')
      }

      setHasKey(true)
      setMaskedKey(getMaskedApiKey())
      setApiKeyInput('')
      setShowApiKey(false)
      setApiKeySaveState('saved')
    } catch (e) {
      console.error('Failed to save API key:', e)
      setApiKeySaveState('error')
      setApiKeySaveError('Could not save your API key. Please try again.')
    }
  }

  const handleRemoveApiKey = () => {
    removeApiKey()
    setApiKeyInput('')
    setHasKey(false)
    setMaskedKey(null)
    setShowApiKey(false)
    setApiKeySaveState('idle')
    setApiKeySaveError(null)
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

        <div className="settings-item settings-item--vertical">
          <span className="settings-item__label">Remove one site from stored history</span>
          <p className="settings-section__hint">
            Data is removed only from this Mac (visits file, block log, saved classification). Remote database sync
            for browsing history is not implemented yet.
          </p>
          <DeleteSiteDomainPicker onDataChanged={fetchDataStats} />
        </div>

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
            category: null // Start unclassified - modal loads existing from backend
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

      {/* Aoi browser widget — visibility (extension) */}
      {user && (
        <section className="settings-section">
          <h2 className="settings-section__title">Aoi (browser widget)</h2>
          <p className="settings-section__description">
            Control the floating Aoi bubble injected on websites by the Clarity extension. When hidden,
            the widget is fully removed from the page (no minimized chip). Restore it here or by
            removing a site from the list below.
          </p>

          {aoiLoading ? (
            <p className="settings-section__hint">Loading…</p>
          ) : (
            <>
              <label className="settings-item settings-item--row">
                <input
                  type="checkbox"
                  checked={aoiPrefs.hiddenGlobal}
                  onChange={(e) => updateAoiPrefs({ hiddenGlobal: e.target.checked })}
                />
                <span className="settings-item__label">Hide Aoi on all websites</span>
              </label>

              <div className="settings-item settings-item--vertical">
                <span className="settings-item__label">Hidden on these domains</span>
                {aoiPrefs.hiddenDomains.length === 0 ? (
                  <p className="settings-section__hint">None — Aoi shows on every site (unless hidden globally above).</p>
                ) : (
                  <ul className="settings-aoi-domain-list">
                    {aoiPrefs.hiddenDomains.map((domain) => (
                      <li key={domain} className="settings-aoi-domain-list__item">
                        <span>{domain}</span>
                        <button
                          type="button"
                          className="settings-button settings-button--small settings-button--ghost"
                          onClick={() =>
                            updateAoiPrefs({
                              hiddenDomains: aoiPrefs.hiddenDomains.filter((d) => d !== domain),
                            })
                          }
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="settings-item settings-item--vertical">
                <span className="settings-item__label">Hide on a domain</span>
                <div className="settings-aoi-add-row">
                  <input
                    type="text"
                    className="settings-api-key__input"
                    placeholder="e.g. github.com"
                    value={aoiDomainInput}
                    onChange={(e) => setAoiDomainInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const d = normalizeDomainInput(aoiDomainInput)
                        if (!d || aoiPrefs.hiddenDomains.includes(d)) return
                        void updateAoiPrefs({ hiddenDomains: [...aoiPrefs.hiddenDomains, d] })
                        setAoiDomainInput('')
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="settings-button settings-button--small"
                    onClick={() => {
                      const d = normalizeDomainInput(aoiDomainInput)
                      if (!d || aoiPrefs.hiddenDomains.includes(d)) return
                      void updateAoiPrefs({ hiddenDomains: [...aoiPrefs.hiddenDomains, d] })
                      setAoiDomainInput('')
                    }}
                  >
                    Add
                  </button>
                </div>
                <p className="settings-section__hint">
                  Use the hostname only (no <code>https://</code>). Matches the extension&apos;s per-site hide list.
                </p>
              </div>
            </>
          )}
        </section>
      )}

      {/* AI Features Section */}
      <section className="settings-section">
        <h2 className="settings-section__title">
          ✨ AI Features
        </h2>
        
        <p className="settings-section__description">
          Use AI to help refine your goals and suggest habits. Requires an OpenAI API key.
        </p>

        <div className="settings-item settings-item--vertical">
          <div className="settings-api-key__header">
            <label className="settings-item__label">OpenAI API Key</label>
            {hasKey && !apiKeyDirty && (
              <span className="settings-api-key__saved-badge">Saved</span>
            )}
          </div>

          {hasKey && maskedKey && !apiKeyDirty && (
            <div className="settings-api-key__stored">
              <span className="settings-api-key__masked" aria-label="Saved API key">
                {maskedKey}
              </span>
              <span className="settings-api-key__stored-hint">Key stored on this device</span>
            </div>
          )}

          <div className="settings-api-key">
            <input
              type={showApiKey ? 'text' : 'password'}
              className={`settings-api-key__input${
                apiKeySaveState === 'saved' ? ' settings-api-key__input--saved' : ''
              }`}
              placeholder={hasKey ? 'Paste a new key to update' : 'sk-...'}
              value={apiKeyInput}
              onChange={(e) => handleApiKeyInputChange(e.target.value)}
              disabled={apiKeySaveState === 'saving'}
            />
            <button
              type="button"
              className="settings-api-key__toggle"
              onClick={() => setShowApiKey(!showApiKey)}
              disabled={!apiKeyInput || apiKeySaveState === 'saving'}
              aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
            >
              {showApiKey ? '🙈' : '👁️'}
            </button>
          </div>

          <div className="settings-api-key__actions">
            <button
              className="settings-button settings-button--small"
              onClick={() => void handleSaveApiKey()}
              disabled={!canSaveApiKey}
            >
              {apiKeySaveState === 'saving'
                ? 'Saving…'
                : hasKey
                  ? 'Update Key'
                  : 'Save Key'}
            </button>
            {hasKey && (
              <button
                className="settings-button settings-button--small settings-button--ghost"
                onClick={handleRemoveApiKey}
                disabled={apiKeySaveState === 'saving'}
              >
                Remove
              </button>
            )}
          </div>

          {apiKeySaveState === 'saved' && (
            <p className="settings-api-key__feedback settings-api-key__feedback--success" role="status">
              <span className="settings-api-key__feedback-icon" aria-hidden="true">✓</span>
              API key saved
            </p>
          )}

          {apiKeySaveState === 'error' && apiKeySaveError && (
            <p className="settings-api-key__feedback settings-api-key__feedback--error" role="alert">
              {apiKeySaveError}
            </p>
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
