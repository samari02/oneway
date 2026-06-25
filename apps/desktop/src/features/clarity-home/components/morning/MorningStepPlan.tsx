import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlanItem, PlanItemKind } from '../../hooks/useMorningFlow'
import type { FocusArea } from '@oneway/shared'

const KIND_LABELS: Record<PlanItem['kind'], string> = {
  goal: 'Goals',
  task: 'Tasks',
  routine: 'Routines',
}

const DEFAULT_AREA = 'Other'

type PlanItemRowProps = {
  item: PlanItem
  selected: boolean
  onSelect: () => void
  onUpdate: (text: string) => void
  onDelete: () => void
}

function PlanItemRow({ item, selected, onSelect, onUpdate, onDelete }: PlanItemRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.text)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(item.text)
  }, [item.text, editing])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commitEdit = useCallback(() => {
    const trimmed = draft.trim()
    if (trimmed) {
      onUpdate(trimmed)
    } else {
      setDraft(item.text)
    }
    setEditing(false)
  }, [draft, item.text, onUpdate])

  const cancelEdit = useCallback(() => {
    setDraft(item.text)
    setEditing(false)
  }, [item.text])

  return (
    <div
      role="listitem"
      className={`mf-plan-item${selected ? ' mf-plan-item--priority' : ''}${editing ? ' mf-plan-item--editing' : ''}`}
    >
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          className="mf-plan-item__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitEdit()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              cancelEdit()
            }
          }}
          aria-label={`Edit ${item.kind}`}
        />
      ) : (
        <button
          type="button"
          className="mf-plan-item__select"
          onClick={onSelect}
          aria-pressed={selected}
        >
          <span className="mf-plan-item__text">{item.text}</span>
          {selected && (
            <span className="mf-plan-item__star" aria-label="Priority">
              ★
            </span>
          )}
        </button>
      )}

      <div className="mf-plan-item__actions">
        {!editing && (
          <button
            type="button"
            className="mf-plan-item__action"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${item.text}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
        <button
          type="button"
          className="mf-plan-item__action mf-plan-item__action--delete"
          onClick={onDelete}
          aria-label={`Remove ${item.text}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

type AddItemRowProps = {
  kind: PlanItemKind
  label: string
  area?: string
  onAdd: (text: string) => void
}

function AddItemRow({ kind, label, area, onAdd }: AddItemRowProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const handleAdd = useCallback(() => {
    const trimmed = draft.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setDraft('')
    setOpen(false)
  }, [draft, onAdd])

  if (!open) {
    return (
      <button type="button" className="mf-plan-add" onClick={() => setOpen(true)}>
        + Add {label.toLowerCase().replace(/s$/, '')}
      </button>
    )
  }

  return (
    <div className="mf-plan-add-row">
      <input
        ref={inputRef}
        type="text"
        className="mf-plan-item__input mf-plan-add-row__input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={`New ${kind}${area ? ` (${area})` : ''}…`}
        aria-label={`Add ${kind}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            handleAdd()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            setDraft('')
            setOpen(false)
          }
        }}
      />
      <button type="button" className="mf-btn mf-btn--ghost mf-btn--sm" onClick={handleAdd} disabled={!draft.trim()}>
        Add
      </button>
      <button
        type="button"
        className="mf-plan-item__action"
        onClick={() => {
          setDraft('')
          setOpen(false)
        }}
        aria-label="Cancel"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

type MorningStepPlanProps = {
  items: PlanItem[]
  priorityItemId?: string
  onPrioritySelect: (itemId: string) => void
  onConfirmPriority: (itemId?: string) => boolean
  onUpdateItem: (id: string, text: string) => void
  onDeleteItem: (id: string) => void
  onAddItem: (kind: PlanItemKind, text: string, area?: string) => void
  focusAreas?: FocusArea[]
}

export function MorningStepPlan({
  items,
  priorityItemId,
  onPrioritySelect,
  onConfirmPriority,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  focusAreas,
}: MorningStepPlanProps) {
  const areaGroups = items.reduce<Map<string, PlanItem[]>>((acc, item) => {
    const area = item.area?.trim() || DEFAULT_AREA
    const list = acc.get(area) ?? []
    list.push(item)
    acc.set(area, list)
    return acc
  }, new Map())

  const resolveAreaLabel = (areaKey: string): string => {
    if (!focusAreas || focusAreas.length === 0) return areaKey
    const match = focusAreas.find(
      (fa) => fa.id === areaKey || fa.label.toLowerCase() === areaKey.toLowerCase(),
    )
    return match ? `${match.emoji ?? ''} ${match.label}`.trim() : areaKey
  }

  const sortedAreas = [...areaGroups.keys()].sort((a, b) => {
    if (a === DEFAULT_AREA) return 1
    if (b === DEFAULT_AREA) return -1
    if (focusAreas && focusAreas.length > 0) {
      const orderA = focusAreas.find((fa) => fa.id === a || fa.label.toLowerCase() === a.toLowerCase())?.display_order ?? 99
      const orderB = focusAreas.find((fa) => fa.id === b || fa.label.toLowerCase() === b.toLowerCase())?.display_order ?? 99
      return orderA - orderB
    }
    return a.localeCompare(b)
  })

  return (
    <div className="mf-plan-step">
      <p className="mf-plan-step__lead">Here&apos;s your plan for today.</p>

      <section className="mf-plan-review" aria-labelledby="mf-plan-review-heading">
        <h2 id="mf-plan-review-heading" className="sr-only">
          Today&apos;s plan
        </h2>

        <div className="mf-plan-groups">
          {sortedAreas.map((area) => (
            <div key={area} className="mf-plan-group">
              <h3 className="mf-plan-group__label">{resolveAreaLabel(area)}</h3>
              <div className="mf-plan-group__items" role="list">
                {areaGroups.get(area)?.map((item) => (
                  <PlanItemRow
                    key={item.id}
                    item={item}
                    selected={priorityItemId === item.id}
                    onSelect={() => onPrioritySelect(item.id)}
                    onUpdate={(text) => onUpdateItem(item.id, text)}
                    onDelete={() => onDeleteItem(item.id)}
                  />
                ))}
              </div>
              <AddItemRow
                kind="goal"
                label="goal"
                area={area}
                onAdd={(text) => onAddItem('goal', text, area)}
              />
            </div>
          ))}
        </div>

        <div className="mf-plan-priority">
          <p className="mf-plan-priority__question">Which one should we protect first?</p>
          <p className="mf-plan-priority__hint">
            {priorityItemId ? 'Tap another to change your focus.' : 'Select a goal to continue.'}
          </p>
        </div>
      </section>

      <div className="mf-shell__footer-actions">
        <button
          type="button"
          className="mf-btn mf-btn--primary mf-btn--wide"
          onClick={() => onConfirmPriority(priorityItemId)}
          disabled={!priorityItemId}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

export { KIND_LABELS }
