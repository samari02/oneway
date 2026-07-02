import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'
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
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '@oneway/shared'
import { CategoryIcon } from './CategoryIcon'
import { TaskDetailPanel } from './TaskDetailPanel'
import {
  CheckIcon,
  GripIcon,
  PlusIcon,
  SortAlphaIcon,
  PLANNING_LABELS,
  InlineEditableLabel,
  type HierarchyItem,
  type InlineEditableLabelHandle,
  planningStyle,
} from './tasksViewShared'
import { compareTasksByOrder } from '../hooks/useTaskStore'
import {
  TasksContextMenu,
  useTasksContextMenu,
} from './TasksContextMenu'
import './HierarchyView.css'

const HIER_BUCKET_PREFIX = 'hierarchy-bucket:'
const HIER_SUB_PREFIX = 'hierarchy-sub:'
const HIER_TASK_PREFIX = 'hierarchy-task:'

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
  onMoveSubToBucket: (subId: string, bucketId: string) => void
  onMoveTaskToSub: (taskId: string, subId: string) => void
  onMoveTaskToBucket: (taskId: string, bucketId: string) => void
  onReorderTasksInCategory: (taskId: string, categoryId: string, orderedIds: string[]) => void
  onSortCategoryAlphabetically: (categoryId: string) => void
  onSortBucketAlphabetically: (bucketId: string) => void
  onRenameBucket: (bucketId: string, label: string) => void
  onRenameSub: (subId: string, label: string) => void
  onDeleteBucket: (bucketId: string) => void
  onDeleteSub: (subId: string) => void
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

function CategorySortButton({
  label,
  onClick,
  className,
}: {
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      className={`hierarchy-view__sort-btn${className ? ` ${className}` : ''}`}
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

function HierarchyBucketItem({
  bucket,
  count,
  selected,
  acceptSubDrop,
  acceptTaskDrop,
  onSelect,
  onRename,
  onDelete,
  onSortAlphabetically,
  openContextMenu,
}: {
  bucket: HierarchyItem
  count: number
  selected: boolean
  acceptSubDrop: boolean
  acceptTaskDrop: boolean
  onSelect: () => void
  onRename: (label: string) => void
  onDelete: () => void
  onSortAlphabetically: () => void
  openContextMenu: ReturnType<typeof useTasksContextMenu>['openMenu']
}) {
  const labelRef = useRef<InlineEditableLabelHandle>(null)
  const { setNodeRef, isOver } = useDroppable({ id: `${HIER_BUCKET_PREFIX}${bucket.id}` })
  const showOver = (acceptSubDrop || acceptTaskDrop) && isOver

  const handleContextMenu = (event: MouseEvent) => {
    openContextMenu(event, [
      { id: 'rename', label: 'Rename', onSelect: () => labelRef.current?.startEditing() },
      { id: 'delete', label: 'Delete', danger: true, onSelect: onDelete },
    ])
  }

  return (
    <li ref={setNodeRef}>
      <div
        role="button"
        tabIndex={0}
        className={`hierarchy-view__item${selected ? ' hierarchy-view__item--selected' : ''}${showOver ? ' hierarchy-view__item--over' : ''}`}
        onClick={onSelect}
        onContextMenu={handleContextMenu}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect()
          }
        }}
      >
        <span className="hierarchy-view__item-icon" aria-hidden>
          {bucket.emoji ? (
            <span className="hierarchy-view__item-emoji">{bucket.emoji}</span>
          ) : (
            <CategoryIcon categoryId={bucket.id} size={16} />
          )}
        </span>
        <InlineEditableLabel
          ref={labelRef}
          value={bucket.label}
          onSave={onRename}
          className="hierarchy-view__item-label hierarchy-view__item-label--editable"
          inputClassName="hierarchy-view__item-input"
          ariaLabel={`Edit bucket name "${bucket.label}"`}
        />
        <CategorySortButton label={bucket.label} onClick={onSortAlphabetically} />
        <span className="hierarchy-view__item-count">{count}</span>
      </div>
    </li>
  )
}

function HierarchySubItem({
  sub,
  count,
  selected,
  acceptTaskDrop,
  onSelect,
  onRename,
  onDelete,
  onSortAlphabetically,
  openContextMenu,
}: {
  sub: HierarchyItem
  count: number
  selected: boolean
  acceptTaskDrop: boolean
  onSelect: () => void
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
  } = useDraggable({ id: `${HIER_SUB_PREFIX}${sub.id}` })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `${HIER_SUB_PREFIX}${sub.id}` })

  const setNodeRef = (node: HTMLLIElement | null) => {
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
    <li
      ref={setNodeRef}
      style={style}
      className={`hierarchy-view__sub-row${isDragging ? ' hierarchy-view__sub-row--dragging' : ''}`}
    >
      <div
        className={`hierarchy-view__item hierarchy-view__item--sub${selected ? ' hierarchy-view__item--selected' : ''}${showOver ? ' hierarchy-view__item--over' : ''}`}
        onContextMenu={handleContextMenu}
      >
        <button
          type="button"
          className="hierarchy-view__item-grip"
          aria-label={`Drag sub-bucket ${sub.label}`}
          {...attributes}
          {...listeners}
        >
          <GripIcon />
        </button>
        <div
          role="button"
          tabIndex={0}
          className="hierarchy-view__item-body"
          onClick={onSelect}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onSelect()
            }
          }}
        >
          <span
            className="hierarchy-view__item-dot"
            style={{ '--tasks-cat-color': sub.color ?? '#a78bfa' } as CSSProperties}
            aria-hidden
          />
          <InlineEditableLabel
            ref={labelRef}
            value={sub.label}
            onSave={onRename}
            className="hierarchy-view__item-label hierarchy-view__item-label--editable"
            inputClassName="hierarchy-view__item-input"
            ariaLabel={`Edit sub-bucket name "${sub.label}"`}
          />
          <CategorySortButton label={sub.label} onClick={onSortAlphabetically} />
          <span className="hierarchy-view__item-count">{count}</span>
        </div>
      </div>
    </li>
  )
}

function HierarchyTaskCard({
  task,
  selected,
  onSelect,
  onToggle,
  onDelete,
  openContextMenu,
}: {
  task: Task
  selected: boolean
  onSelect: () => void
  onToggle: () => void
  onDelete: () => void
  openContextMenu: ReturnType<typeof useTasksContextMenu>['openMenu']
}) {
  const planning = task.planning ?? 'backlog'

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${HIER_TASK_PREFIX}${task.id}` })

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
      className={`hierarchy-view__task${selected ? ' hierarchy-view__task--selected' : ''}${isDragging ? ' hierarchy-view__task--dragging' : ''}`}
      data-planning={planning}
      onContextMenu={handleContextMenu}
    >
      <button
        type="button"
        className="hierarchy-view__task-grip"
        aria-label={`Drag task ${task.title}`}
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>
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
  onMoveSubToBucket,
  onMoveTaskToSub,
  onMoveTaskToBucket,
  onReorderTasksInCategory,
  onSortCategoryAlphabetically,
  onSortBucketAlphabetically,
  onRenameBucket,
  onRenameSub,
  onDeleteBucket,
  onDeleteSub,
}: HierarchyViewProps) {
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const { menu, openMenu, closeMenu } = useTasksContextMenu()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const openTasks = tasks.filter((t) => t.status === 'open')
  const selectedBucket = buckets.find((b) => b.id === selectedBucketId)
  const subs = selectedBucketId ? getSubsForBucket(selectedBucketId) : []
  const selectedSub = subs.find((s) => s.id === selectedSubId)
  const subTasks = useMemo(() => {
    if (!selectedSubId) return []
    return openTasks
      .filter((t) => t.category === selectedSubId)
      .sort(compareTasksByOrder)
  }, [openTasks, selectedSubId])

  const subTaskSortableIds = useMemo(
    () => subTasks.map((task) => `${HIER_TASK_PREFIX}${task.id}`),
    [subTasks],
  )

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

  const draggingSub = activeDragId?.startsWith(HIER_SUB_PREFIX) ?? false
  const draggingTask = activeDragId?.startsWith(HIER_TASK_PREFIX) ?? false

  const activeDragLabel = (() => {
    if (!activeDragId) return null
    if (activeDragId.startsWith(HIER_SUB_PREFIX)) {
      const subId = activeDragId.slice(HIER_SUB_PREFIX.length)
      const sub =
        subs.find((s) => s.id === subId)
        ?? buckets.flatMap((b) => getSubsForBucket(b.id)).find((s) => s.id === subId)
      return sub?.label ?? 'Sub-bucket'
    }
    if (activeDragId.startsWith(HIER_TASK_PREFIX)) {
      const taskId = activeDragId.slice(HIER_TASK_PREFIX.length)
      return tasks.find((t) => t.id === taskId)?.title ?? 'Task'
    }
    return null
  })()

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id))
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

    if (activeId.startsWith(HIER_SUB_PREFIX) && overId.startsWith(HIER_BUCKET_PREFIX)) {
      const subId = activeId.slice(HIER_SUB_PREFIX.length)
      const bucketId = overId.slice(HIER_BUCKET_PREFIX.length)
      onMoveSubToBucket(subId, bucketId)
      return
    }

    if (activeId.startsWith(HIER_TASK_PREFIX) && overId.startsWith(HIER_TASK_PREFIX)) {
      const activeTaskId = activeId.slice(HIER_TASK_PREFIX.length)
      const overTaskId = overId.slice(HIER_TASK_PREFIX.length)
      if (activeTaskId === overTaskId) return

      const activeTask = tasks.find((t) => t.id === activeTaskId)
      const overTask = tasks.find((t) => t.id === overTaskId)
      if (!activeTask || !overTask || activeTask.category !== overTask.category) return

      const oldIndex = subTasks.findIndex((t) => t.id === activeTaskId)
      const newIndex = subTasks.findIndex((t) => t.id === overTaskId)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

      const reordered = arrayMove(subTasks, oldIndex, newIndex)
      onReorderTasksInCategory(activeTaskId, activeTask.category, reordered.map((t) => t.id))
      return
    }

    if (activeId.startsWith(HIER_TASK_PREFIX) && overId.startsWith(HIER_BUCKET_PREFIX)) {
      const taskId = activeId.slice(HIER_TASK_PREFIX.length)
      const bucketId = overId.slice(HIER_BUCKET_PREFIX.length)
      onMoveTaskToBucket(taskId, bucketId)
      return
    }

    if (activeId.startsWith(HIER_TASK_PREFIX) && overId.startsWith(HIER_SUB_PREFIX)) {
      const taskId = activeId.slice(HIER_TASK_PREFIX.length)
      const subId = overId.slice(HIER_SUB_PREFIX.length)
      onMoveTaskToSub(taskId, subId)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className={`hierarchy-view${selectedTask ? ' hierarchy-view--with-panel' : ''}`}>
        <div className="hierarchy-view__columns">
          {/* Column 1: Buckets */}
          <section className="hierarchy-view__col" aria-label="Buckets">
            <header className="hierarchy-view__col-header">
              <span className="hierarchy-view__col-title">Buckets</span>
            </header>
            <ul className="hierarchy-view__list">
              {buckets.map((bucket) => (
                <HierarchyBucketItem
                  key={bucket.id}
                  bucket={bucket}
                  count={countTasksForBucket(openTasks, bucket.id, getSubsForBucket)}
                  selected={bucket.id === selectedBucketId}
                  acceptSubDrop={draggingSub}
                  acceptTaskDrop={draggingTask}
                  onSelect={() => onSelectBucket(bucket.id)}
                  onRename={(label) => onRenameBucket(bucket.id, label)}
                  onDelete={() => onDeleteBucket(bucket.id)}
                  onSortAlphabetically={() => onSortBucketAlphabetically(bucket.id)}
                  openContextMenu={openMenu}
                />
              ))}
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
                <div className="hierarchy-view__col-header-actions">
                  {selectedSubId && (
                    <CategorySortButton
                      label={selectedSub?.label ?? 'tasks'}
                      onClick={() => onSortCategoryAlphabetically(selectedSubId)}
                    />
                  )}
                  <SubBucketAddButton
                    onAdd={(name) => void onAddSub(selectedBucketId, name)}
                  />
                </div>
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
                {subs.map((sub) => (
                  <HierarchySubItem
                    key={sub.id}
                    sub={sub}
                    count={countTasksForSub(openTasks, sub.id)}
                    selected={sub.id === selectedSubId}
                    acceptTaskDrop={draggingTask}
                    onSelect={() => onSelectSub(sub.id)}
                    onRename={(label) => onRenameSub(sub.id, label)}
                    onDelete={() => onDeleteSub(sub.id)}
                    onSortAlphabetically={() => onSortCategoryAlphabetically(sub.id)}
                    openContextMenu={openMenu}
                  />
                ))}
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
              {selectedSubId && (
                <CategorySortButton
                  label={selectedSub?.label ?? 'tasks'}
                  onClick={() => onSortCategoryAlphabetically(selectedSubId)}
                />
              )}
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
                <SortableContext items={subTaskSortableIds} strategy={verticalListSortingStrategy}>
                  <ul className="hierarchy-view__task-list">
                    {subTasks.map((task) => (
                      <HierarchyTaskCard
                        key={task.id}
                        task={task}
                        selected={task.id === selectedTaskId}
                        onSelect={() => onSelectTask(task.id)}
                        onToggle={() => onToggleTask(task.id)}
                        onDelete={() => {
                          onDeleteTask(task.id)
                          if (selectedTaskId === task.id) onSelectTask(null)
                        }}
                        openContextMenu={openMenu}
                      />
                    ))}
                  </ul>
                </SortableContext>
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

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
        {activeDragLabel ? (
          <div className="hierarchy-view__drag-overlay">{activeDragLabel}</div>
        ) : null}
      </DragOverlay>

      <TasksContextMenu menu={menu} onClose={closeMenu} />
    </DndContext>
  )
}
