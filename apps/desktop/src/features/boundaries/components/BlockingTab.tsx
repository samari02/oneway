import { useMemo, useState } from 'react'
import type { CustomBlockingRule, CustomBlockingRuleType } from '@oneway/shared'
import { useCustomBlockingRules } from '../hooks/useCustomBlockingRules'
import { AddCustomBlockingRuleModal } from './AddCustomBlockingRuleModal'
import './BlockingTab.css'

const MIN_LEN = 3

export const BLOCKING_PRESETS: { id: string; label: string; values: string[] }[] = [
  {
    id: 'social',
    label: 'Social',
    values: ['reddit.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com', 'facebook.com'],
  },
  {
    id: 'video',
    label: 'Short video',
    values: ['/shorts', 'tiktok.com'],
  },
  {
    id: 'shopping',
    label: 'Shopping',
    values: ['amazon.com', 'aliexpress.com', 'ebay.com'],
  },
]

function isLockActive(rule: CustomBlockingRule): boolean {
  if (rule.commitment_level !== 'locked' || !rule.locked_until) return false
  return new Date(rule.locked_until) > new Date()
}

function formatSyncedAt(d: Date | null): string {
  if (!d) return 'Not synced yet'
  return d.toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: 'numeric',
    month: 'short',
  })
}

function commitmentLabel(rule: CustomBlockingRule): string {
  if (isLockActive(rule)) return 'Locked'
  switch (rule.commitment_level) {
    case 'committed':
      return 'Committed'
    case 'locked':
      return 'Flexible'
    default:
      return 'Flexible'
  }
}

function ruleTypeLabel(rule: CustomBlockingRule): string {
  return rule.rule_type === 'url_contains' ? 'URL' : 'Search'
}

function filterRulesBySearch(rules: CustomBlockingRule[], query: string): CustomBlockingRule[] {
  const s = query.trim().toLowerCase()
  if (!s) return rules
  return rules.filter((r) => {
    const blob = [
      r.value,
      r.note ?? '',
      ruleTypeLabel(r),
      commitmentLabel(r),
      r.match_mode,
    ]
      .join(' ')
      .toLowerCase()
    return blob.includes(s)
  })
}

interface BlockingTabProps {
  userId: string
}

export function BlockingTab({ userId }: BlockingTabProps) {
  const {
    rules,
    loading,
    error,
    lastSyncedAt,
    refetch,
    createRule,
    createRulesBatch,
    updateRule,
    removeRule,
    optimisticRemove,
    optimisticToggle,
  } = useCustomBlockingRules(userId)

  const [modalType, setModalType] = useState<CustomBlockingRuleType | null>(null)
  const [presetBusy, setPresetBusy] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const urlRules = useMemo(
    () => rules.filter((r) => r.rule_type === 'url_contains'),
    [rules]
  )

  const existingUrlLower = useMemo(
    () => new Set(urlRules.map((r) => r.value.trim().toLowerCase())),
    [urlRules]
  )

  const filteredRules = useMemo(
    () => filterRulesBySearch(rules, searchQuery),
    [rules, searchQuery]
  )

  const handlePreset = async (presetId: string) => {
    const preset = BLOCKING_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    const toAdd = preset.values.filter((v) => v.length >= MIN_LEN && !existingUrlLower.has(v.toLowerCase()))
    if (toAdd.length === 0) {
      return
    }
    setPresetBusy(presetId)
    try {
      await createRulesBatch(
        toAdd.map((value) => ({
          user_id: userId,
          rule_type: 'url_contains' as const,
          value,
          note: `Quick add: ${preset.label}`,
          commitment_level: 'flexible',
        }))
      )
    } catch {
      refetch(true)
    } finally {
      setPresetBusy(null)
    }
  }

  const confirmCommitted = (action: string) =>
    window.confirm(
      `This rule is marked Committed. ${action}\n\nAre you sure you want to continue?`
    )

  const handleToggle = async (rule: CustomBlockingRule) => {
    if (isLockActive(rule)) {
      window.alert('This rule is locked until ' + new Date(rule.locked_until!).toLocaleString())
      return
    }
    const next = !rule.is_active
    if (rule.commitment_level === 'committed' && rule.is_active && !next) {
      if (!confirmCommitted('Disabling will weaken your boundary.')) return
    }
    optimisticToggle(rule.id, next)
    try {
      await updateRule(rule.id, { is_active: next })
    } catch {
      refetch(true)
    }
  }

  const handleDelete = async (rule: CustomBlockingRule) => {
    if (isLockActive(rule)) {
      window.alert('This rule is locked until ' + new Date(rule.locked_until!).toLocaleString())
      return
    }
    if (rule.commitment_level === 'committed') {
      if (!confirmCommitted('Deleting cannot be undone.')) return
    } else if (!window.confirm('Remove this rule?')) {
      return
    }
    optimisticRemove(rule.id)
    try {
      await removeRule(rule.id)
    } catch {
      refetch(true)
    }
  }

  if (loading) {
    return (
      <section className="blocking-tab">
        <p className="blocking-tab__loading">Loading blocking rules…</p>
      </section>
    )
  }

  return (
    <section className="blocking-tab">
      <div className="blocking-tab__intro">
        <h2 className="blocking-tab__title">Your blocking rules</h2>
        <div className="blocking-tab__notice" role="status">
          <strong>Chrome sync:</strong> rules are saved to Supabase and written to{' '}
          <code className="blocking-tab__code">~/.clarity/custom-blocking-rules.json</code>. The extension loads them via
          the native host (<code className="blocking-tab__code">GET_CONFIG</code>), merged with the built-in blocklist.
          Keep Clarity running and the extension connected; updates also poll about every minute.
        </div>
        <p className="blocking-tab__subtitle">
          Supabase project: <code className="blocking-tab__code">apps/desktop/.env.local</code> (defaults in{' '}
          <code className="blocking-tab__code">packages/shared/src/constants.ts</code> if unset). Table:{' '}
          <code className="blocking-tab__code">custom_blocking_rules</code>.
        </p>
        <p className="blocking-tab__sync">
          <span className="blocking-tab__sync-label">Last load from cloud:</span>{' '}
          <span className="blocking-tab__sync-time">{formatSyncedAt(lastSyncedAt)}</span>
        </p>
      </div>

      {error && (
        <div className="blocking-tab__banner blocking-tab__banner--error">
          {error.message}
          <button type="button" className="blocking-tab__retry" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}

      <div className="blocking-tab__toolbar">
        <label className="blocking-tab__search-label">
          <span className="blocking-tab__search-label-text">Search</span>
          <input
            type="search"
            className="blocking-tab__search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by keyword, URL, note, type…"
            autoComplete="off"
          />
        </label>
        <div className="blocking-tab__toolbar-actions">
          <button type="button" className="blocking-tab__btn-secondary" onClick={() => setModalType('url_contains')}>
            + URL rule
          </button>
          <button type="button" className="blocking-tab__btn-secondary" onClick={() => setModalType('search_contains')}>
            + Search rule
          </button>
        </div>
      </div>

      <div className="blocking-tab__presets-inline">
        <span className="blocking-tab__presets-label">Quick add (URLs):</span>
        <div className="blocking-tab__preset-row">
          {BLOCKING_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="blocking-tab__preset-btn"
              disabled={!!presetBusy}
              onClick={() => handlePreset(p.id)}
            >
              {presetBusy === p.id ? '…' : p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="blocking-tab__table-panel">
        <div className="blocking-tab__table-meta">
          <span>
            {filteredRules.length} of {rules.length} rule{rules.length !== 1 ? 's' : ''}
            {searchQuery.trim() ? ' (filtered)' : ''}
          </span>
        </div>

        <div className="blocking-tab__table-wrap">
          {rules.length === 0 ? (
            <p className="blocking-tab__empty">No rules yet. Add a URL or search rule, or use Quick add.</p>
          ) : filteredRules.length === 0 ? (
            <p className="blocking-tab__empty">No rules match your search. Clear the filter or try other keywords.</p>
          ) : (
            <table className="blocking-tab__table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Criterion</th>
                  <th>Match</th>
                  <th>Note</th>
                  <th>Commitment</th>
                  <th>Active</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filteredRules.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      <span
                        className={
                          rule.rule_type === 'url_contains'
                            ? 'blocking-tab__type-badge blocking-tab__type-badge--url'
                            : 'blocking-tab__type-badge blocking-tab__type-badge--search'
                        }
                      >
                        {ruleTypeLabel(rule)}
                      </span>
                    </td>
                    <td>
                      <code className="blocking-tab__criterion">{rule.value}</code>
                    </td>
                    <td>
                      <span className="blocking-tab__mono">{rule.match_mode === 'host_is' ? 'Host' : 'Contains'}</span>
                    </td>
                    <td className="blocking-tab__cell-note">
                      {rule.note ? (
                        <span className="blocking-tab__note-clip" title={rule.note}>
                          {rule.note}
                        </span>
                      ) : (
                        <span className="blocking-tab__muted">—</span>
                      )}
                      {isLockActive(rule) && rule.locked_until && (
                        <span className="blocking-tab__lock-inline">
                          Locked until {new Date(rule.locked_until).toLocaleDateString()}
                        </span>
                      )}
                    </td>
                    <td>{commitmentLabel(rule)}</td>
                    <td>
                      <label className="blocking-tab__toggle-inline">
                        <input
                          type="checkbox"
                          checked={rule.is_active}
                          disabled={isLockActive(rule)}
                          onChange={() => handleToggle(rule)}
                        />
                      </label>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="blocking-tab__table-remove"
                        disabled={isLockActive(rule)}
                        onClick={() => handleDelete(rule)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalType && (
        <AddCustomBlockingRuleModal
          userId={userId}
          ruleType={modalType}
          createRule={createRule}
          onSave={() => {
            setModalType(null)
          }}
          onCancel={() => setModalType(null)}
        />
      )}
    </section>
  )
}
