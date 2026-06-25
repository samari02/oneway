import { useState, useCallback, type CSSProperties } from 'react'
import type { FocusArea } from '@oneway/shared'
import './FocusAreaManager.css'

type FocusAreaManagerProps = {
  activeAreas: FocusArea[]
  archivedAreas: FocusArea[]
  onAdd: (label: string, emoji?: string, color?: string) => Promise<FocusArea | null>
  onEdit: (id: string, updates: { label?: string; emoji?: string; color?: string }) => Promise<void>
  onArchive: (id: string) => Promise<void>
  onReactivate: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const DEFAULT_COLORS = [
  '#7c3aed', '#f97316', '#22c55e', '#3b82f6',
  '#ec4899', '#eab308', '#06b6d4', '#f43f5e',
]

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function ArchiveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  )
}

function RestoreIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  )
}

type AreaRowProps = {
  area: FocusArea
  onEdit: () => void
  onArchive: () => void
  onReactivate?: () => void
}

function AreaRow({ area, onEdit, onArchive, onReactivate }: AreaRowProps) {
  const isArchived = area.status === 'archived'
  return (
    <div className={`fa-mgr__row${isArchived ? ' fa-mgr__row--archived' : ''}`}>
      <span
        className="fa-mgr__row-dot"
        style={{ '--fa-color': area.color ?? '#7c3aed' } as CSSProperties}
        aria-hidden
      >
        {area.emoji ?? '•'}
      </span>
      <span className="fa-mgr__row-label">{area.label}</span>
      <span className="fa-mgr__row-meta">
        {area.mention_count > 0 && `${area.mention_count} mentions`}
      </span>
      <div className="fa-mgr__row-actions">
        {!isArchived && (
          <>
            <button type="button" className="fa-mgr__icon-btn" onClick={onEdit} aria-label="Edit">
              <EditIcon />
            </button>
            <button type="button" className="fa-mgr__icon-btn" onClick={onArchive} aria-label="Archive">
              <ArchiveIcon />
            </button>
          </>
        )}
        {isArchived && onReactivate && (
          <button type="button" className="fa-mgr__icon-btn" onClick={onReactivate} aria-label="Reactivate">
            <RestoreIcon />
          </button>
        )}
      </div>
    </div>
  )
}

export function FocusAreaManager({
  activeAreas,
  archivedAreas,
  onAdd,
  onEdit,
  onArchive,
  onReactivate,
  onDelete,
}: FocusAreaManagerProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newEmoji, setNewEmoji] = useState('')
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editEmoji, setEditEmoji] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const handleAdd = useCallback(async () => {
    if (!newLabel.trim()) return
    await onAdd(newLabel.trim(), newEmoji || undefined, newColor)
    setNewLabel('')
    setNewEmoji('')
    setShowAdd(false)
  }, [newLabel, newEmoji, newColor, onAdd])

  const startEdit = (area: FocusArea) => {
    setEditingId(area.id)
    setEditLabel(area.label)
    setEditEmoji(area.emoji ?? '')
  }

  const commitEdit = useCallback(async () => {
    if (!editingId || !editLabel.trim()) return
    await onEdit(editingId, {
      label: editLabel.trim(),
      emoji: editEmoji || undefined,
    })
    setEditingId(null)
  }, [editingId, editLabel, editEmoji, onEdit])

  return (
    <div className="fa-mgr">
      <div className="fa-mgr__header">
        <h3 className="fa-mgr__title">Focus Areas</h3>
        <p className="fa-mgr__desc">
          Your personal areas of focus. Monk uses these to organize goals.
        </p>
      </div>

      <div className="fa-mgr__list">
        {activeAreas.length === 0 && !showAdd && (
          <p className="fa-mgr__empty">
            No focus areas yet. They&apos;ll emerge as you use Clarity, or you can add some now.
          </p>
        )}

        {activeAreas.map((area) =>
          editingId === area.id ? (
            <div key={area.id} className="fa-mgr__edit-row">
              <input
                type="text"
                className="fa-mgr__input fa-mgr__input--emoji"
                value={editEmoji}
                onChange={(e) => setEditEmoji(e.target.value)}
                placeholder="🎯"
                maxLength={2}
              />
              <input
                type="text"
                className="fa-mgr__input"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit()
                  if (e.key === 'Escape') setEditingId(null)
                }}
                autoFocus
              />
              <button type="button" className="fa-mgr__btn fa-mgr__btn--sm" onClick={commitEdit}>
                Save
              </button>
              <button
                type="button"
                className="fa-mgr__btn fa-mgr__btn--ghost fa-mgr__btn--sm"
                onClick={() => setEditingId(null)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <AreaRow
              key={area.id}
              area={area}
              onEdit={() => startEdit(area)}
              onArchive={() => onArchive(area.id)}
            />
          ),
        )}
      </div>

      {showAdd ? (
        <div className="fa-mgr__add-form">
          <div className="fa-mgr__add-inputs">
            <input
              type="text"
              className="fa-mgr__input fa-mgr__input--emoji"
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
              placeholder="🎯"
              maxLength={2}
            />
            <input
              type="text"
              className="fa-mgr__input"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Focus area name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
                if (e.key === 'Escape') setShowAdd(false)
              }}
              autoFocus
            />
          </div>
          <div className="fa-mgr__color-picker">
            {DEFAULT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`fa-mgr__color-swatch${newColor === c ? ' fa-mgr__color-swatch--active' : ''}`}
                style={{ background: c }}
                onClick={() => setNewColor(c)}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <div className="fa-mgr__add-actions">
            <button type="button" className="fa-mgr__btn" onClick={handleAdd} disabled={!newLabel.trim()}>
              Add
            </button>
            <button type="button" className="fa-mgr__btn fa-mgr__btn--ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="fa-mgr__add-trigger" onClick={() => setShowAdd(true)}>
          + Add focus area
        </button>
      )}

      {archivedAreas.length > 0 && (
        <div className="fa-mgr__archived">
          <button
            type="button"
            className="fa-mgr__archived-toggle"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? 'Hide' : 'Show'} archived ({archivedAreas.length})
          </button>
          {showArchived && (
            <div className="fa-mgr__list fa-mgr__list--archived">
              {archivedAreas.map((area) => (
                <AreaRow
                  key={area.id}
                  area={area}
                  onEdit={() => startEdit(area)}
                  onArchive={() => onDelete(area.id)}
                  onReactivate={() => onReactivate(area.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
