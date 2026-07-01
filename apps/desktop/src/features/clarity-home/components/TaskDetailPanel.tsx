import { useEffect, useState, type KeyboardEvent } from 'react'
import type { Task, TaskPlanning } from '@oneway/shared'
import {
  CloseIcon,
  PLANNING_CYCLE,
  PLANNING_LABELS,
  TrashIcon,
  formatDate,
  planningStyle,
} from './tasksViewShared'
import './TaskDetailPanel.css'

type TaskDetailPanelProps = {
  task: Task
  bucketLabel: string
  subLabel: string
  subColor: string
  onClose: () => void
  onSaveTitle: (title: string) => void
  onPlanningChange: (planning: TaskPlanning) => void
  onRawInputChange: (rawInput: string) => void
  onToggle: () => void
  onDelete: () => void
}

export function TaskDetailPanel({
  task,
  bucketLabel,
  subLabel,
  subColor,
  onClose,
  onSaveTitle,
  onPlanningChange,
  onRawInputChange,
  onToggle,
  onDelete,
}: TaskDetailPanelProps) {
  const [titleDraft, setTitleDraft] = useState(task.title)
  const [notesDraft, setNotesDraft] = useState(task.rawInput ?? '')
  const planning = task.planning ?? 'backlog'

  useEffect(() => {
    setTitleDraft(task.title)
  }, [task.title])

  useEffect(() => {
    setNotesDraft(task.rawInput ?? '')
  }, [task.rawInput])

  const commitTitle = () => {
    const next = titleDraft.trim()
    if (!next) {
      setTitleDraft(task.title)
      return
    }
    if (next !== task.title) onSaveTitle(next)
  }

  const commitNotes = () => {
    const next = notesDraft.trim()
    if (next !== (task.rawInput ?? '')) onRawInputChange(next)
  }

  const handleTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitTitle()
    if (e.key === 'Escape') setTitleDraft(task.title)
  }

  return (
    <aside className="task-detail-panel" aria-label="Task details">
      <header className="task-detail-panel__header">
        <input
          className="task-detail-panel__title"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={handleTitleKeyDown}
          aria-label="Task title"
        />
        <div className="task-detail-panel__header-actions">
          <button
            type="button"
            className="task-detail-panel__icon-btn"
            aria-label={task.status === 'done' ? 'Mark as open' : 'Mark as done'}
            onClick={onToggle}
            title={task.status === 'done' ? 'Mark as open' : 'Mark as done'}
          >
            {task.status === 'done' ? '↩' : '✓'}
          </button>
          <button
            type="button"
            className="task-detail-panel__icon-btn"
            aria-label="Close panel"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <span
        className={`task-detail-panel__planning-pill task-detail-panel__planning-pill--${planning}`}
        style={planningStyle(planning)}
      >
        {PLANNING_LABELS[planning]}
      </span>

      <dl className="task-detail-panel__meta">
        <div className="task-detail-panel__meta-row">
          <dt>Sub-bucket</dt>
          <dd>
            <span
              className="task-detail-panel__meta-pill"
              style={{ '--tasks-cat-color': subColor } as React.CSSProperties}
            >
              {subLabel}
            </span>
          </dd>
        </div>
        <div className="task-detail-panel__meta-row">
          <dt>Bucket</dt>
          <dd>{bucketLabel}</dd>
        </div>
        <div className="task-detail-panel__meta-row">
          <dt>Planning</dt>
          <dd>
            <select
              className="task-detail-panel__select"
              value={planning}
              onChange={(e) => onPlanningChange(e.target.value as TaskPlanning)}
              aria-label="Planning horizon"
            >
              {PLANNING_CYCLE.map((p) => (
                <option key={p} value={p}>
                  {PLANNING_LABELS[p]}
                </option>
              ))}
            </select>
          </dd>
        </div>
      </dl>

      <label className="task-detail-panel__field">
        <span className="task-detail-panel__field-label">Description</span>
        <textarea
          className="task-detail-panel__textarea"
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={commitNotes}
          placeholder="Add a description…"
          rows={4}
          aria-label="Task description"
        />
      </label>

      <footer className="task-detail-panel__footer">
        <span className="task-detail-panel__dates">
          Created {formatDate(task.createdAt)}
        </span>
        <button
          type="button"
          className="task-detail-panel__delete"
          onClick={onDelete}
          aria-label={`Delete "${task.title}"`}
        >
          <TrashIcon />
          Delete
        </button>
      </footer>
    </aside>
  )
}
