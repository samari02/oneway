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
import { CategoryIcon } from './CategoryIcon'
import './TasksView.css'

type ViewMode = 'plan' | 'projects' | 'completed'
type SortMode = 'manual' | 'alphabetical' | 'created_at'

const PLANNING_LABELS: Record<TaskPlanning, string> = {
  today: 'Today',
  next: 'Next',
  later: 'Later',
  backlog: 'Backlog',
}

const PLANNING_CYCLE: TaskPlanning[] = ['today', 'next', 'later', 'backlog']

const CATEGORY_COLORS = [
  '#7c3aed', '#f97316', '#22c55e', '#3b82f6',
  '#ec4899', '#eab308', '#06b6d4', '#f43f5e',
]

type ColumnMeta = {
  id: string
  label: string
  color: string
  emoji?: string | null
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

function SortableTaskCard({
  task,
  showCategoryBadge,
  showPlanningBadge,
  categoryLabel,
  categoryColor,
  onToggle,
  onSaveTitle,
  onDelete,
  onCyclePlanning,
}: {
  task: Task
  showCategoryBadge: boolean
  showPlanningBadge: boolean
  categoryLabel: string
  categoryColor: string
  onToggle: () => void
  onSaveTitle: (title: string) => void
  onDelete: () => void
  onCyclePlanning?: () => void
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

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }

  const planning = task.planning ?? 'backlog'

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`tasks-view__card${isDragging ? ' tasks-view__card--dragging' : ''}`}
    >
      <button
        type="button"
        className="tasks-view__drag-handle"
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

      {showCategoryBadge && (
        <span
          className="tasks-view__badge tasks-view__badge--category"
          style={{ '--tasks-cat-color': categoryColor } as CSSProperties}
        >
          {categoryLabel}
        </span>
      )}

      {showPlanningBadge && (
        <button
          type="button"
          className={`tasks-view__badge tasks-view__badge--planning tasks-view__badge--planning-${planning}`}
          onClick={onCyclePlanning}
          title="Click to change planning horizon"
        >
          {PLANNING_LABELS[planning]}
        </button>
      )}

      <button
        type="button"
        className="tasks-view__delete"
        aria-label={`Delete "${task.title}"`}
        onClick={onDelete}
      >
        <TrashIcon />
      </button>
    </li>
  )
}

function KanbanColumn({
  column,
  taskIds,
  tasksById,
  emptyHint,
  showOverLimit,
  showCategoryBadge,
  showPlanningBadge,
  getCategoryMeta,
  onToggle,
  onSaveTitle,
  onDelete,
  onCyclePlanning,
}: {
  column: ColumnMeta
  taskIds: string[]
  tasksById: Map<string, Task>
  emptyHint?: string
  showOverLimit?: boolean
  showCategoryBadge: boolean
  showPlanningBadge: boolean
  getCategoryMeta: (task: Task) => { label: string; color: string }
  onToggle: (id: string) => void
  onSaveTitle: (id: string, title: string) => void
  onDelete: (id: string) => void
  onCyclePlanning?: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <section
      ref={setNodeRef}
      className={`tasks-view__column${isOver ? ' tasks-view__column--over' : ''}${showOverLimit ? ' tasks-view__column--warn' : ''}`}
    >
      <header className="tasks-view__column-header">
        <span
          className="tasks-view__column-dot"
          style={{ '--tasks-cat-color': column.color } as CSSProperties}
          aria-hidden
        >
          {column.emoji ? (
            <span className="tasks-view__column-emoji">{column.emoji}</span>
          ) : (
            <CategoryIcon categoryId={column.id} size={14} />
          )}
        </span>
        <span className="tasks-view__column-label">{column.label}</span>
        <span className="tasks-view__column-count">{taskIds.length}</span>
      </header>

      {showOverLimit && (
        <p className="tasks-view__column-hint tasks-view__column-hint--warn">
          Consider moving some tasks — Today works best with 5 or fewer.
        </p>
      )}

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <ul className="tasks-view__column-list">
          {taskIds.map((id) => {
            const task = tasksById.get(id)
            if (!task) return null
            const meta = getCategoryMeta(task)
            return (
              <SortableTaskCard
                key={id}
                task={task}
                showCategoryBadge={showCategoryBadge}
                showPlanningBadge={showPlanningBadge}
                categoryLabel={meta.label}
                categoryColor={meta.color}
                onToggle={() => onToggle(id)}
                onSaveTitle={(title) => onSaveTitle(id, title)}
                onDelete={() => onDelete(id)}
                onCyclePlanning={onCyclePlanning ? () => onCyclePlanning(id) : undefined}
              />
            )
          })}
        </ul>
      </SortableContext>

      {taskIds.length === 0 && emptyHint && (
        <p className="tasks-view__column-hint">{emptyHint}</p>
      )}
    </section>
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
        className="tasks-view__badge tasks-view__badge--category"
        style={{ '--tasks-cat-color': categoryColor } as CSSProperties}
      >
        {categoryLabel}
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
    removeTask,
    toggleTask,
  } = useTaskStore(user?.id)
  const { categories, addCategory } = useCategoryStore()
  const { activeAreas, addArea } = useFocusAreaStore(user?.id)

  const [viewMode, setViewMode] = useState<ViewMode>('plan')
  const [addingTask, setAddingTask] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
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
        color: id === 'today' ? '#7c3aed' : '#a78bfa',
      })),
    [],
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
  const todayCount = (columnItems.today ?? derivedColumnItems.today ?? []).length

  const activeDragTask = activeDragId ? tasksById.get(activeDragId) : undefined
  const columns = viewMode === 'plan' ? planColumns : projectColumns

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

          {viewMode !== 'completed' && (
            <div className="tasks-view__toolbar">
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

        {!loading && !error && viewMode !== 'completed' && openCount > 0 && (
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
                    emptyHint={isToday ? 'Drag tasks here or add new' : undefined}
                    showOverLimit={isToday && todayCount > 5}
                    showCategoryBadge={viewMode === 'plan'}
                    showPlanningBadge={viewMode === 'projects'}
                    getCategoryMeta={getCategoryMeta}
                    onToggle={toggleTask}
                    onSaveTitle={(id, title) => updateTask(id, { title })}
                    onDelete={removeTask}
                    onCyclePlanning={viewMode === 'projects' ? handleCyclePlanning : undefined}
                  />
                )
              })}
            </div>

            <DragOverlay>
              {activeDragTask ? (
                <div className="tasks-view__card tasks-view__card--overlay">
                  <span className="tasks-view__drag-handle">
                    <GripIcon />
                  </span>
                  <span className="tasks-view__task-title">{activeDragTask.title}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
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
    </div>
  )
}
