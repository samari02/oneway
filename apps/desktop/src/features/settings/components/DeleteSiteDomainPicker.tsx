import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import './DeleteSiteDomainPicker.css'

function normalizeDomainInput(raw: string): string {
  let s = raw.trim().toLowerCase()
  s = s.replace(/^https?:\/\//, '')
  s = s.split('/')[0] ?? ''
  s = s.replace(/^www\./, '')
  return s
}

function parseDeleteStats(result: unknown) {
  const r = result as Record<string, unknown>
  return {
    visitsRemoved: Number(r.visitsRemoved ?? r.visits_removed ?? 0),
    blocksRemoved: Number(r.blocksRemoved ?? r.blocks_removed ?? 0),
    classificationRemoved: Boolean(r.classificationRemoved ?? r.classification_removed ?? false),
  }
}

interface DeleteSiteDomainPickerProps {
  onDataChanged?: () => void
}

export function DeleteSiteDomainPicker({ onDataChanged }: DeleteSiteDomainPickerProps) {
  const [domains, setDomains] = useState<string[]>([])
  const [domainsLoaded, setDomainsLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmDomain, setConfirmDomain] = useState<string | null>(null)
  const [status, setStatus] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadDomains = useCallback(async () => {
    try {
      const list = await invoke<string[]>('list_tracked_domains')
      setDomains(Array.isArray(list) ? list : [])
    } catch (e) {
      console.error('[DeleteSiteDomainPicker] list_tracked_domains', e)
      setStatus({ kind: 'err', text: `Could not load site list: ${String(e)}` })
    } finally {
      setDomainsLoaded(true)
    }
  }, [])

  useEffect(() => {
    void loadDomains()
  }, [loadDomains])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filteredSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return domains.filter((d) => d.includes(q)).slice(0, 50)
  }, [domains, query])

  const resolvedDomain = useMemo(() => {
    const n = normalizeDomainInput(query)
    if (!n) return ''
    if (domains.includes(n)) return n
    return n
  }, [query, domains])

  const pickDomain = (d: string) => {
    setQuery(d)
    setOpen(false)
    setStatus(null)
    inputRef.current?.focus()
  }

  const requestDelete = () => {
    const d = resolvedDomain
    if (!d) {
      setStatus({ kind: 'err', text: 'Enter or select a domain first.' })
      return
    }
    setConfirmDomain(d)
    setStatus(null)
  }

  const cancelConfirm = () => {
    setConfirmDomain(null)
  }

  const executeDelete = async () => {
    const domain = confirmDomain
    if (!domain) return
    setBusy(true)
    setStatus(null)
    try {
      const raw = await invoke<unknown>('delete_browsing_data_for_domain', { domain })
      const stats = parseDeleteStats(raw)
      const nothing =
        stats.visitsRemoved === 0 && stats.blocksRemoved === 0 && !stats.classificationRemoved
      const text = nothing
        ? `No rows matched “${domain}”. Nothing was removed — pick an exact domain from the list, or check spelling.`
        : `Done. Removed ${stats.visitsRemoved} visit row(s), ${stats.blocksRemoved} block event(s).` +
          (stats.classificationRemoved ? ' Saved classification cleared.' : '')
      setStatus({
        kind: nothing ? 'info' : 'ok',
        text,
      })
      setConfirmDomain(null)
      setQuery('')
      setOpen(false)
      await loadDomains()
      onDataChanged?.()
    } catch (e) {
      console.error('[DeleteSiteDomainPicker] delete_browsing_data_for_domain', e)
      setStatus({ kind: 'err', text: `Delete failed: ${String(e)}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="delete-site-picker" ref={wrapRef}>
      <p className="settings-section__hint delete-site-picker__hint">
        Type at least two letters to see matching sites from your stored data, click one to select it, then use
        &quot;Delete site data…&quot; and confirm. You can also type a full domain manually.
      </p>
      {domainsLoaded && domains.length === 0 && (
        <p className="delete-site-picker__status delete-site-picker__status--info" role="status">
          No sites in local history yet. Use the extension to sync visits, then tap &quot;Refresh list&quot;.
        </p>
      )}

      <div className="delete-site-picker__row">
        <div className="delete-site-picker__field">
          <input
            ref={inputRef}
            type="text"
            className="settings-api-key__input delete-site-picker__input"
            placeholder="e.g. git or github.com"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
              setStatus(null)
            }}
            onFocus={() => {
              if (query.trim().length >= 2) setOpen(true)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false)
                setConfirmDomain(null)
              }
            }}
            disabled={busy}
            autoComplete="off"
            aria-expanded={open}
            aria-controls="delete-site-suggestions"
          />
          {open && filteredSuggestions.length > 0 && (
            <ul id="delete-site-suggestions" className="delete-site-picker__dropdown" role="listbox">
              {filteredSuggestions.map((d) => (
                <li key={d}>
                  <button
                    type="button"
                    className="delete-site-picker__option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickDomain(d)}
                  >
                    {d}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          className="settings-button settings-button--small"
          onClick={() => void loadDomains()}
          disabled={busy}
          title="Refresh list from disk"
        >
          Refresh list
        </button>
      </div>

      {confirmDomain ? (
        <div className="delete-site-picker__confirm" role="alert">
          <p>
            Remove all visits, block events, and saved classification for <strong>{confirmDomain}</strong> on this
            Mac?
          </p>
          <div className="delete-site-picker__confirm-actions">
            <button type="button" className="settings-button settings-button--small" onClick={cancelConfirm} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="settings-button settings-button--small settings-button--danger"
              onClick={() => void executeDelete()}
              disabled={busy}
            >
              {busy ? 'Removing…' : 'Yes, delete forever'}
            </button>
          </div>
        </div>
      ) : (
        <div className="delete-site-picker__actions">
          <button
            type="button"
            className="settings-button settings-button--small settings-button--danger"
            disabled={busy || !resolvedDomain}
            onClick={requestDelete}
          >
            Delete site data…
          </button>
        </div>
      )}

      {status && (
        <p
          className={`delete-site-picker__status delete-site-picker__status--${status.kind}`}
          role="status"
        >
          {status.text}
        </p>
      )}
    </div>
  )
}
