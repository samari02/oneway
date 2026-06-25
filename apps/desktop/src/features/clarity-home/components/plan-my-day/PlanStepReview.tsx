import { useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react'
import type { Task } from '../../hooks/useTaskStore'
import type { Category } from '../../hooks/useCategoryStore'

type PlanStepReviewProps = {
  tasks: Task[]
  categories: Category[]
  existingTaskTitles: Set<string>
  onConfirm: () => void
  onEdit: () => void
  onTasksChange: (tasks: Task[]) => void
  onAddMore: () => void
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
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

function RemoveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export function PlanStepReview({
  tasks,
  categories,
  existingTaskTitles,
  onConfirm,
  onEdit,
  onTasksChange,
  onAddMore,
}: PlanStepReviewProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const validCategories = useMemo(
    () => categories.filter((c) => c?.id).sort((a, b) => a.order - b.order),
    [categories],
  )

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      const list = map.get(task.category) ?? []
      list.push(task)
      map.set(task.category, list)
    }

    const catOrder = new Map(validCategories.map((c, i) => [c.id, i]))
    return Array.from(map.entries())
      .sort(([a], [b]) => (catOrder.get(a) ?? 99) - (catOrder.get(b) ?? 99))
      .map(([catId, catTasks]) => {
        const cat = validCategories.find((c) => c.id === catId)
        return {
          category: cat ?? { id: catId, label: catId, emoji: '•', color: '#a78bfa', order: 99 },
          tasks: catTasks,
        }
      })
  }, [tasks, validCategories])

  const isNew = (title: string) =>
    !existingTaskTitles.has(title.trim().toLowerCase().replace(/\s+/g, ' '))

  const updateTask = (id: string, updates: Partial<Pick<Task, 'title' | 'category'>>) => {
    onTasksChange(tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)))
  }

  const removeTask = (id: string) => {
    onTasksChange(tasks.filter((t) => t.id !== id))
    if (editingId === id) {
      setEditingId(null)
      setEditTitle('')
    }
  }

  const startEditing = (task: Task) => {
    setEditingId(task.id)
    setEditTitle(task.title)
  }

  const commitTitleEdit = (id: string) => {
    const trimmed = editTitle.trim()
    if (trimmed) {
      updateTask(id, { title: trimmed })
    }
    setEditingId(null)
    setEditTitle('')
  }

  const handleTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitTitleEdit(id)
    }
    if (e.key === 'Escape') {
      setEditingId(null)
      setEditTitle('')
    }
  }

  return (
    <div className="pmd-review">
      <h2 className="pmd-review__heading">Here&apos;s how I organized things.</h2>

      <div className="pmd-review__groups">
        {grouped.map(({ category, tasks: catTasks }) => (
          <div key={category.id} className="pmd-review__group">
            <div className="pmd-review__group-header">
              <span
                className="pmd-review__group-dot"
                style={{ '--pmd-cat-color': category.color } as CSSProperties}
                aria-hidden
              >
                {category.emoji}
              </span>
              <span className="pmd-review__group-label">{category.label}</span>
              <span className="pmd-review__group-count">{catTasks.length}</span>
            </div>
            <ul className="pmd-review__tasks">
              {catTasks.map((task) => (
                <li key={task.id} className="pmd-review__task">
                  <div className="pmd-review__task-body">
                    {editingId === task.id ? (
                      <input
                        type="text"
                        className="pmd-review__task-input"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => commitTitleEdit(task.id)}
                        onKeyDown={(e) => handleTitleKeyDown(e, task.id)}
                        autoFocus
                        aria-label="Edit task title"
                      />
                    ) : (
                      <button
                        type="button"
                        className="pmd-review__task-title-btn"
                        onClick={() => startEditing(task)}
                        title="Click to rename"
                      >
                        <span className="pmd-review__task-title">{task.title}</span>
                      </button>
                    )}
                    {task.rawInput && task.rawInput !== task.title && (
                      <span className="pmd-review__task-raw">{task.rawInput}</span>
                    )}
                  </div>

                  <select
                    className="pmd-review__category-select"
                    value={task.category}
                    onChange={(e) => updateTask(task.id, { category: e.target.value })}
                    aria-label={`Category for ${task.title}`}
                    style={
                      {
                        '--pmd-cat-color':
                          validCategories.find((c) => c.id === task.category)?.color ?? category.color,
                      } as CSSProperties
                    }
                  >
                    {validCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.emoji} {cat.label}
                      </option>
                    ))}
                  </select>

                  {isNew(task.title) && <span className="pmd-review__badge">New</span>}

                  <button
                    type="button"
                    className="pmd-review__remove"
                    onClick={() => removeTask(task.id)}
                    aria-label={`Remove ${task.title}`}
                  >
                    <RemoveIcon />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="pmd-review__actions">
        <button
          type="button"
          className="uh-btn uh-btn--primary uh-btn--wide"
          onClick={onConfirm}
          disabled={tasks.length === 0}
        >
          <CheckIcon />
          Looks good
        </button>
        <button type="button" className="uh-btn uh-btn--ghost uh-btn--wide" onClick={onAddMore}>
          <PlusIcon />
          Add more
        </button>
        <button type="button" className="uh-btn uh-btn--ghost uh-btn--wide" onClick={onEdit}>
          <EditIcon />
          Edit
        </button>
      </div>
    </div>
  )
}
