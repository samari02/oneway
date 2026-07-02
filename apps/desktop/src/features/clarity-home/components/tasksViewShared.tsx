import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { TaskPlanning } from '@oneway/shared'

export const PLANNING_LABELS: Record<TaskPlanning, string> = {
  today: 'Today',
  next: 'Next',
  later: 'Later',
  backlog: 'Backlog',
}

export const PLANNING_COLORS: Record<TaskPlanning, string> = {
  today: '#22c55e',
  next: '#3b82f6',
  later: '#94a3b8',
  backlog: '#64748b',
}

export const PLANNING_CYCLE: TaskPlanning[] = ['today', 'next', 'later', 'backlog']

export const CATEGORY_COLORS = [
  '#7c3aed', '#f97316', '#22c55e', '#3b82f6',
  '#ec4899', '#eab308', '#06b6d4', '#f43f5e',
]

export type HierarchyItem = {
  id: string
  label: string
  emoji?: string | null
  color?: string
}

export function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function PlusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden>
      <circle cx="2.5" cy="2" r="1.2" />
      <circle cx="7.5" cy="2" r="1.2" />
      <circle cx="2.5" cy="7" r="1.2" />
      <circle cx="7.5" cy="7" r="1.2" />
      <circle cx="2.5" cy="12" r="1.2" />
      <circle cx="7.5" cy="12" r="1.2" />
    </svg>
  )
}

export function SortAlphaIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 4h6M9 4v16M7 18h4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 8h5M17.5 8v10M16 16h3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M9 7V5h6v2M10 11v6M14 11v6M6 7l1 12h10l1-12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function FocusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function planningStyle(planning: TaskPlanning): CSSProperties {
  return { '--tasks-plan-color': PLANNING_COLORS[planning] } as CSSProperties
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export type InlineEditableLabelHandle = {
  startEditing: () => void
}

export const InlineEditableLabel = forwardRef<
  InlineEditableLabelHandle,
  {
    value: string
    onSave: (next: string) => void
    className?: string
    inputClassName?: string
    ariaLabel: string
  }
>(function InlineEditableLabel(
  { value, onSave, className, inputClassName, ariaLabel },
  ref,
) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    startEditing: () => setEditing(true),
  }), [])

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commitEdit = () => {
    const next = draft.trim()
    if (!next) {
      setDraft(value)
      setEditing(false)
      return
    }
    if (next !== value) onSave(next)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={inputClassName}
        value={draft}
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitEdit()
          if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
        onBlur={commitEdit}
      />
    )
  }

  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
    >
      {value}
    </button>
  )
})
