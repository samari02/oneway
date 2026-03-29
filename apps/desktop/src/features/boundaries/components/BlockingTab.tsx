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

  const urlRules = useMemo(
    () => rules.filter((r) => r.rule_type === 'url_contains'),
    [rules]
  )
  const searchRules = useMemo(
    () => rules.filter((r) => r.rule_type === 'search_contains'),
    [rules]
  )

  const existingUrlLower = useMemo(
    () => new Set(urlRules.map((r) => r.value.trim().toLowerCase())),
    [urlRules]
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
        <p className="blocking-tab__subtitle">
          These rules apply in Chrome when the Clarity extension is active. They are saved to your account.
        </p>
        <p className="blocking-tab__sync">
          <span className="blocking-tab__sync-label">Account data:</span>{' '}
          <span className="blocking-tab__sync-time">{formatSyncedAt(lastSyncedAt)}</span>
          <span className="blocking-tab__sync-hint"> — extension sync is applied when the desktop app pushes config (see roadmap).</span>
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

      <div className="blocking-tab__presets">
        <h3 className="blocking-tab__card-title">Quick add (URLs)</h3>
        <p className="blocking-tab__card-desc">Add common patterns in one tap. Duplicates are skipped.</p>
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

      <BlockingRuleCard
        title="Block by URL"
        subtitle="Block pages whose address contains…"
        empty="No URL rules yet"
        rules={urlRules}
        onAdd={() => setModalType('url_contains')}
        onToggle={handleToggle}
        onDelete={handleDelete}
      />

      <BlockingRuleCard
        title="Block by search keyword"
        subtitle="Block search queries (Google, etc.) that contain…"
        empty="No search keyword rules yet"
        rules={searchRules}
        onAdd={() => setModalType('search_contains')}
        onToggle={handleToggle}
        onDelete={handleDelete}
      />

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

function BlockingRuleCard({
  title,
  subtitle,
  empty,
  rules,
  onAdd,
  onToggle,
  onDelete,
}: {
  title: string
  subtitle: string
  empty: string
  rules: CustomBlockingRule[]
  onAdd: () => void
  onToggle: (r: CustomBlockingRule) => void
  onDelete: (r: CustomBlockingRule) => void
}) {
  return (
    <div className="blocking-tab__card">
      <div className="blocking-tab__card-head">
        <div>
          <h3 className="blocking-tab__card-title">{title}</h3>
          <p className="blocking-tab__card-desc">{subtitle}</p>
        </div>
        <button type="button" className="boundaries-view__add-btn" onClick={onAdd}>
          + Add rule
        </button>
      </div>

      {rules.length === 0 ? (
        <p className="blocking-tab__empty">{empty}</p>
      ) : (
        <ul className="blocking-tab__list">
          {rules.map((rule) => (
            <li key={rule.id} className="blocking-tab__row">
              <div className="blocking-tab__row-main">
                <code className="blocking-tab__value">{rule.value}</code>
                <span className="blocking-tab__chip">Contains</span>
                <span className="blocking-tab__chip blocking-tab__chip--muted">{commitmentLabel(rule)}</span>
                {rule.note && <p className="blocking-tab__note">&ldquo;{rule.note}&rdquo;</p>}
                {isLockActive(rule) && rule.locked_until && (
                  <p className="blocking-tab__lock">Locked until {new Date(rule.locked_until).toLocaleString()}</p>
                )}
              </div>
              <div className="blocking-tab__row-actions">
                <label className="blocking-tab__toggle">
                  <input
                    type="checkbox"
                    checked={rule.is_active}
                    disabled={isLockActive(rule)}
                    onChange={() => onToggle(rule)}
                  />
                  <span>Active</span>
                </label>
                <button
                  type="button"
                  className="blocking-tab__delete"
                  disabled={isLockActive(rule)}
                  onClick={() => onDelete(rule)}
                  title="Remove"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
