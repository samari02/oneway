import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import type { Task } from '@oneway/shared'
import { CategoryIcon } from './CategoryIcon'
import { TaskDetailPanel } from './TaskDetailPanel'
import {
  CheckIcon,
  GripIcon,
  PlusIcon,
  PLANNING_LABELS,
  type HierarchyItem,
  planningStyle,
} from './tasksViewShared'
import './HierarchyView.css'

type HierarchyViewProps = {
  buckets: HierarchyItem[]
  getSubsForBucket: (bucketId: string) => HierarchyItem[]
  tasks: Task[]
  getBucketForSub: (subId: string) => HierarchyItem | undefined
  selectedBucketId: string
  selectedSubId: string
  selectedTaskId: string | null
  onSelectBucket: (bucketId: string) => void
  onSelectSub: (subId: string) => void
  onSelectTask: (taskId: string | null) => void
  onAddBucket: (name: string, emoji?: string) => void | Promise<void>
  onAddSub: (bucketId: string, name: string, emoji?: string) => void | Promise<void>
  onAddTask: (title: string, subId: string) => void
  onToggleTask: (taskId: string) => void
  onUpdateTask: (taskId: string, updates: Partial<Pick<Task, 'title' | 'planning' | 'rawInput'>>) => void
  onDeleteTask: (taskId: string) => void
}

function countTasksForBucket(
  tasks: Task[],
  bucketId: string,
  getSubsForBucket: (id: string) => HierarchyItem[],
): number {
  const subIds = new Set(getSubsForBucket(bucketId).map((s) => s.id))
  return tasks.filter((t) => t.status === 'open' && (subIds.has(t.category) || t.category === bucketId)).length
}

function countTasksForSub(tasks: Task[], subId: string): number {
  return tasks.filter((t) => t.status === 'open' && t.category === subId).length
}

function HierarchyTaskCard({
  task,
  selected,
  onSelect,
  onToggle,
}: {
  task: Task
  selected: boolean
  onSelect: () => void
  onToggle: () => void
}) {
  const planning = task.planning ?? 'backlog'

  return (
    <li
      className={`hierarchy-view__task${selected ? ' hierarchy-view__task--selected' : ''}`}
      data-planning={planning}
    >
      <span className="hierarchy-view__task-grip" aria-hidden>
        <GripIcon />
      </span>
      <button
        type="button"
        className="hierarchy-view__checkbox"
        role="checkbox"
        aria-checked={false}
        aria-label={`Mark "${task.title}" as done`}
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
      >
        <CheckIcon />
      </button>
      <button type="button" className="hierarchy-view__task-body" onClick={onSelect}>
        <span className="hierarchy-view__task-title">{task.title}</span>
        <span
          className={`hierarchy-view__task-badge hierarchy-view__task-badge--${planning}`}
          style={planningStyle(planning)}
        >
          {PLANNING_LABELS[planning]}
        </span>
      </button>
    </li>
  )
}

function InlineAdd({
  placeholder,
  onSubmit,
  className,
}: {
  placeholder: string
  onSubmit: (value: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setValue('')
    setOpen(false)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
    if (e.key === 'Escape') {
      setValue('')
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className={`hierarchy-view__add-trigger${className ? ` ${className}` : ''}`}
        onClick={() => setOpen(true)}
      >
        <PlusIcon size={14} />
        {placeholder}
      </button>
    )
  }

  return (
    <div className="hierarchy-view__add-form">
      <input
        ref={inputRef}
        type="text"
        className="hierarchy-view__add-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!value.trim()) setOpen(false)
        }}
        aria-label={placeholder}
      />
      <button type="button" className="hierarchy-view__add-submit" onClick={submit} disabled={!value.trim()}>
        Add
      </button>
    </div>
  )
}

function SubBucketAddButton({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setValue('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        className="hierarchy-view__col-add-btn"
        aria-label="Add sub-bucket"
        onClick={() => setOpen(true)}
      >
        <PlusIcon size={14} />
      </button>
    )
  }

  return (
    <div className="hierarchy-view__header-add-form">
      <input
        ref={inputRef}
        type="text"
        className="hierarchy-view__header-add-input"
        placeholder="Sub name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          }
          if (e.key === 'Escape') {
            setValue('')
            setOpen(false)
          }
        }}
        onBlur={() => {
          if (!value.trim()) setOpen(false)
        }}
        aria-label="New sub-bucket name"
      />
    </div>
  )
}

export function HierarchyView({
  buckets,
  getSubsForBucket,
  tasks,
  getBucketForSub,
  selectedBucketId,
  selectedSubId,
  selectedTaskId,
  onSelectBucket,
  onSelectSub,
  onSelectTask,
  onAddBucket,
  onAddSub,
  onAddTask,
  onToggleTask,
  onUpdateTask,
  onDeleteTask,
}: HierarchyViewProps) {
  const openTasks = tasks.filter((t) => t.status === 'open')
  const selectedBucket = buckets.find((b) => b.id === selectedBucketId)
  const subs = selectedBucketId ? getSubsForBucket(selectedBucketId) : []
  const selectedSub = subs.find((s) => s.id === selectedSubId)
  const subTasks = selectedSubId
    ? openTasks.filter((t) => t.category === selectedSubId)
    : []

  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) : undefined
  const taskMeta = selectedTask
    ? (() => {
        const sub = getSubsForBucket(selectedBucketId).find((s) => s.id === selectedTask.category)
          ?? { id: selectedTask.category, label: selectedTask.category, color: '#a78bfa' }
        const bucket = getBucketForSub(selectedTask.category) ?? selectedBucket
        return {
          bucketLabel: bucket?.label ?? '—',
          subLabel: sub.label,
          subColor: sub.color ?? '#a78bfa',
        }
      })()
    : null

  return (
    <div className={`hierarchy-view${selectedTask ? ' hierarchy-view--with-panel' : ''}`}>
      <div className="hierarchy-view__columns">
        {/* Column 1: Buckets */}
        <section className="hierarchy-view__col" aria-label="Buckets">
          <header className="hierarchy-view__col-header">
            <span className="hierarchy-view__col-title">Buckets</span>
          </header>
          <ul className="hierarchy-view__list">
            {buckets.map((bucket) => {
              const count = countTasksForBucket(openTasks, bucket.id, getSubsForBucket)
              const isSelected = bucket.id === selectedBucketId
              return (
                <li key={bucket.id}>
                  <button
                    type="button"
                    className={`hierarchy-view__item${isSelected ? ' hierarchy-view__item--selected' : ''}`}
                    onClick={() => onSelectBucket(bucket.id)}
                  >
                    <span className="hierarchy-view__item-icon" aria-hidden>
                      {bucket.emoji ? (
                        <span className="hierarchy-view__item-emoji">{bucket.emoji}</span>
                      ) : (
                        <CategoryIcon categoryId={bucket.id} size={16} />
                      )}
                    </span>
                    <span className="hierarchy-view__item-label">{bucket.label}</span>
                    <span className="hierarchy-view__item-count">{count}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <InlineAdd
            placeholder="New bucket"
            onSubmit={(name) => void onAddBucket(name)}
            className="hierarchy-view__add-trigger--footer"
          />
        </section>

        {/* Column 2: Sub-buckets */}
        <section className="hierarchy-view__col" aria-label="Sub-buckets">
          <header className="hierarchy-view__col-header">
            <span className="hierarchy-view__col-title">
              Sub-buckets
              {selectedBucket && (
                <span className="hierarchy-view__col-context"> · {selectedBucket.label}</span>
              )}
            </span>
            {selectedBucketId && (
              <SubBucketAddButton
                onAdd={(name) => void onAddSub(selectedBucketId, name)}
              />
            )}
          </header>
          {!selectedBucketId ? (
            <p className="hierarchy-view__empty-hint">Select a bucket</p>
          ) : subs.length === 0 ? (
            <div className="hierarchy-view__empty-col">
              <p className="hierarchy-view__empty-hint">No sub-buckets yet</p>
              <InlineAdd
                placeholder="New sub-bucket"
                onSubmit={(name) => void onAddSub(selectedBucketId, name)}
              />
            </div>
          ) : (
            <ul className="hierarchy-view__list">
              {subs.map((sub) => {
                const count = countTasksForSub(openTasks, sub.id)
                const isSelected = sub.id === selectedSubId
                return (
                  <li key={sub.id}>
                    <button
                      type="button"
                      className={`hierarchy-view__item${isSelected ? ' hierarchy-view__item--selected' : ''}`}
                      onClick={() => onSelectSub(sub.id)}
                    >
                      <span
                        className="hierarchy-view__item-dot"
                        style={{ '--tasks-cat-color': sub.color ?? '#a78bfa' } as CSSProperties}
                        aria-hidden
                      />
                      <span className="hierarchy-view__item-label">{sub.label}</span>
                      <span className="hierarchy-view__item-count">{count}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Column 3: Tasks */}
        <section className="hierarchy-view__col hierarchy-view__col--tasks" aria-label="Tasks">
          <header className="hierarchy-view__col-header">
            <span className="hierarchy-view__col-title">
              Tasks
              {selectedSub && (
                <span className="hierarchy-view__col-context"> · {selectedSub.label}</span>
              )}
            </span>
          </header>
          {!selectedSubId ? (
            <p className="hierarchy-view__empty-hint">Select a sub-bucket</p>
          ) : subTasks.length === 0 ? (
            <div className="hierarchy-view__empty-col">
              <p className="hierarchy-view__empty-hint">No tasks yet</p>
              <InlineAdd
                placeholder="Add task"
                onSubmit={(title) => onAddTask(title, selectedSubId)}
              />
            </div>
          ) : (
            <>
              <ul className="hierarchy-view__task-list">
                {subTasks.map((task) => (
                  <HierarchyTaskCard
                    key={task.id}
                    task={task}
                    selected={task.id === selectedTaskId}
                    onSelect={() => onSelectTask(task.id)}
                    onToggle={() => onToggleTask(task.id)}
                  />
                ))}
              </ul>
              <InlineAdd
                placeholder="Add task"
                onSubmit={(title) => onAddTask(title, selectedSubId)}
                className="hierarchy-view__add-trigger--footer"
              />
            </>
          )}
        </section>
      </div>

      {selectedTask && taskMeta && (
        <TaskDetailPanel
          task={selectedTask}
          bucketLabel={taskMeta.bucketLabel}
          subLabel={taskMeta.subLabel}
          subColor={taskMeta.subColor}
          onClose={() => onSelectTask(null)}
          onSaveTitle={(title) => onUpdateTask(selectedTask.id, { title })}
          onPlanningChange={(planning) => onUpdateTask(selectedTask.id, { planning })}
          onRawInputChange={(rawInput) => onUpdateTask(selectedTask.id, { rawInput })}
          onToggle={() => onToggleTask(selectedTask.id)}
          onDelete={() => {
            onDeleteTask(selectedTask.id)
            onSelectTask(null)
          }}
        />
      )}
    </div>
  )
}