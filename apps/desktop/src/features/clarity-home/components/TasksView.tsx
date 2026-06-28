import {
  useMemo,
  useRef,
  useState,
  useEffect,
  useCallback,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
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
  groupTasksByCategory,
  groupTasksByPlanning,
  useTaskStore,
} from '../hooks/useTaskStore'
import { useCategoryStore } from '../hooks/useCategoryStore'
import { useFocusAreaStore } from '../hooks/useFocusAreaStore'
import { useCurrentFocus } from '../hooks/useCurrentFocus'
import { CategoryIcon } from './CategoryIcon'
import './TasksView.css'

type ViewMode = 'plan' | 'projects' | 'completed'
type LayoutMode = 'board' | 'list'
type SortMode = 'manual' | 'alphabetical' | 'created_at'
type TodayLoadLevel = 'light' | 'neutral' | 'overloaded'

const PLANNING_LABELS: Record<TaskPlanning, string> = {
  today: 'Today',
  next: 'Next',
  later: 'Later',
  backlog: 'Backlog',
}

const PLANNING_COLORS: Record<TaskPlanning, string> = {
  today: '#22c55e',
  next: '#3b82f6',
  later: '#94a3b8',
  backlog: '#64748b',
}

const PLANNING_CYCLE: TaskPlanning[] = ['today', 'next', 'later', 'backlog']

const CATEGORY_COLORS = [
  '#7c3aed', '#f97316', '#22c55e', '#3b82f6',
  '#ec4899', '#eab308', '#06b6d4', '#f43f5e',
]

const MAX_PLAN_TODAY_PICK = 3

type ColumnMeta = {
  id: string
  label: string
  color: string
  emoji?: string | null
  planning?: TaskPlanning
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M9 7V5h6v2M10 11v6M14 11v6M6 7l1 12h10l1-12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function GripIcon() {
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

function FocusIcon() {
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

function sortTasksList(tasks: Task[], sortBy: SortMode): Task[] {
  if (sortBy === 'manual') return tasks
  const copy = [...tasks]
  if (sortBy === 'alphabetical') {
    return copy.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
  }
  return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

function nextPlanning(current: TaskPlanning): TaskPlanning {
  const index = PLANNING_CYCLE.indexOf(current)
  return PLANNING_CYCLE[(index + 1) % PLANNING_CYCLE.length]
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
  categoryOptions,
  showPlanningDot,
  showFocusButton,
  showPlanningBadge,
  onToggle,
  onSaveTitle,
  onDelete,
  onCategoryChange,
  onCyclePlanning,
  onFocus,
}: {
  task: Task
  planningColor?: string
  categoryColor: string
  categoryOptions: { id: string; label: string }[]
  showPlanningDot: boolean
  showFocusButton: boolean
  showPlanningBadge: boolean
  onToggle: () => void
  onSaveTitle: (title: string) => void
  onDelete: () => void
  onCategoryChange: (categoryId: string) => void
  onCyclePlanning?: () => void
  onFocus?: () => void
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

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`tasks-view__card${isDragging ? ' tasks-view__card--dragging' : ''}${isDragging ? '' : ' tasks-view__card--snap'}`}
      data-planning={planning}
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

      <span
        className="tasks-view__category-dot"
        style={{ '--tasks-cat-color': categoryColor } as CSSProperties}
        title={categoryOptions.find((c) => c.id === task.category)?.label ?? task.category}
        aria-hidden
      />

      <select
        className="tasks-view__card-select tasks-view__card-hover"
        value={task.category}
        onChange={(e) => onCategoryChange(e.target.value)}
        aria-label="Change category"
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
  getCategoryMeta,
  onClose,
  onConfirm,
}: {
  candidates: Task[]
  getCategoryMeta: (task: Task) => { label: string; color: string }
  onClose: () => void
  onConfirm: (ids: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>([])

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
              const meta = getCategoryMeta(task)
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
                      className="tasks-view__category-dot"
                      style={{ '--tasks-cat-color': meta.color } as CSSProperties}
                      aria-hidden
                    />
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
  categoryOptions,
  getCategoryMeta,
  onToggle,
  onSaveTitle,
  onDelete,
  onCategoryChange,
  onCyclePlanning,
  onFocus,
  onQuickAdd,
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
  categoryOptions: { id: string; label: string }[]
  getCategoryMeta: (task: Task) => { label: string; color: string }
  onToggle: (id: string) => void
  onSaveTitle: (id: string, title: string) => void
  onDelete: (id: string) => void
  onCategoryChange: (id: string, categoryId: string) => void
  onCyclePlanning?: (id: string) => void
  onFocus?: (task: Task) => void
  onQuickAdd: (title: string) => void
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
            const meta = getCategoryMeta(task)
            const taskPlanning = task.planning ?? 'backlog'
            return (
              <SortableTaskCard
                key={id}
                task={task}
                planningColor={showPlanningDot ? PLANNING_COLORS[taskPlanning] : undefined}
                categoryColor={meta.color}
                categoryOptions={categoryOptions}
                showPlanningDot={showPlanningDot}
                showFocusButton={showFocusOnToday && taskPlanning === 'today'}
                showPlanningBadge={!isPlanningColumn}
                onToggle={() => onToggle(id)}
                onSaveTitle={(title) => onSaveTitle(id, title)}
                onDelete={() => onDelete(id)}
                onCategoryChange={(catId) => onCategoryChange(id, catId)}
                onCyclePlanning={onCyclePlanning ? () => onCyclePlanning(id) : undefined}
                onFocus={onFocus ? () => onFocus(task) : undefined}
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

function TaskListRow({
  task,
  categoryOptions,
  categoryColor,
  onToggle,
  onSaveTitle,
  onDelete,
  onCategoryChange,
  onPlanningChange,
  onFocus,
}: {
  task: Task
  categoryOptions: { id: string; label: string }[]
  categoryColor: string
  onToggle: () => void
  onSaveTitle: (title: string) => void
  onDelete: () => void
  onCategoryChange: (categoryId: string) => void
  onPlanningChange: (planning: TaskPlanning) => void
  onFocus?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const planning = task.planning ?? 'backlog'

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

  return (
    <tr className="tasks-view__list-row" data-planning={planning}>
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
        <div className="tasks-view__list-project">
          <span
            className="tasks-view__category-dot"
            style={{ '--tasks-cat-color': categoryColor } as CSSProperties}
            aria-hidden
          />
          <select
            className="tasks-view__filter-select tasks-view__list-select"
            value={task.category}
            onChange={(e) => onCategoryChange(e.target.value)}
            aria-label={`Project for ${task.title}`}
          >
            {categoryOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
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
  categoryLabel,
  categoryColor,
  onToggle,
  onDelete,
}: {
  task: Task
  categoryLabel: string
  categoryColor: string
  onToggle: () => void
  onDelete: () => void
}) {
  const planning = task.planning ?? 'backlog'

  return (
    <li className="tasks-view__card tasks-view__card--done">
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
        className="tasks-view__category-dot"
        style={{ '--tasks-cat-color': categoryColor } as CSSProperties}
        title={categoryLabel}
        aria-hidden
      />
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
    removeTask,
    toggleTask,
  } = useTaskStore(user?.id)
  const { categories, addCategory } = useCategoryStore()
  const { activeAreas, addArea } = useFocusAreaStore(user?.id)
  const { selectTask, startTimer } = useCurrentFocus()

  const [viewMode, setViewMode] = useState<ViewMode>('plan')
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('board')
  const [addingTask, setAddingTask] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [planTodayOpen, setPlanTodayOpen] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskCategory, setNewTaskCategory] = useState('')
  const [newTaskPlanning, setNewTaskPlanning] = useState<TaskPlanning>('backlog')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortMode>('manual')
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [columnItems, setColumnItems] = useState<Record<string, string[]>>({})
  const addInputRef = useRef<HTMLInputElement>(null)
  const addCategoryInputRef = useRef<HTMLInputElement>(null)

  const useFocusAreasMode = activeAreas.length > 0
  const validCategories = useMemo(
    () => categories.filter((c) => c?.id).sort((a, b) => a.order - b.order),
    [categories],
  )

  const projectColumns = useMemo((): ColumnMeta[] => {
    if (useFocusAreasMode) {
      return activeAreas.map((area) => ({
        id: area.id,
        label: area.label,
        color: area.color ?? '#a78bfa',
        emoji: area.emoji,
      }))
    }
    return validCategories.map((cat) => ({
      id: cat.id,
      label: cat.label,
      color: cat.color,
      emoji: cat.emoji,
    }))
  }, [useFocusAreasMode, activeAreas, validCategories])

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

  const categoryOptions = useMemo(
    () =>
      useFocusAreasMode
        ? activeAreas.map((a) => ({ id: a.id, label: a.label }))
        : validCategories.map((c) => ({ id: c.id, label: c.label })),
    [useFocusAreasMode, activeAreas, validCategories],
  )

  const defaultCategory = useFocusAreasMode
    ? (activeAreas[0]?.id ?? validCategories[0]?.id ?? 'clarity')
    : (validCategories[0]?.id ?? 'clarity')

  const openTasks = useMemo(() => {
    const visible = tasks.filter((t) => t.status === 'open')
    if (filterCategory === 'all') return visible
    return visible.filter((t) => t.category === filterCategory)
  }, [tasks, filterCategory])

  const completedTasks = useMemo(() => {
    const done = tasks.filter((t) => t.status === 'done')
    if (filterCategory === 'all') return done
    return done.filter((t) => t.category === filterCategory)
  }, [tasks, filterCategory])

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
    if (viewMode === 'completed') return {}

    const sorted = sortTasksList(openTasks, sortBy)
    if (viewMode === 'plan') {
      const grouped = groupTasksByPlanning(sorted)
      return Object.fromEntries(PLANNING_COLUMNS.map((key) => [key, grouped[key].map((t) => t.id)]))
    }

    const grouped = groupTasksByCategory(
      sorted,
      projectColumns.map((c) => c.id),
    )
    return Object.fromEntries(projectColumns.map((col) => [col.id, (grouped[col.id] ?? []).map((t) => t.id)]))
  }, [viewMode, openTasks, sortBy, projectColumns])

  useEffect(() => {
    if (activeDragId) return
    setColumnItems(derivedColumnItems)
  }, [derivedColumnItems, activeDragId])

  useEffect(() => {
    if (addingTask) addInputRef.current?.focus()
  }, [addingTask])

  useEffect(() => {
    if (addingCategory) addCategoryInputRef.current?.focus()
  }, [addingCategory])

  const getCategoryMeta = useCallback(
    (task: Task): { label: string; color: string } => {
      if (useFocusAreasMode) {
        const area = activeAreas.find((a) => a.id === task.category)
        return {
          label: area?.label ?? task.category,
          color: area?.color ?? '#a78bfa',
        }
      }
      const cat = validCategories.find((c) => c.id === task.category)
      return {
        label: cat?.label ?? task.category,
        color: cat?.color ?? '#a78bfa',
      }
    },
    [useFocusAreasMode, activeAreas, validCategories],
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

      if (viewMode === 'plan') {
        applyColumnOrders('planning', nextItems)
      } else if (viewMode === 'projects') {
        applyColumnOrders('category', nextItems)
      }

      return nextItems
    })
  }

  const openAddTask = () => {
    setAddingCategory(false)
    setNewTaskCategory(filterCategory !== 'all' ? filterCategory : defaultCategory)
    setNewTaskPlanning('backlog')
    setAddingTask(true)
  }

  const openAddCategory = () => {
    setAddingTask(false)
    setAddingCategory(true)
  }

  const resetAddTask = () => {
    setNewTaskTitle('')
    setNewTaskCategory(defaultCategory)
    setNewTaskPlanning('backlog')
    setAddingTask(false)
  }

  const resetAddCategory = () => {
    setNewCategoryName('')
    setNewCategoryEmoji('')
    setAddingCategory(false)
  }

  const handleAddTask = () => {
    const title = newTaskTitle.trim()
    if (!title || !newTaskCategory) return
    addTask(title, newTaskCategory, 'manual', newTaskPlanning)
    resetAddTask()
  }

  const handleQuickAdd = (columnId: string, title: string) => {
    if (viewMode === 'plan') {
      addTask(title, defaultCategory, 'manual', columnId as TaskPlanning)
    } else {
      addTask(title, columnId, 'manual', 'backlog')
    }
  }

  const handlePlanTodayConfirm = (ids: string[]) => {
    for (const id of ids) {
      updateTask(id, { planning: 'today' })
    }
    setPlanTodayOpen(false)
  }

  const handleAddCategory = async () => {
    const name = newCategoryName.trim()
    if (!name) return
    const colorIndex = (useFocusAreasMode ? activeAreas.length : validCategories.length) % CATEGORY_COLORS.length
    const color = CATEGORY_COLORS[colorIndex]

    if (useFocusAreasMode) {
      const area = await addArea(name, newCategoryEmoji || undefined, color)
      if (area) {
        setNewTaskCategory(area.id)
        if (viewMode === 'projects') setFilterCategory(area.id)
      }
    } else {
      const cat = addCategory(name, newCategoryEmoji || '📁', color)
      setNewTaskCategory(cat.id)
      if (viewMode === 'projects') setFilterCategory(cat.id)
    }
    resetAddCategory()
  }

  const handleAddTaskKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTask()
    }
    if (e.key === 'Escape') resetAddTask()
  }

  const handleAddCategoryKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void handleAddCategory()
    }
    if (e.key === 'Escape') resetAddCategory()
  }

  const handleCyclePlanning = (id: string) => {
    const task = tasksById.get(id)
    if (!task) return
    updateTask(id, { planning: nextPlanning(task.planning ?? 'backlog') })
  }

  const openCount = tasks.filter((t) => t.status === 'open').length
  const completedCount = tasks.filter((t) => t.status === 'done').length
  const todayOpenCount = planningCounts.today
  const todayLoadLevel = getTodayLoadLevel(todayOpenCount)

  const activeDragTask = activeDragId ? tasksById.get(activeDragId) : undefined
  const columns = viewMode === 'plan' ? planColumns : projectColumns
  const showBoard = layoutMode === 'board' || viewMode !== 'plan'

  const listTasks = useMemo(
    () => sortTasksList(openTasks, sortBy),
    [openTasks, sortBy],
  )

  return (
    <div className="tasks-view">
      <div className="tasks-view__bg" aria-hidden />

      <div className="tasks-view__shell">
        <header className="tasks-view__header">
          <div className="tasks-view__header-row">
            <h1 className="tasks-view__title">Tasks</h1>
            <div className="tasks-view__header-actions">
              {viewMode !== 'completed' && (
                <button
                  type="button"
                  className="tasks-view__add-btn tasks-view__add-btn--secondary"
                  onClick={openAddCategory}
                >
                  <PlusIcon />
                  {useFocusAreasMode ? 'Add project' : 'Add category'}
                </button>
              )}
              <button type="button" className="tasks-view__add-btn" onClick={openAddTask}>
                <PlusIcon />
                Add task
              </button>
            </div>
          </div>

          <div className="tasks-view__tabs" role="tablist" aria-label="Task views">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'plan'}
              className={`tasks-view__tab${viewMode === 'plan' ? ' tasks-view__tab--active' : ''}`}
              onClick={() => setViewMode('plan')}
            >
              Plan
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'projects'}
              className={`tasks-view__tab${viewMode === 'projects' ? ' tasks-view__tab--active' : ''}`}
              onClick={() => setViewMode('projects')}
            >
              Projects
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'completed'}
              className={`tasks-view__tab${viewMode === 'completed' ? ' tasks-view__tab--active' : ''}`}
              onClick={() => setViewMode('completed')}
            >
              Completed
              {completedCount > 0 && <span className="tasks-view__tab-count">{completedCount}</span>}
            </button>
          </div>

          {viewMode === 'plan' && (
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

          {viewMode !== 'completed' && (
            <div className="tasks-view__toolbar">
              {viewMode === 'plan' && (
                <div className="tasks-view__layout-toggle" role="group" aria-label="Layout">
                  <button
                    type="button"
                    className={`tasks-view__layout-btn${layoutMode === 'board' ? ' tasks-view__layout-btn--active' : ''}`}
                    onClick={() => setLayoutMode('board')}
                  >
                    Board
                  </button>
                  <button
                    type="button"
                    className={`tasks-view__layout-btn${layoutMode === 'list' ? ' tasks-view__layout-btn--active' : ''}`}
                    onClick={() => setLayoutMode('list')}
                  >
                    List
                  </button>
                </div>
              )}

              <label className="tasks-view__filter">
                <span className="tasks-view__filter-label">Category</span>
                <select
                  className="tasks-view__filter-select"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  aria-label="Filter by category"
                >
                  <option value="all">All categories</option>
                  {useFocusAreasMode
                    ? activeAreas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.emoji ?? ''} {area.label}
                        </option>
                      ))
                    : validCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                </select>
              </label>

              <label className="tasks-view__filter">
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
            </div>
          )}
        </header>

        {addingCategory && (
          <div className="tasks-view__add-form">
            <div className="tasks-view__add-form-row">
              <input
                type="text"
                className="tasks-view__add-input tasks-view__add-input--emoji"
                placeholder="📁"
                value={newCategoryEmoji}
                onChange={(e) => setNewCategoryEmoji(e.target.value)}
                maxLength={2}
                aria-label="Category emoji"
              />
              <input
                ref={addCategoryInputRef}
                type="text"
                className="tasks-view__add-input"
                placeholder={useFocusAreasMode ? 'Project name' : 'Category name'}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={handleAddCategoryKeyDown}
                aria-label={useFocusAreasMode ? 'New project name' : 'New category name'}
              />
              <button
                type="button"
                className="tasks-view__add-submit"
                onClick={() => void handleAddCategory()}
                disabled={!newCategoryName.trim()}
              >
                Add
              </button>
              <button type="button" className="tasks-view__add-cancel" onClick={resetAddCategory}>
                Cancel
              </button>
            </div>
          </div>
        )}

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
                <span className="tasks-view__add-field-label">
                  {useFocusAreasMode ? 'Project' : 'Category'}
                </span>
                <select
                  className="tasks-view__filter-select tasks-view__add-select"
                  value={newTaskCategory}
                  onChange={(e) => setNewTaskCategory(e.target.value)}
                  aria-label="Task category"
                >
                  {useFocusAreasMode
                    ? activeAreas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.emoji ?? ''} {area.label}
                        </option>
                      ))
                    : validCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
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

        {!loading && !error && viewMode === 'completed' && completedTasks.length === 0 && (
          <div className="tasks-view__empty">
            <p className="tasks-view__empty-text">No completed tasks yet.</p>
          </div>
        )}

        {!loading && !error && viewMode !== 'completed' && openCount === 0 && (
          <div className="tasks-view__empty">
            <p className="tasks-view__empty-text">No open tasks yet. Add one to get started.</p>
          </div>
        )}

        {!loading && !error && viewMode !== 'completed' && openCount > 0 && showBoard && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
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
                    isPlanningColumn={viewMode === 'plan'}
                    todayLoadLevel={isToday ? todayLoadLevel : undefined}
                    todayProgress={isToday && viewMode === 'plan' ? todayProgress : undefined}
                    emptyAction={
                      isToday && viewMode === 'plan'
                        ? { label: 'Plan tasks →', onClick: () => setPlanTodayOpen(true) }
                        : undefined
                    }
                    showPlanningDot={viewMode === 'plan'}
                    showFocusOnToday={viewMode === 'plan'}
                    categoryOptions={categoryOptions}
                    getCategoryMeta={getCategoryMeta}
                    onToggle={toggleTask}
                    onSaveTitle={(id, title) => updateTask(id, { title })}
                    onDelete={removeTask}
                    onCategoryChange={(id, catId) => updateTask(id, { category: catId })}
                    onCyclePlanning={viewMode === 'projects' ? handleCyclePlanning : undefined}
                    onFocus={handleFocusTask}
                    onQuickAdd={(title) => handleQuickAdd(column.id, title)}
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
                    className="tasks-view__category-dot"
                    style={
                      {
                        '--tasks-cat-color': getCategoryMeta(activeDragTask).color,
                      } as CSSProperties
                    }
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {!loading && !error && viewMode === 'plan' && layoutMode === 'list' && openCount > 0 && (
          <div className="tasks-view__list-wrap">
            <table className="tasks-view__list">
              <thead>
                <tr>
                  <th className="tasks-view__list-head tasks-view__list-head--check" scope="col" />
                  <th className="tasks-view__list-head" scope="col">Title</th>
                  <th className="tasks-view__list-head" scope="col">
                    {useFocusAreasMode ? 'Project' : 'Category'}
                  </th>
                  <th className="tasks-view__list-head" scope="col">Planning</th>
                  <th className="tasks-view__list-head tasks-view__list-head--actions" scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {listTasks.map((task) => {
                  const meta = getCategoryMeta(task)
                  return (
                    <TaskListRow
                      key={task.id}
                      task={task}
                      categoryOptions={categoryOptions}
                      categoryColor={meta.color}
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
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && viewMode === 'completed' && completedTasks.length > 0 && (
          <ul className="tasks-view__completed-list">
            {sortTasksList(completedTasks, sortBy === 'manual' ? 'created_at' : sortBy).map((task) => {
              const meta = getCategoryMeta(task)
              return (
                <CompletedTaskRow
                  key={task.id}
                  task={task}
                  categoryLabel={meta.label}
                  categoryColor={meta.color}
                  onToggle={() => toggleTask(task.id)}
                  onDelete={() => removeTask(task.id)}
                />
              )
            })}
          </ul>
        )}
      </div>

      {planTodayOpen && (
        <PlanTodayModal
          candidates={planTodayCandidates}
          getCategoryMeta={getCategoryMeta}
          onClose={() => setPlanTodayOpen(false)}
          onConfirm={handlePlanTodayConfirm}
        />
      )}
    </div>
  )
}
