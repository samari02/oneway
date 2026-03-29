import { useMemo, useState, type FormEvent } from 'react'
import type { CustomBlockingRule, CustomBlockingRuleType } from '@oneway/shared'
import { normalizeUrlBlockingValue } from '../api/customBlockingRules'
import { useCustomBlockingRules } from '../hooks/useCustomBlockingRules'
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

  const [addMode, setAddMode] = useState<CustomBlockingRuleType>('url_contains')
  const [addInput, setAddInput] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [addSaving, setAddSaving] = useState(false)
  const [presetBusy, setPresetBusy] = useState<string | null>(null)
  const [filterQuery, setFilterQuery] = useState('')

  const urlRules = useMemo(
    () => rules.filter((r) => r.rule_type === 'url_contains'),
    [rules]
  )

  const existingUrlLower = useMemo(
    () => new Set(urlRules.map((r) => normalizeUrlBlockingValue(r.value).toLowerCase())),
    [urlRules]
  )

  const existingSearchLower = useMemo(
    () =>
      new Set(
        rules
          .filter((r) => r.rule_type === 'search_contains')
          .map((r) => r.value.trim().toLowerCase())
      ),
    [rules]
  )

  const filteredRules = useMemo(
    () => filterRulesBySearch(rules, filterQuery),
    [rules, filterQuery]
  )

  const handleAdd = async (e?: FormEvent) => {
    e?.preventDefault()
    setAddError(null)
    const raw = addInput.trim()
    if (raw.length < MIN_LEN) {
      setAddError(`Use at least ${MIN_LEN} characters.`)
      return
    }

    setAddSaving(true)
    try {
      if (addMode === 'url_contains') {
        const value = normalizeUrlBlockingValue(raw)
        if (value.length < MIN_LEN) {
          setAddError(`Use at least ${MIN_LEN} characters after removing https:// etc.`)
          setAddSaving(false)
          return
        }
        if (existingUrlLower.has(value.toLowerCase())) {
          setAddError('That URL is already in the list.')
          setAddSaving(false)
          return
        }
        await createRule({
          user_id: userId,
          rule_type: 'url_contains',
          value,
          commitment_level: 'flexible',
        })
      } else {
        const value = raw.toLowerCase()
        if (existingSearchLower.has(value)) {
          setAddError('That keyword is already in the list.')
          setAddSaving(false)
          return
        }
        await createRule({
          user_id: userId,
          rule_type: 'search_contains',
          value,
          commitment_level: 'flexible',
        })
      }
      setAddInput('')
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Could not add rule')
    } finally {
      setAddSaving(false)
    }
  }

  const handlePreset = async (presetId: string) => {
    const preset = BLOCKING_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    const toAdd = preset.values.filter((v) => {
      const n = normalizeUrlBlockingValue(v)
      return n.length >= MIN_LEN && !existingUrlLower.has(n.toLowerCase())
    })
    if (toAdd.length === 0) {
      return
    }
    setPresetBusy(presetId)
    try {
      await createRulesBatch(
        toAdd.map((value) => ({
          user_id: userId,
          rule_type: 'url_contains' as const,
          value: normalizeUrlBlockingValue(value),
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
          Keep Clarity running and the extension connected. Paste a URL or domain (e.g. <code className="blocking-tab__code">hello.com</code> or{' '}
          <code className="blocking-tab__code">https://hello.com</code> — both work).
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

      <form className="blocking-tab__add-row" onSubmit={handleAdd}>
        <div className="blocking-tab__add-row-inner" role="group" aria-label="Add blocking rule">
          <div className="blocking-tab__segment" role="tablist" aria-label="Rule type">
            <button
              type="button"
              role="tab"
              aria-selected={addMode === 'url_contains'}
              className={
                addMode === 'url_contains'
                  ? 'blocking-tab__segment-btn blocking-tab__segment-btn--active'
                  : 'blocking-tab__segment-btn'
              }
              onClick={() => {
                setAddMode('url_contains')
                setAddError(null)
              }}
            >
              URL
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={addMode === 'search_contains'}
              className={
                addMode === 'search_contains'
                  ? 'blocking-tab__segment-btn blocking-tab__segment-btn--active'
                  : 'blocking-tab__segment-btn'
              }
              onClick={() => {
                setAddMode('search_contains')
                setAddError(null)
              }}
            >
              Search
            </button>
          </div>
          <input
            type="text"
            className="blocking-tab__add-input"
            value={addInput}
            onChange={(e) => {
              setAddInput(e.target.value)
              setAddError(null)
            }}
            placeholder={
              addMode === 'url_contains'
                ? 'Domain or paste a full URL, e.g. reddit.com or https://…'
                : 'Keyword to block in search queries (e.g. gossip)'
            }
            autoComplete="off"
            aria-label={addMode === 'url_contains' ? 'URL or domain to block' : 'Search keyword to block'}
          />
          <button
            type="submit"
            className="blocking-tab__add-submit"
            disabled={addSaving || addInput.trim().length < MIN_LEN}
          >
            {addSaving ? '…' : 'Add'}
          </button>
        </div>
        {addError && <p className="blocking-tab__add-error">{addError}</p>}
      </form>

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
            {filterQuery.trim() ? ' (filtered)' : ''}
          </span>
          <label className="blocking-tab__filter-right">
            <span className="blocking-tab__filter-right-label">Filter</span>
            <input
              type="search"
              className="blocking-tab__filter-input"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter table…"
              autoComplete="off"
            />
          </label>
        </div>

        <div className="blocking-tab__table-wrap">
          {rules.length === 0 ? (
            <p className="blocking-tab__empty">No rules yet. Type above and click Add, or use Quick add.</p>
          ) : filteredRules.length === 0 ? (
            <p className="blocking-tab__empty">No rules match your filter. Clear the filter on the right.</p>
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
    </section>
  )
}
