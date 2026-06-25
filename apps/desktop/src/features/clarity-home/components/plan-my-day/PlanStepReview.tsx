import { useMemo, type CSSProperties } from 'react'
import type { Task } from '../../hooks/useTaskStore'
import type { Category } from '../../hooks/useCategoryStore'

type PlanStepReviewProps = {
  tasks: Task[]
  categories: Category[]
  existingTaskTitles: Set<string>
  onConfirm: () => void
  onEdit: () => void
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

export function PlanStepReview({
  tasks,
  categories,
  existingTaskTitles,
  onConfirm,
  onEdit,
}: PlanStepReviewProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      const list = map.get(task.category) ?? []
      list.push(task)
      map.set(task.category, list)
    }

    const catOrder = new Map(categories.filter((c) => c?.id).map((c, i) => [c.id, i]))
    return Array.from(map.entries())
      .sort(([a], [b]) => (catOrder.get(a) ?? 99) - (catOrder.get(b) ?? 99))
      .map(([catId, catTasks]) => {
        const cat = categories.find((c) => c.id === catId)
        return {
          category: cat ?? { id: catId, label: catId, emoji: '•', color: '#a78bfa', order: 99 },
          tasks: catTasks,
        }
      })
  }, [tasks, categories])

  const isNew = (title: string) => !existingTaskTitles.has(title.trim().toLowerCase().replace(/\s+/g, ' '))

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
                  <span className="pmd-review__task-title">{task.title}</span>
                  {isNew(task.title) && (
                    <span className="pmd-review__badge">New</span>
                  )}
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
        >
          <CheckIcon />
          Looks good
        </button>
        <button
          type="button"
          className="uh-btn uh-btn--ghost uh-btn--wide"
          onClick={onEdit}
        >
          <EditIcon />
          Edit
        </button>
      </div>
    </div>
  )
}
