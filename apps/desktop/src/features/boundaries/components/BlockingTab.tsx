import { useMemo, useState, type FormEvent } from 'react'
import type { CustomBlockingRule } from '@oneway/shared'
import { inferBlockingRuleType, normalizeUrlBlockingValue } from '../api/customBlockingRules'
import { useCustomBlockingRules } from '../hooks/useCustomBlockingRules'
import { useBlockingLock } from '../hooks/useBlockingLock'
import { BlockingLockPanel } from './BlockingLockPanel'
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
  {
    id: 'adult',
    label: 'Adult Content',
    values: [
      // Global tubes / networks
      'pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com',
      'redtube.com', 'youporn.com', 'spankbang.com', 'beeg.com',
      'hqporner.com', 'eporner.com', 'motherless.com', 'gotporn.com',
      'onlyfans.com', 'fansly.com', 'loyalfans.com',
      'chaturbate.com', 'stripchat.com', 'livejasmin.com',
      'cam4.com', 'bongacams.com', 'myfreecams.com', 'jerkmate.com',
      'brazzers.com', 'bangbros.com', 'realitykings.com', 'teamskeet.com',
      'blacked.com', 'vixen.com', 'adulttime.com', 'bang.com',
      // Hentai / imageboards
      'nhentai.net', 'e-hentai.org', 'hanime.tv', 'hentaihaven.xxx',
      'hentaifox.com', 'rule34.xxx', 'gelbooru.com', 'fakku.net',
      // Japanese AV / tubes / aggregators
      'missav.com', 'missav.ws', 'javlibrary.com', 'javdb.com', 'javbus.com',
      'javgg.net', 'njav.tv', 'jable.tv', 'avgle.com', 'netflav.com',
      '123av.com', 'av01.tv', '7mmtv.sx', 'hpjav.tv', 'supjav.com',
      'caribbeancom.com', '1pondo.tv', 'heyzo.com', 'tokyo-hot.com',
      'r18.com', 'mgstage.com', 'dmm.co.jp', 'fanza.tv', 'fc2.com',
      'fc2ppvdb.com', 'prestige-av.com', 'sod.co.jp', 's1s1s1.com',
      'faleno.jp', 'moodyz.com', 'xcity.jp', 'erovideo.jp', 'duga.jp',
      'sokmil.com', 'dxlive.com', 'chatpia.jp', 'nijie.info',
    ],
  },
]

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

function ruleTypeLabel(rule: CustomBlockingRule): string {
  return rule.rule_type === 'url_contains' ? 'URL' : 'Search'
}

function filterRulesBySearch(rules: CustomBlockingRule[], query: string): CustomBlockingRule[] {
  const s = query.trim().toLowerCase()
  if (!s) return rules
  return rules.filter((r) => {
    const blob = [r.value, r.note ?? '', ruleTypeLabel(r), r.match_mode].join(' ').toLowerCase()
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
    optimisticToggle,
  } = useCustomBlockingRules(userId)

  const [addInput, setAddInput] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [addSaving, setAddSaving] = useState(false)
  const [presetBusy, setPresetBusy] = useState<string | null>(null)
  const [filterQuery, setFilterQuery] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const {
    status: lockStatus,
    loading: lockLoading,
    setPassword: setLockPassword,
    setFrictionLock,
    unlock: unlockBlocking,
    relock: relockBlocking,
    clearLock,
    frictionStart,
    frictionSubmit,
  } = useBlockingLock()

  const canManageDestructive =
    !lockLoading && (lockStatus?.canManageDestructive ?? true)

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
      const mode = inferBlockingRuleType(raw)
      if (mode === 'url_contains') {
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
        }))
      )
    } catch {
      refetch(true)
    } finally {
      setPresetBusy(null)
    }
  }

  const handleToggle = async (rule: CustomBlockingRule) => {
    const next = !rule.is_active
    if (!next && !canManageDestructive) {
      return
    }
    optimisticToggle(rule.id, next)
    try {
      await updateRule(rule.id, { is_active: next })
    } catch {
      refetch(true)
    }
  }

  const handleRemove = async (rule: CustomBlockingRule) => {
    if (!canManageDestructive) {
      return
    }
    setRemoveError(null)
    setRemovingId(rule.id)
    try {
      await removeRule(rule.id)
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : 'Could not remove rule')
      await refetch(true)
    } finally {
      setRemovingId(null)
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
        <h2 className="blocking-tab__title">Your block list</h2>
        <p className="blocking-tab__lede">
          Add sites (for example <span className="blocking-tab__lede-mono">reddit.com</span>) or search keywords. Rules apply
          in Chrome when the extension is on, and they stay in sync with your account.
        </p>
        <p className="blocking-tab__sync">
          <span className="blocking-tab__sync-label">Last synced:</span>{' '}
          <span className="blocking-tab__sync-time">{formatSyncedAt(lastSyncedAt)}</span>
        </p>
      </div>

      <BlockingLockPanel
        status={lockStatus}
        loading={lockLoading}
        setPassword={setLockPassword}
        setFrictionLock={setFrictionLock}
        unlock={unlockBlocking}
        relock={relockBlocking}
        clearLock={clearLock}
        frictionStart={frictionStart}
        frictionSubmit={frictionSubmit}
      />

      {error && (
        <div className="blocking-tab__banner blocking-tab__banner--error">
          {error.message}
          <button type="button" className="blocking-tab__retry" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}

      {removeError && (
        <div className="blocking-tab__banner blocking-tab__banner--error" role="alert">
          {removeError}
          <button type="button" className="blocking-tab__retry" onClick={() => setRemoveError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <form className="blocking-tab__add-row" onSubmit={handleAdd}>
        <div className="blocking-tab__add-row-inner" role="group" aria-label="Add blocking rule">
          <input
            type="text"
            className="blocking-tab__add-input blocking-tab__add-input--grow"
            value={addInput}
            onChange={(e) => {
              setAddInput(e.target.value)
              setAddError(null)
            }}
            placeholder="Site (reddit.com, /shorts) or search words (no spaces)…"
            autoComplete="off"
            aria-label="Block a site or search keyword"
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
                  <th>Blocking</th>
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
                    </td>
                    <td>
                      <label className="blocking-tab__toggle-inline">
                        <input
                          type="checkbox"
                          checked={rule.is_active}
                          disabled={!canManageDestructive && rule.is_active}
                          onChange={() => handleToggle(rule)}
                          aria-label={rule.is_active ? 'Blocking on; click to pause' : 'Blocking off; click to enforce'}
                        />
                        <span className="blocking-tab__blocking-label">
                          {rule.is_active ? 'On' : 'Off'}
                        </span>
                      </label>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="blocking-tab__table-remove"
                        disabled={removingId === rule.id || !canManageDestructive}
                        onClick={() => void handleRemove(rule)}
                      >
                        {removingId === rule.id ? '…' : 'Remove'}
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
