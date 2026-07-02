import {
  useMemo,
  useRef,
  useState,
  useEffect,
  useCallback,
  Fragment,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, TaskPlanning } from '@oneway/shared'
import { useAuth } from '@/features/auth'
import {
  PLANNING_COLUMNS,
  compareTasksByOrder,
  groupTasksByPlanning,
  useTaskStore,
} from '../hooks/useTaskStore'
import { useCategoryStore } from '../hooks/useCategoryStore'
import { useFocusAreaStore } from '../hooks/useFocusAreaStore'
import { useCurrentFocus } from '../hooks/useCurrentFocus'
import { CategoryIcon } from './CategoryIcon'
import { HierarchyView } from './HierarchyView'
import { OrganizeModal, type OrganizeApplyAction } from './OrganizeModal'
import type { BucketContext, SubContext } from '../api/suggestTaskOrganization'
import {
  CheckIcon,
  PlusIcon,
  TrashIcon,
  GripIcon,
  FocusIcon,
  SortAlphaIcon,
  InlineEditableLabel,
  type InlineEditableLabelHandle,
  PLANNING_LABELS,
  PLANNING_COLORS,
  PLANNING_CYCLE,
  CATEGORY_COLORS,
} from './tasksViewShared'
import { TasksContextMenu, useTasksContextMenu } from './TasksContextMenu'
import './TasksView.css'

type ViewLayout = 'hierarchy' | 'list' | 'board' | 'completed'
type SortMode = 'manual' | 'alphabetical' | 'created_at'
type TodayLoadLevel = 'light' | 'neutral' | 'overloaded'

const MAX_PLAN_TODAY_PICK = 3

const LIST_BUCKET_PREFIX = 'list-bucket:'
const LIST_SUB_PREFIX = 'list-sub:'
const LIST_TASK_PREFIX = 'list-task:'
const LIST_COLLAPSE_STORAGE_KEY = 'clarity-tasks-list-collapse'

type ListCollapseState = {
  buckets: string[]
  subs: string[]
}

function loadListCollapseState(): ListCollapseState {
  try {
    const raw = localStorage.getItem(LIST_COLLAPSE_STORAGE_KEY)
    if (!raw) return { buckets: [], subs: [] }
    const parsed = JSON.parse(raw) as Partial<ListCollapseState>
    return {
      buckets: Array.isArray(parsed.buckets) ? parsed.buckets.filter((id) => typeof id === 'string') : [],
      subs: Array.isArray(parsed.subs) ? parsed.subs.filter((id) => typeof id === 'string') : [],
    }
  } catch {
    return { buckets: [], subs: [] }
  }
}

function ListChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ListChevronButton({
  expanded,
  onToggle,
  label,
}: {
  expanded: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      type="button"
      className={`tasks-view__list-chevron${expanded ? ' tasks-view__list-chevron--expanded' : ''}`}
      aria-expanded={expanded}
      aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      <ListChevronIcon />
    </button>
  )
}

type ColumnMeta = {
  id: string
  label: string
  color: string
  emoji?: string | null
  planning?: TaskPlanning
}

type HierarchyMeta = {
  label: string
  color: string
  bucketLabel: string
  subLabel: string
  badge: string
}

type CategoryOption = { id: string; label: string; bucketId?: string | null }

function sortTasksWithinCategory(tasks: Task[], sortBy: SortMode): Task[] {
  if (sortBy === 'manual') return [...tasks].sort(compareTasksByOrder)
  return sortTasksList(tasks, sortBy)
}

function ListSortButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="tasks-view__list-sort-btn"
      aria-label={`Sort ${label} alphabetically`}
      title={`Sort ${label} A–Z`}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <SortAlphaIcon />
    </button>
  )
}
function sortTasksList(tasks: Task[], sortBy: SortMode): Task[] {
  if (sortBy === 'manual') return tasks
  const copy = [...tasks]
  if (sortBy === 'alphabetical') {
    return copy.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
  }
  return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

function findContainerId(
  id: UniqueIdentifier,
  items: Record<string, string[]>,
): string | undefined {
  if (id in items) return String(id)
  return Object.keys(items).find((key) => items[key].includes(String(id)))
}

function isWithinLastDays(isoDate: string | undefined, days: number): boolean {
  if (!isoDate) return false
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return new Date(isoDate).getTime() >= cutoff
}

function getTodayLoadLevel(count: number): TodayLoadLevel {
  if (count <= 3) return 'light'
  if (count <= 5) return 'neutral'
  return 'overloaded'
}

function SortableTaskCard({
  task,
  planningColor,
  categoryColor,
  hierarchyMeta,
  categoryOptions,
  showHierarchyBadge,
  showPlanningDot,
  showFocusButton,
  showPlanningBadge,
  onToggle,
  onSaveTitle,
  onDelete,
  onCategoryChange,
  onCyclePlanning,
  onFocus,
  openContextMenu,
}: {
  task: Task
  planningColor?: string
  categoryColor: string
  hierarchyMeta: HierarchyMeta
  categoryOptions: CategoryOption[]
  showHierarchyBadge: boolean
  showPlanningDot: boolean
  showFocusButton: boolean
  showPlanningBadge: boolean
  onToggle: () => void
  onSaveTitle: (title: string) => void
  onDelete: () => void
  onCategoryChange: (categoryId: string) => void
  onCyclePlanning?: () => void
  onFocus?: () => void
  openContextMenu: ReturnType<typeof useTasksContextMenu>['openMenu']
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const inputRef = useRef<HTMLInputElement>(null)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  useEffect(() => {
    if (!editing) setDraft(task.title)
  }, [task.title, editing])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commitEdit = () => {
    const next = draft.trim()
    if (!next) {
      setDraft(task.title)
      setEditing(false)
      return
    }
    if (next !== task.title) onSaveTitle(next)
    setEditing(false)
  }

  const planning = task.planning ?? 'backlog'

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.25 : 1,
  }

  const handleContextMenu = (event: MouseEvent) => {
    openContextMenu(event, [
      { id: 'delete', label: 'Delete', danger: true, onSelect: onDelete },
    ])
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`tasks-view__card${isDragging ? ' tasks-view__card--dragging' : ''}${isDragging ? '' : ' tasks-view__card--snap'}`}
      data-planning={planning}
      onContextMenu={handleContextMenu}
    >
      <button
        type="button"
        className="tasks-view__drag-handle tasks-view__card-hover"
        aria-label={`Drag ${task.title}`}
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>

      <button
        type="button"
        className="tasks-view__checkbox"
        role="checkbox"
        aria-checked={false}
        aria-label={`Mark "${task.title}" as done`}
        onClick={onToggle}
      >
        <CheckIcon />
      </button>

      {showPlanningDot && planningColor && (
        <span
          className="tasks-view__planning-dot"
          style={{ '--tasks-plan-color': planningColor } as CSSProperties}
          title={PLANNING_LABELS[planning]}
          aria-hidden
        />
      )}

      {editing ? (
        <input
          ref={inputRef}
          className="tasks-view__task-input"
          value={draft}
          aria-label="Edit task title"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit()
            if (e.key === 'Escape') {
              setDraft(task.title)
              setEditing(false)
            }
          }}
          onBlur={commitEdit}
        />
      ) : (
        <button type="button" className="tasks-view__task-title" onClick={() => setEditing(true)}>
          {task.title}
        </button>
      )}

      {showHierarchyBadge ? (
        <span
          className="tasks-view__badge tasks-view__badge--category"
          style={{ '--tasks-cat-color': categoryColor } as CSSProperties}
          title={hierarchyMeta.badge}
        >
          {hierarchyMeta.badge}
        </span>
      ) : (
        <span
          className="tasks-view__category-dot"
          style={{ '--tasks-cat-color': categoryColor } as CSSProperties}
          title={hierarchyMeta.label}
          aria-hidden
        />
      )}

      <select
        className="tasks-view__card-select tasks-view__card-hover"
        value={task.category}
        onChange={(e) => onCategoryChange(e.target.value)}
        aria-label="Change sub-category"
      >
        {categoryOptions.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>

      {showPlanningBadge && (
        <button
          type="button"
          className={`tasks-view__badge tasks-view__badge--planning tasks-view__badge--planning-${planning} tasks-view__card-hover`}
          onClick={onCyclePlanning}
          title="Click to change planning horizon"
        >
          {PLANNING_LABELS[planning]}
        </button>
      )}

      {showFocusButton && onFocus && (
        <button
          type="button"
          className="tasks-view__focus-btn tasks-view__card-hover"
          aria-label={`Focus on "${task.title}"`}
          title="Start focus timer"
          onClick={onFocus}
        >
          <FocusIcon />
        </button>
      )}

      <button
        type="button"
        className="tasks-view__delete tasks-view__card-hover"
        aria-label={`Delete "${task.title}"`}
        onClick={onDelete}
      >
        <TrashIcon />
      </button>
    </li>
  )
}

function ColumnQuickAdd({
  placeholder,
  onAdd,
}: {
  placeholder: string
  onAdd: (title: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const submit = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setTitle('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        className="tasks-view__column-add"
        onClick={() => setOpen(true)}
      >
        <PlusIcon />
        Add
      </button>
    )
  }

  return (
    <div className="tasks-view__column-add-form">
      <input
        ref={inputRef}
        type="text"
        className="tasks-view__column-add-input"
        placeholder={placeholder}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          }
          if (e.key === 'Escape') {
            setTitle('')
            setOpen(false)
          }
        }}
        aria-label={placeholder}
      />
      <button type="button" className="tasks-view__column-add-submit" onClick={submit} disabled={!title.trim()}>
        Add
      </button>
    </div>
  )
}

function PlanTodayModal({
  candidates,
  getHierarchyMeta,
  onClose,
  onConfirm,
}: {
  candidates: Task[]
  getHierarchyMeta: (task: Task) => HierarchyMeta
  onClose: () => void
  onConfirm: (ids: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= MAX_PLAN_TODAY_PICK) return prev
      return [...prev, id]
    })
  }

  return (
    <div className="tasks-view__modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="tasks-view__modal"
        role="dialog"
        aria-labelledby="plan-today-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="plan-today-title" className="tasks-view__modal-title">Plan today</h2>
        <p className="tasks-view__modal-desc">
          Pick up to {MAX_PLAN_TODAY_PICK} tasks from Next, Later, or Backlog to move into Today.
        </p>

        {candidates.length === 0 ? (
          <p className="tasks-view__modal-empty">No tasks available to plan. Add one in another column first.</p>
        ) : (
          <ul className="tasks-view__modal-list">
            {candidates.map((task) => {
              const meta = getHierarchyMeta(task)
              const planning = task.planning ?? 'backlog'
              const isSelected = selected.includes(task.id)
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    className={`tasks-view__modal-item${isSelected ? ' tasks-view__modal-item--selected' : ''}`}
                    onClick={() => toggle(task.id)}
                  >
                    <span
                      className="tasks-view__planning-dot"
                      style={{ '--tasks-plan-color': PLANNING_COLORS[planning] } as CSSProperties}
                      aria-hidden
                    />
                    <span className="tasks-view__modal-item-title">{task.title}</span>
                    <span
                      className="tasks-view__badge tasks-view__badge--category"
                      style={{ '--tasks-cat-color': meta.color } as CSSProperties}
                    >
                      {meta.badge}
                    </span>
                    <span className="tasks-view__modal-item-meta">{PLANNING_LABELS[planning]}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="tasks-view__modal-actions">
          <button type="button" className="tasks-view__add-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="tasks-view__add-submit"
            disabled={selected.length === 0}
            onClick={() => onConfirm(selected)}
          >
            Move to Today ({selected.length})
          </button>
        </div>
      </div>
    </div>
  )
}

function KanbanColumn({
  column,
  taskIds,
  tasksById,
  isPlanningColumn,
  todayLoadLevel,
  todayProgress,
  emptyAction,
  showPlanningDot,
  showFocusOnToday,
  showHierarchyBadge,
  categoryOptions,
  getHierarchyMeta,
  onToggle,
  onSaveTitle,
  onDelete,
  onCategoryChange,
  onCyclePlanning,
  onFocus,
  onQuickAdd,
  openContextMenu,
}: {
  column: ColumnMeta
  taskIds: string[]
  tasksById: Map<string, Task>
  isPlanningColumn: boolean
  todayLoadLevel?: TodayLoadLevel
  todayProgress?: { done: number; total: number }
  emptyAction?: { label: string; onClick: () => void }
  showPlanningDot: boolean
  showFocusOnToday: boolean
  showHierarchyBadge: boolean
  categoryOptions: CategoryOption[]
  getHierarchyMeta: (task: Task) => HierarchyMeta
  onToggle: (id: string) => void
  onSaveTitle: (id: string, title: string) => void
  onDelete: (id: string) => void
  onCategoryChange: (id: string, categoryId: string) => void
  onCyclePlanning?: (id: string) => void
  onFocus?: (task: Task) => void
  onQuickAdd: (title: string) => void
  openContextMenu: ReturnType<typeof useTasksContextMenu>['openMenu']
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const planning = column.planning
  const accentColor = planning ? PLANNING_COLORS[planning] : column.color

  const columnClass = [
    'tasks-view__column',
    isOver ? 'tasks-view__column--over' : '',
    isPlanningColumn && planning ? `tasks-view__column--plan-${planning}` : '',
    todayLoadLevel === 'light' ? 'tasks-view__column--load-light' : '',
    todayLoadLevel === 'overloaded' ? 'tasks-view__column--load-overloaded' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section
      ref={setNodeRef}
      className={columnClass}
      style={
        isPlanningColumn && planning
          ? ({ '--tasks-column-accent': accentColor } as CSSProperties)
          : undefined
      }
    >
      <header className="tasks-view__column-header">
        <span
          className="tasks-view__column-dot"
          style={{ '--tasks-cat-color': accentColor } as CSSProperties}
          aria-hidden
        >
          {column.emoji ? (
            <span className="tasks-view__column-emoji">{column.emoji}</span>
          ) : isPlanningColumn ? (
            <span className="tasks-view__column-plan-dot" />
          ) : (
            <CategoryIcon categoryId={column.id} size={14} />
          )}
        </span>
        <span className="tasks-view__column-label">{column.label}</span>
        <span className="tasks-view__column-count">{taskIds.length}</span>
      </header>

      {todayProgress && todayProgress.total > 0 && (
        <div className="tasks-view__today-progress">
          <div className="tasks-view__today-progress-track" aria-hidden>
            <div
              className="tasks-view__today-progress-fill"
              style={{ width: `${Math.round((todayProgress.done / todayProgress.total) * 100)}%` }}
            />
          </div>
          <span className="tasks-view__today-progress-label">
            {todayProgress.done}/{todayProgress.total} done
          </span>
        </div>
      )}

      {todayLoadLevel === 'overloaded' && (
        <p className="tasks-view__column-hint tasks-view__column-hint--warn">
          Overloaded? Move some → Next
        </p>
      )}

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <ul className="tasks-view__column-list">
          {taskIds.map((id) => {
            const task = tasksById.get(id)
            if (!task) return null
            const meta = getHierarchyMeta(task)
            const taskPlanning = task.planning ?? 'backlog'
            return (
              <SortableTaskCard
                key={id}
                task={task}
                planningColor={showPlanningDot ? PLANNING_COLORS[taskPlanning] : undefined}
                categoryColor={meta.color}
                hierarchyMeta={meta}
                categoryOptions={categoryOptions}
                showHierarchyBadge={showHierarchyBadge}
                showPlanningDot={showPlanningDot}
                showFocusButton={showFocusOnToday && taskPlanning === 'today'}
                showPlanningBadge={!isPlanningColumn}
                onToggle={() => onToggle(id)}
                onSaveTitle={(title) => onSaveTitle(id, title)}
                onDelete={() => onDelete(id)}
                onCategoryChange={(catId) => onCategoryChange(id, catId)}
                onCyclePlanning={onCyclePlanning ? () => onCyclePlanning(id) : undefined}
                onFocus={onFocus ? () => onFocus(task) : undefined}
                openContextMenu={openContextMenu}
              />
            )
          })}
        </ul>
      </SortableContext>

      {taskIds.length === 0 && (
        <div className="tasks-view__column-empty">
          {column.id === 'today' ? (
            <>
              <p className="tasks-view__column-hint">Nothing for today.</p>
              {emptyAction && (
                <button type="button" className="tasks-view__plan-btn" onClick={emptyAction.onClick}>
                  {emptyAction.label}
                </button>
              )}
            </>
          ) : (
            <p className="tasks-view__column-hint">Drag tasks here or add below</p>
          )}
        </div>
      )}

      <ColumnQuickAdd placeholder={`Add to ${column.label}…`} onAdd={onQuickAdd} />
    </section>
  )
}

function ListBucketRow({
  bucket,
  subCount,
  acceptSubDrop,
  acceptTaskDrop,
  expanded,
  onToggleExpand,
  onRename,
  onDelete,
  onSortAlphabetically,
  openContextMenu,
}: {
  bucket: { id: string; label: string; emoji?: string | null }
  subCount: number
  acceptSubDrop: boolean
  acceptTaskDrop: boolean
  expanded: boolean
  onToggleExpand: () => void
  onRename: (label: string) => void
  onDelete: () => void
  onSortAlphabetically: () => void
  openContextMenu: ReturnType<typeof useTasksContextMenu>['openMenu']
}) {
  const labelRef = useRef<InlineEditableLabelHandle>(null)
  const { setNodeRef, isOver } = useDroppable({ id: `${LIST_BUCKET_PREFIX}${bucket.id}` })
  const showOver = (acceptSubDrop || acceptTaskDrop) && isOver

  const handleContextMenu = (event: MouseEvent) => {
    openContextMenu(event, [
      { id: 'rename', label: 'Rename', onSelect: () => labelRef.current?.startEditing() },
      { id: 'delete', label: 'Delete', danger: true, onSelect: onDelete },
    ])
  }

  return (
    <tr
      ref={setNodeRef}
      className={`tasks-view__list-bucket${!expanded ? ' tasks-view__list-row--collapsed' : ''}${showOver ? ' tasks-view__list-bucket--over' : ''}`}
      onContextMenu={handleContextMenu}
    >
      <td className="tasks-view__list-cell tasks-view__list-cell--grip">
        <ListChevronButton expanded={expanded} onToggle={onToggleExpand} label={bucket.label} />
      </td>
      <td className="tasks-view__list-cell tasks-view__list-bucket-label" colSpan={6}>
        <span className="tasks-view__list-bucket-icon" aria-hidden>
          {bucket.emoji ? (
            <span className="tasks-view__list-bucket-emoji">{bucket.emoji}</span>
          ) : (
            <CategoryIcon categoryId={bucket.id} size={14} />
          )}
        </span>
        <InlineEditableLabel
          ref={labelRef}
          value={bucket.label}
          onSave={onRename}
          className="tasks-view__list-bucket-name tasks-view__list-bucket-name--editable"
          inputClassName="tasks-view__task-input tasks-view__list-bucket-input"
          ariaLabel={`Edit bucket name "${bucket.label}"`}
        />
        <span className="tasks-view__list-bucket-meta">
          {subCount} sub{subCount === 1 ? '' : 's'}
        </span>
        <ListSortButton label={bucket.label} onClick={onSortAlphabetically} />
      </td>
    </tr>
  )
}

function ListSubRow({
  sub,
  taskCount,
  acceptTaskDrop,
  expanded,
  onToggleExpand,
  onRename,
  onDelete,
  onSortAlphabetically,
  openContextMenu,
}: {
  sub: { id: string; label: string; color?: string }
  taskCount: number
  acceptTaskDrop: boolean
  expanded: boolean
  onToggleExpand: () => void
  onRename: (label: string) => void
  onDelete: () => void
  onSortAlphabetically: () => void
  openContextMenu: ReturnType<typeof useTasksContextMenu>['openMenu']
}) {
  const labelRef = useRef<InlineEditableLabelHandle>(null)
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id: `${LIST_SUB_PREFIX}${sub.id}` })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `${LIST_SUB_PREFIX}${sub.id}` })

  const setNodeRef = (node: HTMLTableRowElement | null) => {
    setDragRef(node)
    setDropRef(node)
  }

  const style: CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.35 : 1,
  }

  const showOver = acceptTaskDrop && isOver

  const handleContextMenu = (event: MouseEvent) => {
    openContextMenu(event, [
      { id: 'rename', label: 'Rename', onSelect: () => labelRef.current?.startEditing() },
      { id: 'delete', label: 'Delete', danger: true, onSelect: onDelete },
    ])
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`tasks-view__list-sub${!expanded ? ' tasks-view__list-row--collapsed' : ''}${showOver ? ' tasks-view__list-sub--over' : ''}${isDragging ? ' tasks-view__list-sub--dragging' : ''}`}
      onContextMenu={handleContextMenu}
    >
      <td className="tasks-view__list-cell tasks-view__list-cell--grip">
        <button
          type="button"
          className="tasks-view__drag-handle tasks-view__drag-handle--list"
          aria-label={`Drag sub-bucket ${sub.label}`}
          {...attributes}
          {...listeners}
        >
          <GripIcon />
        </button>
      </td>
      <td className="tasks-view__list-cell tasks-view__list-sub-label" colSpan={6}>
        <ListChevronButton expanded={expanded} onToggle={onToggleExpand} label={sub.label} />
        <span
          className="tasks-view__list-sub-dot"
          style={{ '--tasks-cat-color': sub.color ?? '#a78bfa' } as CSSProperties}
          aria-hidden
        />
        <InlineEditableLabel
          ref={labelRef}
          value={sub.label}
          onSave={onRename}
          className="tasks-view__list-sub-name tasks-view__list-sub-name--editable"
          inputClassName="tasks-view__task-input tasks-view__list-sub-input"
          ariaLabel={`Edit sub-bucket name "${sub.label}"`}
        />
        <span className="tasks-view__list-sub-meta">
          {taskCount} task{taskCount === 1 ? '' : 's'}
        </span>
        <ListSortButton label={sub.label} onClick={onSortAlphabetically} />
      </td>
    </tr>
  )
}

function TaskListRow({
  task,
  categoryOptions,
  hierarchyMeta,
  onToggle,
  onSaveTitle,
  onDelete,
  onCategoryChange,
  onPlanningChange,
  onFocus,
  openContextMenu,
}: {
  task: Task
  categoryOptions: CategoryOption[]
  hierarchyMeta: HierarchyMeta
  onToggle: () => void
  onSaveTitle: (title: string) => void
  onDelete: () => void
  onCategoryChange: (categoryId: string) => void
  onPlanningChange: (planning: TaskPlanning) => void
  onFocus?: () => void
  openContextMenu: ReturnType<typeof useTasksContextMenu>['openMenu']
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const planning = task.planning ?? 'backlog'

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${LIST_TASK_PREFIX}${task.id}` })

  useEffect(() => {
    if (!editing) setDraft(task.title)
  }, [task.title, editing])

  const commitEdit = () => {
    const next = draft.trim()
    if (!next) {
      setDraft(task.title)
      setEditing(false)
      return
    }
    if (next !== task.title) onSaveTitle(next)
    setEditing(false)
  }

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.25 : 1,
  }

  const handleContextMenu = (event: MouseEvent) => {
    openContextMenu(event, [
      { id: 'delete', label: 'Delete', danger: true, onSelect: onDelete },
    ])
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`tasks-view__list-row${isDragging ? ' tasks-view__list-row--dragging' : ''}`}
      data-planning={planning}
      onContextMenu={handleContextMenu}
    >
      <td className="tasks-view__list-cell tasks-view__list-cell--grip">
        <button
          type="button"
          className="tasks-view__drag-handle tasks-view__drag-handle--list"
          aria-label={`Drag task ${task.title}`}
          {...attributes}
          {...listeners}
        >
          <GripIcon />
        </button>
      </td>
      <td className="tasks-view__list-cell tasks-view__list-cell--check">
        <button
          type="button"
          className="tasks-view__checkbox"
          role="checkbox"
          aria-checked={false}
          aria-label={`Mark "${task.title}" as done`}
          onClick={onToggle}
        >
          <CheckIcon />
        </button>
      </td>
      <td className="tasks-view__list-cell tasks-view__list-cell--title">
        {editing ? (
          <input
            className="tasks-view__task-input"
            value={draft}
            aria-label="Edit task title"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit()
              if (e.key === 'Escape') {
                setDraft(task.title)
                setEditing(false)
              }
            }}
            onBlur={commitEdit}
            autoFocus
          />
        ) : (
          <button type="button" className="tasks-view__task-title" onClick={() => setEditing(true)}>
            {task.title}
          </button>
        )}
      </td>
      <td className="tasks-view__list-cell">
        <span
          className="tasks-view__badge tasks-view__badge--category tasks-view__list-badge"
          style={{ '--tasks-cat-color': hierarchyMeta.color } as CSSProperties}
        >
          {hierarchyMeta.badge}
        </span>
      </td>
      <td className="tasks-view__list-cell">
        <select
          className="tasks-view__filter-select tasks-view__list-select"
          value={task.category}
          onChange={(e) => onCategoryChange(e.target.value)}
          aria-label={`Sub-category for ${task.title}`}
        >
          {categoryOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </td>
      <td className="tasks-view__list-cell">
        <select
          className={`tasks-view__filter-select tasks-view__list-select tasks-view__list-select--planning tasks-view__list-select--planning-${planning}`}
          value={planning}
          onChange={(e) => onPlanningChange(e.target.value as TaskPlanning)}
          aria-label={`Planning for ${task.title}`}
        >
          {PLANNING_CYCLE.map((p) => (
            <option key={p} value={p}>
              {PLANNING_LABELS[p]}
            </option>
          ))}
        </select>
      </td>
      <td className="tasks-view__list-cell tasks-view__list-cell--actions">
        {planning === 'today' && onFocus && (
          <button
            type="button"
            className="tasks-view__focus-btn tasks-view__focus-btn--list"
            aria-label={`Focus on "${task.title}"`}
            title="Start focus timer"
            onClick={onFocus}
          >
            <FocusIcon />
          </button>
        )}
        <button
          type="button"
          className="tasks-view__delete tasks-view__delete--visible"
          aria-label={`Delete "${task.title}"`}
          onClick={onDelete}
        >
          <TrashIcon />
        </button>
      </td>
    </tr>
  )
}

function CompletedTaskRow({
  task,
  hierarchyMeta,
  onToggle,
  onDelete,
  openContextMenu,
}: {
  task: Task
  hierarchyMeta: HierarchyMeta
  onToggle: () => void
  onDelete: () => void
  openContextMenu: ReturnType<typeof useTasksContextMenu>['openMenu']
}) {
  const planning = task.planning ?? 'backlog'

  const handleContextMenu = (event: MouseEvent) => {
    openContextMenu(event, [
      { id: 'delete', label: 'Delete', danger: true, onSelect: onDelete },
    ])
  }

  return (
    <li
      className="tasks-view__card tasks-view__card--done"
      onContextMenu={handleContextMenu}
    >
      <button
        type="button"
        className="tasks-view__checkbox tasks-view__checkbox--checked"
        role="checkbox"
        aria-checked
        aria-label={`Mark "${task.title}" as open`}
        onClick={onToggle}
      >
        <CheckIcon />
      </button>
      <span className="tasks-view__task-title tasks-view__task-title--done">{task.title}</span>
      <span
        className="tasks-view__badge tasks-view__badge--category"
        style={{ '--tasks-cat-color': hierarchyMeta.color } as CSSProperties}
        title={hierarchyMeta.badge}
      >
        {hierarchyMeta.badge}
      </span>
      <span className={`tasks-view__badge tasks-view__badge--planning tasks-view__badge--planning-${planning}`}>
        {PLANNING_LABELS[planning]}
      </span>
      <button
        type="button"
        className="tasks-view__delete tasks-view__delete--visible"
        aria-label={`Delete "${task.title}"`}
        onClick={onDelete}
      >
        <TrashIcon />
      </button>
    </li>
  )
}

export function TasksView() {
  const { user } = useAuth()
  const {
    tasks,
    loading,
    error,
    addTask,
    updateTask,
    applyColumnOrders,
    reorderTaskByCategory,
    removeTask,
    toggleTask,
  } = useTaskStore(user?.id)
  const { categories, addBucket, addSub, getBuckets, getSubsForBucket, getBucketForSub, getAllSubs, updateCategory, removeCategory } =
    useCategoryStore()
  const {
    activeAreas,
    addBucket: addFocusBucket,
    addSub: addFocusSub,
    getBuckets: getFocusBuckets,
    getSubsForBucket: getFocusSubsForBucket,
    getBucketForSub: getFocusBucketForSub,
    getAllSubs: getFocusAllSubs,
    editArea,
    remove: removeFocusArea,
  } = useFocusAreaStore(user?.id)
  const { selectTask, startTimer } = useCurrentFocus()

  const [viewLayout, setViewLayout] = useState<ViewLayout>('hierarchy')
  const [addingTask, setAddingTask] = useState(false)
  const [planTodayOpen, setPlanTodayOpen] = useState(false)
  const [organizeOpen, setOrganizeOpen] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskBucket, setNewTaskBucket] = useState('')
  const [newTaskCategory, setNewTaskCategory] = useState('')
  const [newTaskPlanning, setNewTaskPlanning] = useState<TaskPlanning>('backlog')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [selectedBucketId, setSelectedBucketId] = useState<string>('')
  const [selectedSubId, setSelectedSubId] = useState<string>('')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortMode>('manual')
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [activeListDragId, setActiveListDragId] = useState<string | null>(null)
  const [columnItems, setColumnItems] = useState<Record<string, string[]>>({})
  const [collapsedListBuckets, setCollapsedListBuckets] = useState<Set<string>>(
    () => new Set(loadListCollapseState().buckets),
  )
  const [collapsedListSubs, setCollapsedListSubs] = useState<Set<string>>(
    () => new Set(loadListCollapseState().subs),
  )
  const addInputRef = useRef<HTMLInputElement>(null)
  const { menu: contextMenu, openMenu: openContextMenu, closeMenu: closeContextMenu } = useTasksContextMenu()

  const taskCategoryIds = useMemo(
    () => new Set(tasks.map((t) => t.category)),
    [tasks],
  )

  // Use focus areas for task hierarchy when tasks reference focus area IDs.
  // Hierarchy (bucket→sub) is optional; flat focus areas work as top-level buckets.
  const useFocusAreasMode = useMemo(() => {
    if (activeAreas.length === 0) return false
    return activeAreas.some((a) => taskCategoryIds.has(a.id))
  }, [activeAreas, taskCategoryIds])

  const buckets = useMemo(() => {
    if (useFocusAreasMode) return getFocusBuckets()
    return getBuckets()
  }, [useFocusAreasMode, getFocusBuckets, getBuckets, activeAreas, categories])

  const allSubs = useMemo(() => {
    if (useFocusAreasMode) return getFocusAllSubs()
    return getAllSubs()
  }, [useFocusAreasMode, getFocusAllSubs, getAllSubs, activeAreas, categories])

  useEffect(() => {
    if (buckets.length === 0) {
      setSelectedBucketId('')
      setSelectedSubId('')
      return
    }
    if (!selectedBucketId || !buckets.some((b) => b.id === selectedBucketId)) {
      setSelectedBucketId(buckets[0].id)
    }
  }, [buckets, selectedBucketId])

  const selectedBucketSubs = useMemo(() => {
    if (!selectedBucketId) return []
    if (useFocusAreasMode) return getFocusSubsForBucket(selectedBucketId)
    return getSubsForBucket(selectedBucketId)
  }, [useFocusAreasMode, selectedBucketId, getFocusSubsForBucket, getSubsForBucket, activeAreas, categories])

  useEffect(() => {
    if (selectedBucketSubs.length === 0) {
      setSelectedSubId('')
      return
    }
    if (!selectedSubId || !selectedBucketSubs.some((s) => s.id === selectedSubId)) {
      setSelectedSubId(selectedBucketSubs[0].id)
    }
  }, [selectedBucketSubs, selectedSubId])

  useEffect(() => {
    if (!selectedTaskId) return
    const task = tasks.find((t) => t.id === selectedTaskId)
    if (!task || task.status !== 'open') setSelectedTaskId(null)
  }, [tasks, selectedTaskId])

  const newTaskSubOptions = useMemo(() => {
    if (!newTaskBucket) return allSubs
    if (useFocusAreasMode) return getFocusSubsForBucket(newTaskBucket)
    return getSubsForBucket(newTaskBucket)
  }, [newTaskBucket, allSubs, useFocusAreasMode, getFocusSubsForBucket, getSubsForBucket, activeAreas, categories])

  const validCategories = useMemo(
    () => categories.filter((c) => c?.id).sort((a, b) => a.order - b.order),
    [categories],
  )

  const planColumns = useMemo(
    (): ColumnMeta[] =>
      PLANNING_COLUMNS.map((id) => ({
        id,
        label: PLANNING_LABELS[id],
        color: PLANNING_COLORS[id],
        planning: id,
      })),
    [],
  )

  const categoryOptions = useMemo((): CategoryOption[] => {
    return allSubs.map((sub) => {
      const bucket = useFocusAreasMode ? getFocusBucketForSub(sub.id) : getBucketForSub(sub.id)
      return {
        id: sub.id,
        label: sub.label,
        bucketId: bucket?.id ?? null,
      }
    })
  }, [allSubs, useFocusAreasMode, getFocusBucketForSub, getBucketForSub])

  const defaultBucket = buckets[0]?.id ?? ''
  const defaultSub =
    (selectedBucketId ? selectedBucketSubs[0]?.id : allSubs[0]?.id) ??
    allSubs[0]?.id ??
    ''

  const hierarchyBuckets = useMemo(
    () =>
      buckets.map((bucket) => ({
        id: bucket.id,
        label: bucket.label,
        emoji: 'emoji' in bucket ? (bucket.emoji as string | null) : null,
        color: 'color' in bucket && bucket.color ? String(bucket.color) : undefined,
      })),
    [buckets],
  )

  const getHierarchySubs = useCallback(
    (bucketId: string) => {
      const subs = useFocusAreasMode ? getFocusSubsForBucket(bucketId) : getSubsForBucket(bucketId)
      return subs.map((sub) => ({
        id: sub.id,
        label: sub.label,
        emoji: 'emoji' in sub ? (sub.emoji as string | null) : null,
        color: 'color' in sub && sub.color ? String(sub.color) : undefined,
      }))
    },
    [useFocusAreasMode, getFocusSubsForBucket, getSubsForBucket],
  )

  const getHierarchyBucketForSub = useCallback(
    (subId: string) => {
      const bucket = useFocusAreasMode ? getFocusBucketForSub(subId) : getBucketForSub(subId)
      if (!bucket) return undefined
      return {
        id: bucket.id,
        label: bucket.label,
        emoji: 'emoji' in bucket ? (bucket.emoji as string | null) : null,
        color: 'color' in bucket && bucket.color ? String(bucket.color) : undefined,
      }
    },
    [useFocusAreasMode, getFocusBucketForSub, getBucketForSub],
  )

  const allOpenTasks = useMemo(() => tasks.filter((t) => t.status === 'open'), [tasks])

  const organizeBuckets = useMemo((): BucketContext[] => {
    return buckets.map((b) => ({
      id: b.id,
      label: b.label,
      emoji: 'emoji' in b ? (b.emoji as string | null) : null,
    }))
  }, [buckets])

  const organizeSubs = useMemo((): SubContext[] => {
    return allSubs.map((sub) => {
      const bucket = useFocusAreasMode ? getFocusBucketForSub(sub.id) : getBucketForSub(sub.id)
      return {
        id: sub.id,
        label: sub.label,
        bucketId: bucket?.id ?? '',
        bucketLabel: bucket?.label ?? '—',
      }
    })
  }, [allSubs, useFocusAreasMode, getFocusBucketForSub, getBucketForSub])

  const getSubLabel = useCallback(
    (subId: string) => {
      const sub = allSubs.find((s) => s.id === subId)
      return sub?.label ?? subId
    },
    [allSubs],
  )

  const recentlyCompletedForOrganize = useMemo(() => {
    return tasks
      .filter((t) => t.status === 'done' && isWithinLastDays(t.completedAt, 7))
      .map((t) => ({
        id: t.id,
        title: t.title,
        categoryLabel: getSubLabel(t.category),
        completedAt: t.completedAt,
      }))
  }, [tasks, getSubLabel])

  const handleOrganizeApply = useCallback(
    (actions: OrganizeApplyAction[]) => {
      for (const action of actions) {
        if (action.type === 'move') {
          const task = tasks.find((t) => t.id === action.taskId)
          if (!task || task.status !== 'open') continue
          const patch: Partial<Pick<Task, 'planning' | 'category'>> = {}
          if (action.planning !== undefined) patch.planning = action.planning
          if (action.category !== undefined) patch.category = action.category
          if (Object.keys(patch).length > 0) updateTask(action.taskId, patch)
        } else if (action.type === 'merge') {
          const keep = tasks.find((t) => t.id === action.keepTaskId)
          if (!keep || keep.status !== 'open') continue
          if (action.title && action.title !== keep.title) {
            updateTask(action.keepTaskId, { title: action.title })
          }
          for (const mergeId of action.mergeTaskIds) {
            const merge = tasks.find((t) => t.id === mergeId)
            if (!merge || merge.status !== 'open' || mergeId === action.keepTaskId) continue
            updateTask(mergeId, { status: 'archived' })
          }
        } else if (action.type === 'archive') {
          const task = tasks.find((t) => t.id === action.taskId)
          if (!task || task.status !== 'open') continue
          updateTask(action.taskId, { status: 'archived' })
        }
      }
    },
    [tasks, updateTask],
  )

  const openTasks = useMemo(() => {
    const visible = allOpenTasks
    if (filterCategory === 'all') return visible
    if (filterCategory.startsWith('bucket:')) {
      const bucketId = filterCategory.slice('bucket:'.length)
      const subIds = new Set(
        (useFocusAreasMode ? getFocusSubsForBucket(bucketId) : getSubsForBucket(bucketId)).map(
          (s) => s.id,
        ),
      )
      return visible.filter((t) => subIds.has(t.category) || t.category === bucketId)
    }
    return visible.filter((t) => t.category === filterCategory)
  }, [allOpenTasks, filterCategory, useFocusAreasMode, getFocusSubsForBucket, getSubsForBucket])

  const completedTasks = useMemo(() => {
    const done = tasks.filter((t) => t.status === 'done')
    if (filterCategory === 'all') return done
    if (filterCategory.startsWith('bucket:')) {
      const bucketId = filterCategory.slice('bucket:'.length)
      const subIds = new Set(
        (useFocusAreasMode ? getFocusSubsForBucket(bucketId) : getSubsForBucket(bucketId)).map(
          (s) => s.id,
        ),
      )
      return done.filter((t) => subIds.has(t.category) || t.category === bucketId)
    }
    return done.filter((t) => t.category === filterCategory)
  }, [tasks, filterCategory, useFocusAreasMode, getFocusSubsForBucket, getSubsForBucket])

  const planningCounts = useMemo(() => {
    const allOpen = tasks.filter((t) => t.status === 'open')
    const grouped = groupTasksByPlanning(allOpen)
    return {
      today: grouped.today.length,
      next: grouped.next.length,
      later: grouped.later.length,
      doneThisWeek: tasks.filter(
        (t) => t.status === 'done' && isWithinLastDays(t.completedAt, 7),
      ).length,
    }
  }, [tasks])

  const todayProgress = useMemo(() => {
    const todayTasks = tasks.filter((t) => (t.planning ?? 'backlog') === 'today')
    return {
      done: todayTasks.filter((t) => t.status === 'done').length,
      total: todayTasks.length,
    }
  }, [tasks])

  const planTodayCandidates = useMemo(() => {
    return sortTasksList(
      tasks.filter(
        (t) =>
          t.status === 'open' &&
          ['next', 'later', 'backlog'].includes(t.planning ?? 'backlog'),
      ),
      'manual',
    )
  }, [tasks])

  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])

  const derivedColumnItems = useMemo(() => {
    if (viewLayout !== 'board') return {}

    const sorted = sortTasksList(openTasks, sortBy)
    const grouped = groupTasksByPlanning(sorted)
    return Object.fromEntries(PLANNING_COLUMNS.map((key) => [key, grouped[key].map((t) => t.id)]))
  }, [viewLayout, openTasks, sortBy])

  useEffect(() => {
    if (activeDragId) return
    setColumnItems(derivedColumnItems)
  }, [derivedColumnItems, activeDragId])

  useEffect(() => {
    if (addingTask) addInputRef.current?.focus()
  }, [addingTask])

  useEffect(() => {
    localStorage.setItem(
      LIST_COLLAPSE_STORAGE_KEY,
      JSON.stringify({
        buckets: [...collapsedListBuckets],
        subs: [...collapsedListSubs],
      }),
    )
  }, [collapsedListBuckets, collapsedListSubs])

  const toggleListBucketCollapse = useCallback((bucketId: string) => {
    setCollapsedListBuckets((prev) => {
      const next = new Set(prev)
      if (next.has(bucketId)) next.delete(bucketId)
      else next.add(bucketId)
      return next
    })
  }, [])

  const toggleListSubCollapse = useCallback((subId: string) => {
    setCollapsedListSubs((prev) => {
      const next = new Set(prev)
      if (next.has(subId)) next.delete(subId)
      else next.add(subId)
      return next
    })
  }, [])

  const getHierarchyMeta = useCallback(
    (task: Task): HierarchyMeta => {
      if (useFocusAreasMode) {
        const sub = activeAreas.find((a) => a.id === task.category)
        if (!sub) {
          return {
            label: task.category,
            color: '#a78bfa',
            bucketLabel: task.category,
            subLabel: '—',
            badge: task.category,
          }
        }
        if (!sub.parent_id) {
          return {
            label: sub.label,
            color: sub.color ?? '#a78bfa',
            bucketLabel: sub.label,
            subLabel: 'All',
            badge: `${sub.label} · All`,
          }
        }
        const bucket = getFocusBucketForSub(sub.id)
        return {
          label: sub.label,
          color: sub.color ?? '#a78bfa',
          bucketLabel: bucket?.label ?? '—',
          subLabel: sub.label,
          badge: `${bucket?.label ?? '—'} · ${sub.label}`,
        }
      }

      const sub = validCategories.find((c) => c.id === task.category)
      if (!sub) {
        return {
          label: task.category,
          color: '#a78bfa',
          bucketLabel: task.category,
          subLabel: '—',
          badge: task.category,
        }
      }
      if (sub.parentId === null) {
        return {
          label: sub.label,
          color: sub.color,
          bucketLabel: sub.label,
          subLabel: 'All',
          badge: `${sub.label} · All`,
        }
      }
      const bucket = getBucketForSub(sub.id)
      return {
        label: sub.label,
        color: sub.color,
        bucketLabel: bucket?.label ?? '—',
        subLabel: sub.label,
        badge: `${bucket?.label ?? '—'} · ${sub.label}`,
      }
    },
    [useFocusAreasMode, activeAreas, validCategories, getFocusBucketForSub, getBucketForSub],
  )

  const handleFocusTask = useCallback(
    (task: Task) => {
      selectTask(task.id, task.title)
      startTimer()
    },
    [selectTask, startTimer],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const resolveOverContainer = (
    overId: string,
    items: Record<string, string[]>,
  ): string | undefined => findContainerId(overId, items) ?? (overId in items ? overId : undefined)

  const handleDragStart = (event: DragStartEvent) => {
    if (sortBy !== 'manual') setSortBy('manual')
    setActiveDragId(String(event.active.id))
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    setColumnItems((prev) => {
      const activeContainer = findContainerId(activeId, prev)
      const overContainer = resolveOverContainer(overId, prev)

      if (!activeContainer || !overContainer || activeContainer === overContainer) return prev

      const activeItems = [...prev[activeContainer]]
      const overItems = [...prev[overContainer]]
      const activeIndex = activeItems.indexOf(activeId)
      if (activeIndex === -1) return prev

      activeItems.splice(activeIndex, 1)

      const overIndex = overItems.indexOf(overId)
      if (overIndex >= 0) {
        overItems.splice(overIndex, 0, activeId)
      } else {
        overItems.push(activeId)
      }

      return {
        ...prev,
        [activeContainer]: activeItems,
        [overContainer]: overItems,
      }
    })
  }

  const handleDragCancel = (_event: DragCancelEvent) => {
    setActiveDragId(null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)

    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    setColumnItems((prev) => {
      const activeContainer = findContainerId(activeId, prev)
      const overContainer = resolveOverContainer(overId, prev)

      if (!activeContainer || !overContainer) return prev

      let nextItems = prev

      if (activeContainer === overContainer) {
        const items = [...(prev[activeContainer] ?? [])]
        const oldIndex = items.indexOf(activeId)
        const newIndex = items.indexOf(overId)
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          nextItems = {
            ...prev,
            [activeContainer]: arrayMove(items, oldIndex, newIndex),
          }
        }
      } else {
        const activeItems = [...(prev[activeContainer] ?? [])]
        const overItems = [...(prev[overContainer] ?? [])]
        const activeIndex = activeItems.indexOf(activeId)
        if (activeIndex >= 0) {
          activeItems.splice(activeIndex, 1)
          const overIndex = overItems.indexOf(overId)
          if (overIndex >= 0) {
            overItems.splice(overIndex, 0, activeId)
          } else {
            overItems.push(activeId)
          }
          nextItems = {
            ...prev,
            [activeContainer]: activeItems,
            [overContainer]: overItems,
          }
        }
      }

      if (viewLayout === 'board') {
        applyColumnOrders('planning', nextItems)
      }

      return nextItems
    })
  }

  const openAddTask = () => {
    const bucket = filterCategory.startsWith('bucket:')
      ? filterCategory.slice('bucket:'.length)
      : selectedBucketId || defaultBucket
    setNewTaskBucket(bucket)
    const subs = bucket
      ? (useFocusAreasMode ? getFocusSubsForBucket(bucket) : getSubsForBucket(bucket))
      : allSubs
    const sub =
      filterCategory !== 'all' && !filterCategory.startsWith('bucket:')
        ? filterCategory
        : (viewLayout === 'hierarchy' && selectedSubId ? selectedSubId : (subs[0]?.id ?? defaultSub))
    setNewTaskCategory(sub)
    setNewTaskPlanning('backlog')
    setAddingTask(true)
  }

  const resetAddTask = () => {
    setNewTaskTitle('')
    setNewTaskBucket(defaultBucket)
    setNewTaskCategory(defaultSub)
    setNewTaskPlanning('backlog')
    setAddingTask(false)
  }

  const handleAddTask = () => {
    const title = newTaskTitle.trim()
    if (!title || !newTaskCategory) return
    addTask(title, newTaskCategory, 'manual', newTaskPlanning)
    resetAddTask()
  }

  const handleQuickAdd = (columnId: string, title: string) => {
    const subId = defaultSub || newTaskCategory
    if (!subId) return
    addTask(title, subId, 'manual', columnId as TaskPlanning)
  }

  const handlePlanTodayConfirm = (ids: string[]) => {
    for (const id of ids) {
      updateTask(id, { planning: 'today' })
    }
    setPlanTodayOpen(false)
  }

  const handleAddTaskKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTask()
    }
    if (e.key === 'Escape') resetAddTask()
  }

  const handleHierarchyAddBucket = async (name: string) => {
    const colorIndex = buckets.length % CATEGORY_COLORS.length
    const color = CATEGORY_COLORS[colorIndex]
    if (useFocusAreasMode) {
      const area = await addFocusBucket(name, undefined, color)
      if (area) setSelectedBucketId(area.id)
    } else {
      const cat = addBucket(name, '📁', color)
      setSelectedBucketId(cat.id)
    }
  }

  const handleHierarchyAddSub = async (bucketId: string, name: string) => {
    const subs = useFocusAreasMode ? getFocusSubsForBucket(bucketId) : getSubsForBucket(bucketId)
    const colorIndex = subs.length % CATEGORY_COLORS.length
    const color = CATEGORY_COLORS[colorIndex]
    if (useFocusAreasMode) {
      const area = await addFocusSub(bucketId, name, undefined, color)
      if (area) setSelectedSubId(area.id)
    } else {
      const cat = addSub(bucketId, name, '📁', color)
      setSelectedSubId(cat.id)
    }
  }

  const handleHierarchyAddTask = (title: string, subId: string) => {
    addTask(title, subId, 'manual', 'backlog')
  }

  const handleSelectBucket = (bucketId: string) => {
    setSelectedBucketId(bucketId)
    setSelectedTaskId(null)
  }

  const handleSelectSub = (subId: string) => {
    setSelectedSubId(subId)
    setSelectedTaskId(null)
  }

  const handleHierarchyMoveSubToBucket = useCallback(
    (subId: string, bucketId: string) => {
      const currentBucket = useFocusAreasMode ? getFocusBucketForSub(subId) : getBucketForSub(subId)
      if (!currentBucket || currentBucket.id === bucketId) return
      if (useFocusAreasMode) {
        void editArea(subId, { parent_id: bucketId })
      } else {
        updateCategory(subId, { parentId: bucketId })
      }
    },
    [useFocusAreasMode, getFocusBucketForSub, getBucketForSub, editArea, updateCategory],
  )

  const handleHierarchyMoveTaskToSub = useCallback(
    (taskId: string, subId: string) => {
      const task = tasksById.get(taskId)
      if (!task || task.category === subId) return
      updateTask(taskId, { category: subId })
    },
    [tasksById, updateTask],
  )

  const resolveTaskCategoryForBucket = useCallback(
    (bucketId: string, taskCategory: string): string => {
      if (taskCategory === bucketId) return taskCategory
      const currentBucket = useFocusAreasMode
        ? getFocusBucketForSub(taskCategory)
        : getBucketForSub(taskCategory)
      if (currentBucket?.id === bucketId) return taskCategory

      const subs = useFocusAreasMode
        ? getFocusSubsForBucket(bucketId)
        : getSubsForBucket(bucketId)
      return subs.length > 0 ? subs[0].id : bucketId
    },
    [useFocusAreasMode, getFocusBucketForSub, getBucketForSub, getFocusSubsForBucket, getSubsForBucket],
  )

  const handleMoveTaskToBucket = useCallback(
    (taskId: string, bucketId: string) => {
      const task = tasksById.get(taskId)
      if (!task) return
      const categoryId = resolveTaskCategoryForBucket(bucketId, task.category)
      if (task.category === categoryId) return
      updateTask(taskId, { category: categoryId })
    },
    [tasksById, resolveTaskCategoryForBucket, updateTask],
  )

  const handleRenameBucket = useCallback(
    (bucketId: string, label: string) => {
      if (useFocusAreasMode) {
        void editArea(bucketId, { label })
      } else {
        updateCategory(bucketId, { label })
      }
    },
    [useFocusAreasMode, editArea, updateCategory],
  )

  const handleRenameSub = useCallback(
    (subId: string, label: string) => {
      if (useFocusAreasMode) {
        void editArea(subId, { label })
      } else {
        updateCategory(subId, { label })
      }
    },
    [useFocusAreasMode, editArea, updateCategory],
  )

  const handleDeleteBucket = useCallback(
    (bucketId: string) => {
      if (useFocusAreasMode) {
        const subs = getFocusSubsForBucket(bucketId)
        void (async () => {
          for (const sub of subs) await removeFocusArea(sub.id)
          await removeFocusArea(bucketId)
        })()
      } else {
        removeCategory(bucketId)
      }
    },
    [useFocusAreasMode, getFocusSubsForBucket, removeFocusArea, removeCategory],
  )

  const handleDeleteSub = useCallback(
    (subId: string) => {
      if (useFocusAreasMode) {
        void removeFocusArea(subId)
      } else {
        removeCategory(subId)
      }
    },
    [useFocusAreasMode, removeFocusArea, removeCategory],
  )

  const sortCategoryTasksAlphabetically = useCallback(
    (categoryId: string) => {
      const categoryTasks = openTasks.filter((task) => task.category === categoryId)
      if (categoryTasks.length === 0) return

      const orderedIds = [...categoryTasks]
        .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
        .map((task) => task.id)

      applyColumnOrders('category', { [categoryId]: orderedIds })
      setSortBy('manual')
    },
    [openTasks, applyColumnOrders],
  )

  const sortBucketTasksAlphabetically = useCallback(
    (bucketId: string) => {
      const subs = useFocusAreasMode ? getFocusSubsForBucket(bucketId) : getSubsForBucket(bucketId)
      const columns: Record<string, string[]> = {}

      for (const sub of subs) {
        const categoryTasks = openTasks.filter((task) => task.category === sub.id)
        if (categoryTasks.length === 0) continue
        columns[sub.id] = [...categoryTasks]
          .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
          .map((task) => task.id)
      }

      const bucketTasks = openTasks.filter((task) => task.category === bucketId)
      if (bucketTasks.length > 0) {
        columns[bucketId] = [...bucketTasks]
          .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
          .map((task) => task.id)
      }

      if (Object.keys(columns).length === 0) return
      applyColumnOrders('category', columns)
      setSortBy('manual')
    },
    [openTasks, useFocusAreasMode, getFocusSubsForBucket, getSubsForBucket, applyColumnOrders],
  )

  const handleReorderTasksInCategory = useCallback(
    (taskId: string, categoryId: string, orderedIds: string[]) => {
      reorderTaskByCategory(taskId, categoryId, orderedIds)
      setSortBy('manual')
    },
    [reorderTaskByCategory],
  )

  const handleSortCategoryAlphabetically = useCallback(
    (categoryId: string) => {
      sortCategoryTasksAlphabetically(categoryId)
    },
    [sortCategoryTasksAlphabetically],
  )

  const handleSortBucketAlphabetically = useCallback(
    (bucketId: string) => {
      sortBucketTasksAlphabetically(bucketId)
    },
    [sortBucketTasksAlphabetically],
  )

  const openCount = tasks.filter((t) => t.status === 'open').length
  const completedCount = tasks.filter((t) => t.status === 'done').length
  const todayOpenCount = planningCounts.today
  const todayLoadLevel = getTodayLoadLevel(todayOpenCount)

  const activeDragTask = activeDragId ? tasksById.get(activeDragId) : undefined
  const columns = planColumns

  const listTasksByCategory = useMemo(() => {
    const grouped = new Map<string, Task[]>()
    for (const task of openTasks) {
      const existing = grouped.get(task.category) ?? []
      existing.push(task)
      grouped.set(task.category, existing)
    }
    for (const [categoryId, categoryTasks] of grouped) {
      grouped.set(categoryId, sortTasksWithinCategory(categoryTasks, sortBy))
    }
    return grouped
  }, [openTasks, sortBy])

  const listBuckets = useMemo(() => {
    if (filterCategory.startsWith('bucket:')) {
      const bucketId = filterCategory.slice('bucket:'.length)
      return buckets.filter((bucket) => bucket.id === bucketId)
    }
    if (filterCategory !== 'all') {
      const bucket = useFocusAreasMode
        ? getFocusBucketForSub(filterCategory)
        : getBucketForSub(filterCategory)
      return bucket ? [bucket] : buckets
    }
    return buckets
  }, [
    buckets,
    filterCategory,
    useFocusAreasMode,
    getFocusBucketForSub,
    getBucketForSub,
  ])

  const getListSubsForBucket = useCallback(
    (bucketId: string) => {
      const subs = useFocusAreasMode ? getFocusSubsForBucket(bucketId) : getSubsForBucket(bucketId)
      if (filterCategory !== 'all' && !filterCategory.startsWith('bucket:')) {
        return subs.filter((sub) => sub.id === filterCategory)
      }
      return subs
    },
    [useFocusAreasMode, getFocusSubsForBucket, getSubsForBucket, filterCategory],
  )

  const handleListDragStart = (event: DragStartEvent) => {
    if (sortBy !== 'manual') setSortBy('manual')
    setActiveListDragId(String(event.active.id))
  }

  const handleListDragCancel = (_event: DragCancelEvent) => {
    setActiveListDragId(null)
  }

  const handleListDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveListDragId(null)
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId.startsWith(LIST_SUB_PREFIX) && overId.startsWith(LIST_BUCKET_PREFIX)) {
      const subId = activeId.slice(LIST_SUB_PREFIX.length)
      const bucketId = overId.slice(LIST_BUCKET_PREFIX.length)
      const currentBucket = useFocusAreasMode ? getFocusBucketForSub(subId) : getBucketForSub(subId)
      if (!currentBucket || currentBucket.id === bucketId) return
      if (useFocusAreasMode) {
        void editArea(subId, { parent_id: bucketId })
      } else {
        updateCategory(subId, { parentId: bucketId })
      }
      return
    }

    if (activeId.startsWith(LIST_TASK_PREFIX) && overId.startsWith(LIST_TASK_PREFIX)) {
      const activeTaskId = activeId.slice(LIST_TASK_PREFIX.length)
      const overTaskId = overId.slice(LIST_TASK_PREFIX.length)
      if (activeTaskId === overTaskId) return

      const activeTask = tasksById.get(activeTaskId)
      const overTask = tasksById.get(overTaskId)
      if (!activeTask || !overTask || activeTask.category !== overTask.category) return

      const categoryTasks = listTasksByCategory.get(activeTask.category) ?? []
      const oldIndex = categoryTasks.findIndex((task) => task.id === activeTaskId)
      const newIndex = categoryTasks.findIndex((task) => task.id === overTaskId)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

      const reordered = arrayMove(categoryTasks, oldIndex, newIndex)
      handleReorderTasksInCategory(activeTaskId, activeTask.category, reordered.map((task) => task.id))
      return
    }

    if (activeId.startsWith(LIST_TASK_PREFIX) && overId.startsWith(LIST_BUCKET_PREFIX)) {
      const taskId = activeId.slice(LIST_TASK_PREFIX.length)
      const bucketId = overId.slice(LIST_BUCKET_PREFIX.length)
      handleMoveTaskToBucket(taskId, bucketId)
      return
    }

    if (activeId.startsWith(LIST_TASK_PREFIX) && overId.startsWith(LIST_SUB_PREFIX)) {
      const taskId = activeId.slice(LIST_TASK_PREFIX.length)
      const subId = overId.slice(LIST_SUB_PREFIX.length)
      const task = tasksById.get(taskId)
      if (!task || task.category === subId) return
      updateTask(taskId, { category: subId })
    }
  }

  const activeListDragLabel = useMemo(() => {
    if (!activeListDragId) return null
    if (activeListDragId.startsWith(LIST_SUB_PREFIX)) {
      const subId = activeListDragId.slice(LIST_SUB_PREFIX.length)
      return allSubs.find((sub) => sub.id === subId)?.label ?? 'Sub-bucket'
    }
    if (activeListDragId.startsWith(LIST_TASK_PREFIX)) {
      const taskId = activeListDragId.slice(LIST_TASK_PREFIX.length)
      return tasksById.get(taskId)?.title ?? 'Task'
    }
    return null
  }, [activeListDragId, allSubs, tasksById])

  const listDraggingSub = activeListDragId?.startsWith(LIST_SUB_PREFIX) ?? false
  const listDraggingTask = activeListDragId?.startsWith(LIST_TASK_PREFIX) ?? false

  return (
    <div className="tasks-view">
      <div className="tasks-view__bg" aria-hidden />

      <div className={`tasks-view__shell${viewLayout === 'hierarchy' ? ' tasks-view__shell--hierarchy' : ''}`}>
        <header className="tasks-view__header">
          <div className="tasks-view__header-row">
            <div className="tasks-view__header-intro">
              <h1 className="tasks-view__title">Tasks</h1>
              <p className="tasks-view__subtitle">Let Clarity handle the chaos.</p>
            </div>
            <div className="tasks-view__header-actions">
              {viewLayout !== 'completed' && (
                <>
                  <label className="tasks-view__filter tasks-view__filter--header">
                    <span className="tasks-view__filter-label">Filter</span>
                    <select
                      className="tasks-view__filter-select"
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      aria-label="Filter by bucket or sub-category"
                    >
                      <option value="all">All</option>
                      {buckets.map((bucket) => (
                        <optgroup key={bucket.id} label={bucket.label}>
                          <option value={`bucket:${bucket.id}`}>{bucket.label} (all subs)</option>
                          {(useFocusAreasMode
                            ? getFocusSubsForBucket(bucket.id)
                            : getSubsForBucket(bucket.id)
                          ).map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>

                  <label className="tasks-view__filter tasks-view__filter--header">
                    <span className="tasks-view__filter-label">Sort</span>
                    <select
                      className="tasks-view__filter-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortMode)}
                      aria-label="Sort tasks"
                    >
                      <option value="manual">Manual (drag order)</option>
                      <option value="created_at">Newest first</option>
                      <option value="alphabetical">Alphabetical</option>
                    </select>
                  </label>
                </>
              )}
              <button type="button" className="tasks-view__add-btn" onClick={openAddTask}>
                <PlusIcon />
                Add task
              </button>
            </div>
          </div>

          <div className="tasks-view__tabs-row">
            <div className="tasks-view__tabs" role="tablist" aria-label="Task views">
              <button
                type="button"
                role="tab"
                aria-selected={viewLayout === 'hierarchy'}
                className={`tasks-view__tab${viewLayout === 'hierarchy' ? ' tasks-view__tab--active' : ''}`}
                onClick={() => setViewLayout('hierarchy')}
              >
                Hierarchy
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewLayout === 'list'}
                className={`tasks-view__tab${viewLayout === 'list' ? ' tasks-view__tab--active' : ''}`}
                onClick={() => setViewLayout('list')}
              >
                List
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewLayout === 'board'}
                className={`tasks-view__tab${viewLayout === 'board' ? ' tasks-view__tab--active' : ''}`}
                onClick={() => setViewLayout('board')}
              >
                Board
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewLayout === 'completed'}
                className={`tasks-view__tab${viewLayout === 'completed' ? ' tasks-view__tab--active' : ''}`}
                onClick={() => setViewLayout('completed')}
              >
                Completed
                {completedCount > 0 && <span className="tasks-view__tab-count">{completedCount}</span>}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={false}
                className="tasks-view__tab tasks-view__tab--disabled"
                disabled
                title="Coming soon"
              >
                Calendar
              </button>
            </div>
            {viewLayout !== 'completed' && (
              <button
                type="button"
                className="tasks-view__organize-btn"
                onClick={() => setOrganizeOpen(true)}
              >
                <PlusIcon size={14} />
                Organize
              </button>
            )}
          </div>

          {viewLayout === 'board' && (
            <div className="tasks-view__summary" aria-label="Task summary">
              <span className="tasks-view__summary-item tasks-view__summary-item--today">
                Today: {planningCounts.today}
              </span>
              <span className="tasks-view__summary-sep" aria-hidden>·</span>
              <span className="tasks-view__summary-item tasks-view__summary-item--next">
                Next: {planningCounts.next}
              </span>
              <span className="tasks-view__summary-sep" aria-hidden>·</span>
              <span className="tasks-view__summary-item tasks-view__summary-item--later">
                Later: {planningCounts.later}
              </span>
              <span className="tasks-view__summary-sep" aria-hidden>·</span>
              <span className="tasks-view__summary-item">
                Done this week: {planningCounts.doneThisWeek}
              </span>
            </div>
          )}
        </header>

        {addingTask && (
          <div className="tasks-view__add-form">
            <div className="tasks-view__add-form-row">
              <input
                ref={addInputRef}
                type="text"
                className="tasks-view__add-input tasks-view__add-input--title"
                placeholder="What needs to get done?"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={handleAddTaskKeyDown}
                aria-label="New task title"
              />
              <label className="tasks-view__add-field">
                <span className="tasks-view__add-field-label">Bucket</span>
                <select
                  className="tasks-view__filter-select tasks-view__add-select"
                  value={newTaskBucket}
                  onChange={(e) => {
                    const bucketId = e.target.value
                    setNewTaskBucket(bucketId)
                    const subs = useFocusAreasMode
                      ? getFocusSubsForBucket(bucketId)
                      : getSubsForBucket(bucketId)
                    setNewTaskCategory(subs[0]?.id ?? '')
                  }}
                  aria-label="Task bucket"
                >
                  {buckets.map((bucket) => (
                    <option key={bucket.id} value={bucket.id}>
                      {'emoji' in bucket && bucket.emoji ? `${bucket.emoji} ` : ''}
                      {bucket.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tasks-view__add-field">
                <span className="tasks-view__add-field-label">Sub-category</span>
                <select
                  className="tasks-view__filter-select tasks-view__add-select"
                  value={newTaskCategory}
                  onChange={(e) => setNewTaskCategory(e.target.value)}
                  aria-label="Task sub-category"
                  disabled={newTaskSubOptions.length === 0}
                >
                  {newTaskSubOptions.length === 0 ? (
                    <option value="">Create a sub-category first</option>
                  ) : (
                    newTaskSubOptions.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.label}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="tasks-view__add-field">
                <span className="tasks-view__add-field-label">Planning</span>
                <select
                  className="tasks-view__filter-select tasks-view__add-select"
                  value={newTaskPlanning}
                  onChange={(e) => setNewTaskPlanning(e.target.value as TaskPlanning)}
                  aria-label="Task planning horizon"
                >
                  {PLANNING_CYCLE.map((p) => (
                    <option key={p} value={p}>
                      {PLANNING_LABELS[p]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="tasks-view__add-submit"
                onClick={handleAddTask}
                disabled={!newTaskTitle.trim() || !newTaskCategory}
              >
                Add
              </button>
              <button type="button" className="tasks-view__add-cancel" onClick={resetAddTask}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="tasks-view__empty">
            <p className="tasks-view__empty-text">Loading tasks…</p>
          </div>
        )}

        {error && (
          <div className="tasks-view__empty">
            <p className="tasks-view__empty-text">{error}</p>
          </div>
        )}

        {!loading && !error && viewLayout === 'completed' && completedTasks.length === 0 && (
          <div className="tasks-view__empty">
            <p className="tasks-view__empty-text">No completed tasks yet.</p>
          </div>
        )}

        {!loading && !error && viewLayout === 'hierarchy' && (
          <HierarchyView
            buckets={hierarchyBuckets}
            getSubsForBucket={getHierarchySubs}
            tasks={tasks}
            getBucketForSub={getHierarchyBucketForSub}
            selectedBucketId={selectedBucketId}
            selectedSubId={selectedSubId}
            selectedTaskId={selectedTaskId}
            onSelectBucket={handleSelectBucket}
            onSelectSub={handleSelectSub}
            onSelectTask={setSelectedTaskId}
            onAddBucket={handleHierarchyAddBucket}
            onAddSub={handleHierarchyAddSub}
            onAddTask={handleHierarchyAddTask}
            onToggleTask={toggleTask}
            onUpdateTask={(id, updates) => updateTask(id, updates)}
            onDeleteTask={removeTask}
            onMoveSubToBucket={handleHierarchyMoveSubToBucket}
            onMoveTaskToSub={handleHierarchyMoveTaskToSub}
            onMoveTaskToBucket={handleMoveTaskToBucket}
            onReorderTasksInCategory={handleReorderTasksInCategory}
            onSortCategoryAlphabetically={handleSortCategoryAlphabetically}
            onSortBucketAlphabetically={handleSortBucketAlphabetically}
            onRenameBucket={handleRenameBucket}
            onRenameSub={handleRenameSub}
            onDeleteBucket={handleDeleteBucket}
            onDeleteSub={handleDeleteSub}
          />
        )}

        {!loading && !error && viewLayout === 'board' && openCount === 0 && (
          <div className="tasks-view__empty">
            <p className="tasks-view__empty-text">No open tasks yet. Add one to get started.</p>
          </div>
        )}

        {!loading && !error && viewLayout === 'board' && openCount > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="tasks-view__board">
              {columns.map((column) => {
                const taskIds = columnItems[column.id] ?? []
                const isToday = column.id === 'today'
                return (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    taskIds={taskIds}
                    tasksById={tasksById}
                    isPlanningColumn
                    todayLoadLevel={isToday ? todayLoadLevel : undefined}
                    todayProgress={isToday ? todayProgress : undefined}
                    emptyAction={
                      isToday
                        ? { label: 'Plan tasks →', onClick: () => setPlanTodayOpen(true) }
                        : undefined
                    }
                    showPlanningDot
                    showFocusOnToday
                    showHierarchyBadge
                    categoryOptions={categoryOptions}
                    getHierarchyMeta={getHierarchyMeta}
                    onToggle={toggleTask}
                    onSaveTitle={(id, title) => updateTask(id, { title })}
                    onDelete={removeTask}
                    onCategoryChange={(id, catId) => updateTask(id, { category: catId })}
                    onFocus={handleFocusTask}
                    onQuickAdd={(title) => handleQuickAdd(column.id, title)}
                    openContextMenu={openContextMenu}
                  />
                )
              })}
            </div>

            <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
              {activeDragTask ? (
                <div className="tasks-view__card tasks-view__card--overlay">
                  <span
                    className="tasks-view__planning-dot"
                    style={
                      {
                        '--tasks-plan-color': PLANNING_COLORS[activeDragTask.planning ?? 'backlog'],
                      } as CSSProperties
                    }
                  />
                  <span className="tasks-view__task-title">{activeDragTask.title}</span>
                  <span
                    className="tasks-view__badge tasks-view__badge--category"
                    style={
                      {
                        '--tasks-cat-color': getHierarchyMeta(activeDragTask).color,
                      } as CSSProperties
                    }
                  >
                    {getHierarchyMeta(activeDragTask).badge}
                  </span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {!loading && !error && viewLayout === 'list' && openCount === 0 && buckets.length === 0 && (
          <div className="tasks-view__empty">
            <p className="tasks-view__empty-text">No open tasks yet. Add one to get started.</p>
          </div>
        )}

        {!loading && !error && viewLayout === 'list' && (openCount > 0 || buckets.length > 0) && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleListDragStart}
            onDragEnd={handleListDragEnd}
            onDragCancel={handleListDragCancel}
          >
            <div className="tasks-view__list-wrap">
              <table className="tasks-view__list">
                <thead>
                  <tr>
                    <th className="tasks-view__list-head tasks-view__list-head--grip" scope="col" aria-label="Drag" />
                    <th className="tasks-view__list-head tasks-view__list-head--check" scope="col" />
                    <th className="tasks-view__list-head" scope="col">Title</th>
                    <th className="tasks-view__list-head" scope="col">Bucket · Sub</th>
                    <th className="tasks-view__list-head" scope="col">Sub-category</th>
                    <th className="tasks-view__list-head" scope="col">Planning</th>
                    <th className="tasks-view__list-head tasks-view__list-head--actions" scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listBuckets.map((bucket) => {
                    const subs = getListSubsForBucket(bucket.id)
                    const bucketExpanded = !collapsedListBuckets.has(bucket.id)
                    return (
                      <Fragment key={`bucket-group-${bucket.id}`}>
                        <ListBucketRow
                          bucket={{
                            id: bucket.id,
                            label: bucket.label,
                            emoji: 'emoji' in bucket ? (bucket.emoji as string | null) : null,
                          }}
                          subCount={subs.length}
                          acceptSubDrop={listDraggingSub}
                          acceptTaskDrop={listDraggingTask}
                          expanded={bucketExpanded}
                          onToggleExpand={() => toggleListBucketCollapse(bucket.id)}
                          onRename={(label) => handleRenameBucket(bucket.id, label)}
                          onDelete={() => handleDeleteBucket(bucket.id)}
                          onSortAlphabetically={() => handleSortBucketAlphabetically(bucket.id)}
                          openContextMenu={openContextMenu}
                        />
                        {bucketExpanded &&
                          subs.map((sub) => {
                            const tasks = listTasksByCategory.get(sub.id) ?? []
                            const subExpanded = !collapsedListSubs.has(sub.id)
                            return (
                              <Fragment key={`sub-group-${sub.id}`}>
                                <ListSubRow
                                  sub={{
                                    id: sub.id,
                                    label: sub.label,
                                    color: 'color' in sub && sub.color ? String(sub.color) : undefined,
                                  }}
                                  taskCount={tasks.length}
                                  acceptTaskDrop={listDraggingTask}
                                  expanded={subExpanded}
                                  onToggleExpand={() => toggleListSubCollapse(sub.id)}
                                  onRename={(label) => handleRenameSub(sub.id, label)}
                                  onDelete={() => handleDeleteSub(sub.id)}
                                  onSortAlphabetically={() => handleSortCategoryAlphabetically(sub.id)}
                                  openContextMenu={openContextMenu}
                                />
                                {subExpanded && (
                                  <SortableContext
                                    items={tasks.map((task) => `${LIST_TASK_PREFIX}${task.id}`)}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    {tasks.map((task) => {
                                      const meta = getHierarchyMeta(task)
                                      return (
                                        <TaskListRow
                                          key={task.id}
                                          task={task}
                                          categoryOptions={categoryOptions}
                                          hierarchyMeta={meta}
                                          onToggle={() => toggleTask(task.id)}
                                          onSaveTitle={(title) => updateTask(task.id, { title })}
                                          onDelete={() => removeTask(task.id)}
                                          onCategoryChange={(catId) => updateTask(task.id, { category: catId })}
                                          onPlanningChange={(planning) => updateTask(task.id, { planning })}
                                          onFocus={
                                            (task.planning ?? 'backlog') === 'today'
                                              ? () => handleFocusTask(task)
                                              : undefined
                                          }
                                          openContextMenu={openContextMenu}
                                        />
                                      )
                                    })}
                                  </SortableContext>
                                )}
                              </Fragment>
                            )
                          })}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
              {activeListDragLabel ? (
                <div className="tasks-view__list-drag-overlay">{activeListDragLabel}</div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {!loading && !error && viewLayout === 'completed' && completedTasks.length > 0 && (
          <ul className="tasks-view__completed-list">
            {sortTasksList(completedTasks, sortBy === 'manual' ? 'created_at' : sortBy).map((task) => {
              const meta = getHierarchyMeta(task)
              return (
                <CompletedTaskRow
                  key={task.id}
                  task={task}
                  hierarchyMeta={meta}
                  onToggle={() => toggleTask(task.id)}
                  onDelete={() => removeTask(task.id)}
                  openContextMenu={openContextMenu}
                />
              )
            })}
          </ul>
        )}
      </div>

      {planTodayOpen && (
        <PlanTodayModal
          candidates={planTodayCandidates}
          getHierarchyMeta={getHierarchyMeta}
          onClose={() => setPlanTodayOpen(false)}
          onConfirm={handlePlanTodayConfirm}
        />
      )}

      {organizeOpen && (
        <OrganizeModal
          openTasks={allOpenTasks}
          recentlyCompleted={recentlyCompletedForOrganize}
          buckets={organizeBuckets}
          subs={organizeSubs}
          getBucketForSub={(subId) => {
            const bucket = useFocusAreasMode ? getFocusBucketForSub(subId) : getBucketForSub(subId)
            return bucket ? { id: bucket.id, label: bucket.label } : undefined
          }}
          getSubLabel={getSubLabel}
          onApply={handleOrganizeApply}
          onClose={() => setOrganizeOpen(false)}
        />
      )}

      <TasksContextMenu menu={contextMenu} onClose={closeContextMenu} />
    </div>
  )
}
