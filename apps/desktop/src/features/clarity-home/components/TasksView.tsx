import { useMemo, useRef, useState, useEffect, type CSSProperties, type KeyboardEvent } from 'react'
import type { Task } from '@oneway/shared'
import type { FocusArea } from '@oneway/shared'
import { useAuth } from '@/features/auth'
import { useTaskStore } from '../hooks/useTaskStore'
import { useCategoryStore, type Category } from '../hooks/useCategoryStore'
import { useFocusAreaStore } from '../hooks/useFocusAreaStore'
import { CategoryIcon } from './CategoryIcon'
import './TasksView.css'

type TabId = 'all' | 'completed'
type SortMode = 'alphabetical' | 'created_at'

type GroupDisplay = {
  id: string
  label: string
  color: string
  emoji?: string | null
  tasks: Task[]
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

function sortTasks(tasks: Task[], sortBy: SortMode): Task[] {
  const copy = [...tasks]
  if (sortBy === 'alphabetical') {
    return copy.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
  }
  return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

function groupTasks(
  tasks: Task[],
  categories: Category[],
  focusAreas: FocusArea[],
  useFocusAreasMode: boolean,
  sortBy: SortMode,
): GroupDisplay[] {
  const grouped = new Map<string, Task[]>()
  for (const t of tasks) {
    const list = grouped.get(t.category) ?? []
    list.push(t)
    grouped.set(t.category, list)
  }

  if (useFocusAreasMode) {
    const areaMap = new Map(focusAreas.map((a) => [a.id, a]))
    const orderMap = new Map(focusAreas.map((fa) => [fa.id, fa.display_order]))
    return Array.from(grouped.entries())
      .map(([areaId, areaTasks]) => {
        const area = areaMap.get(areaId)
        return {
          id: areaId,
          label: area?.label ?? areaId.charAt(0).toUpperCase() + areaId.slice(1),
          color: area?.color ?? '#a78bfa',
          emoji: area?.emoji,
          tasks: sortTasks(areaTasks, sortBy),
        }
      })
      .sort((a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99))
  }

  const orderMap = new Map(categories.map((c, i) => [c.id, i]))
  return Array.from(grouped.entries())
    .map(([catId, catTasks]) => {
      const cat = categories.find((c) => c.id === catId)
      return {
        id: catId,
        label: cat?.label ?? catId.charAt(0).toUpperCase() + catId.slice(1),
        color: cat?.color ?? '#a78bfa',
        emoji: cat?.emoji,
        tasks: sortTasks(catTasks, sortBy),
      }
    })
    .sort((a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99))
}

function TaskRow({
  task,
  isDone,
  categories,
  focusAreas,
  useFocusAreasMode,
  onToggle,
  onSaveTitle,
  onChangeCategory,
  onDelete,
}: {
  task: Task
  isDone: boolean
  categories: Category[]
  focusAreas: FocusArea[]
  useFocusAreasMode: boolean
  onToggle: () => void
  onSaveTitle: (title: string) => void
  onChangeCategory: (category: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const inputRef = useRef<HTMLInputElement>(null)

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

  const categoryColor = useFocusAreasMode
    ? (focusAreas.find((a) => a.id === task.category)?.color ?? '#a78bfa')
    : (categories.find((c) => c.id === task.category)?.color ?? '#a78bfa')

  const validCategories = categories.filter((c) => c?.id).sort((a, b) => a.order - b.order)

  return (
    <li className={`tasks-view__task${isDone ? ' tasks-view__task--done' : ''}${editing ? ' tasks-view__task--editing' : ''}`}>
      <button
        type="button"
        className={`tasks-view__checkbox${isDone ? ' tasks-view__checkbox--checked' : ''}`}
        role="checkbox"
        aria-checked={isDone}
        aria-label={`Mark "${task.title}" as ${isDone ? 'open' : 'done'}`}
        onClick={onToggle}
      >
        {isDone && <CheckIcon />}
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
        <button
          type="button"
          className="tasks-view__task-title"
          onClick={() => setEditing(true)}
        >
          {task.title}
        </button>
      )}

      <select
        className="tasks-view__category-select"
        value={task.category}
        onChange={(e) => onChangeCategory(e.target.value)}
        aria-label={`Category for ${task.title}`}
        style={{ '--tasks-cat-color': categoryColor } as CSSProperties}
      >
        {useFocusAreasMode
          ? focusAreas.filter((a) => a.status === 'active').map((area) => (
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

export function TasksView() {
  const { user } = useAuth()
  const { tasks, loading, error, addTask, updateTask, removeTask, toggleTask } = useTaskStore(user?.id)
  const { categories } = useCategoryStore()
  const { activeAreas } = useFocusAreaStore(user?.id)

  const [activeTab, setActiveTab] = useState<TabId>('all')
  const [addingTask, setAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortMode>('created_at')
  const addInputRef = useRef<HTMLInputElement>(null)

  const useFocusAreasMode = activeAreas.length > 0
  const validCategories = useMemo(
    () => categories.filter((c) => c?.id).sort((a, b) => a.order - b.order),
    [categories],
  )

  const defaultCategory = useFocusAreasMode
    ? (activeAreas[0]?.id ?? validCategories[0]?.id ?? 'clarity')
    : (validCategories[0]?.id ?? 'clarity')

  useEffect(() => {
    if (addingTask) addInputRef.current?.focus()
  }, [addingTask])

  const filteredTasks = useMemo(() => {
    const visible = tasks.filter((t) => t.status !== 'archived')
    const byTab = visible.filter((t) => (activeTab === 'all' ? t.status === 'open' : t.status === 'done'))
    if (filterCategory === 'all') return byTab
    return byTab.filter((t) => t.category === filterCategory)
  }, [tasks, activeTab, filterCategory])

  const grouped = useMemo(
    () => groupTasks(filteredTasks, validCategories, activeAreas, useFocusAreasMode, sortBy),
    [filteredTasks, validCategories, activeAreas, useFocusAreasMode, sortBy],
  )

  const openCount = useMemo(
    () => tasks.filter((t) => t.status === 'open').length,
    [tasks],
  )
  const completedCount = useMemo(
    () => tasks.filter((t) => t.status === 'done').length,
    [tasks],
  )

  const handleAddTask = () => {
    const title = newTaskTitle.trim()
    if (!title) return
    const category = filterCategory !== 'all' ? filterCategory : defaultCategory
    addTask(title, category, 'manual')
    setNewTaskTitle('')
    setAddingTask(false)
  }

  const handleAddKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTask()
    }
    if (e.key === 'Escape') {
      setNewTaskTitle('')
      setAddingTask(false)
    }
  }

  return (
    <div className="tasks-view">
      <div className="tasks-view__bg" aria-hidden />

      <div className="tasks-view__shell">
        <header className="tasks-view__header">
          <div className="tasks-view__header-row">
            <h1 className="tasks-view__title">All Tasks</h1>
            <button
              type="button"
              className="tasks-view__add-btn"
              onClick={() => setAddingTask(true)}
            >
              <PlusIcon />
              Add task
            </button>
          </div>

          <div className="tasks-view__tabs" role="tablist" aria-label="Task filters">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'all'}
              className={`tasks-view__tab${activeTab === 'all' ? ' tasks-view__tab--active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All
              {openCount > 0 && <span className="tasks-view__tab-count">{openCount}</span>}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'completed'}
              className={`tasks-view__tab${activeTab === 'completed' ? ' tasks-view__tab--active' : ''}`}
              onClick={() => setActiveTab('completed')}
            >
              Completed
              {completedCount > 0 && <span className="tasks-view__tab-count">{completedCount}</span>}
            </button>
          </div>

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
                <option value="created_at">Newest first</option>
                <option value="alphabetical">Alphabetical</option>
              </select>
            </label>
          </div>
        </header>

        {addingTask && (
          <div className="tasks-view__add-row">
            <input
              ref={addInputRef}
              type="text"
              className="tasks-view__add-input"
              placeholder="What needs to get done?"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={handleAddKeyDown}
              onBlur={() => {
                if (!newTaskTitle.trim()) setAddingTask(false)
              }}
              aria-label="New task title"
            />
            <button
              type="button"
              className="tasks-view__add-submit"
              onClick={handleAddTask}
              disabled={!newTaskTitle.trim()}
            >
              Add
            </button>
            <button
              type="button"
              className="tasks-view__add-cancel"
              onClick={() => {
                setNewTaskTitle('')
                setAddingTask(false)
              }}
            >
              Cancel
            </button>
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

        {!loading && !error && grouped.length === 0 && (
          <div className="tasks-view__empty">
            <p className="tasks-view__empty-text">
              {activeTab === 'all' ? 'No open tasks yet. Add one to get started.' : 'No completed tasks yet.'}
            </p>
          </div>
        )}

        {!loading && !error && grouped.length > 0 && (
          <div className="tasks-view__groups">
            {grouped.map(({ id, label, color, emoji, tasks: groupTasks }) => (
              <section key={id} className="tasks-view__group">
                <header className="tasks-view__group-header">
                  <span
                    className="tasks-view__group-dot"
                    style={{ '--tasks-cat-color': color } as CSSProperties}
                    aria-hidden
                  >
                    {emoji ? (
                      <span className="tasks-view__group-emoji">{emoji}</span>
                    ) : (
                      <CategoryIcon categoryId={id} size={14} />
                    )}
                  </span>
                  <span className="tasks-view__group-label">{label.toUpperCase()}</span>
                  <span className="tasks-view__group-count">{groupTasks.length}</span>
                </header>
                <ul className="tasks-view__tasks">
                  {groupTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      isDone={task.status === 'done'}
                      categories={validCategories}
                      focusAreas={activeAreas}
                      useFocusAreasMode={useFocusAreasMode}
                      onToggle={() => toggleTask(task.id)}
                      onSaveTitle={(title) => updateTask(task.id, { title })}
                      onChangeCategory={(category) => updateTask(task.id, { category })}
                      onDelete={() => removeTask(task.id)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
