import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { Task, TaskPlanning, TaskSource, TaskStatus } from '@oneway/shared'
import {
  createTask,
  createTasks,
  deleteTaskById,
  getTasks,
  migrateLocalTasksToSupabase,
  updateTaskById,
} from '../api/tasks'

export type { Task, TaskPlanning, TaskSource, TaskStatus }

export const PLANNING_COLUMNS: TaskPlanning[] = ['today', 'next', 'later', 'backlog']

type TaskStoreSnapshot = {
  tasks: Task[]
  loading: boolean
  error: string | null
}

const listeners = new Set<() => void>()

let snapshot: TaskStoreSnapshot = {
  tasks: [],
  loading: false,
  error: null,
}

let activeUserId: string | undefined
let loadedUserId: string | null = null
let fetchGeneration = 0

function emitChange() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): TaskStoreSnapshot {
  return snapshot
}

function getServerSnapshot(): TaskStoreSnapshot {
  return { tasks: [], loading: false, error: null }
}

function setSnapshot(next: TaskStoreSnapshot) {
  snapshot = next
  emitChange()
}

function patchTasks(updater: (tasks: Task[]) => Task[]) {
  setSnapshot({
    ...snapshot,
    tasks: updater(snapshot.tasks),
  })
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ')
}

function generateId(): string {
  return crypto.randomUUID()
}

function compareTasks(a: Task, b: Task): number {
  const orderA = a.sort_order ?? 0
  const orderB = b.sort_order ?? 0
  if (orderA !== orderB) return orderA - orderB
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}

export function groupTasksByPlanning(tasks: Task[]): Record<TaskPlanning, Task[]> {
  const groups: Record<TaskPlanning, Task[]> = {
    today: [],
    next: [],
    later: [],
    backlog: [],
  }

  for (const task of tasks) {
    const planning = task.planning ?? 'backlog'
    groups[planning].push(task)
  }

  for (const key of PLANNING_COLUMNS) {
    groups[key].sort(compareTasks)
  }

  return groups
}

export function groupTasksByCategory(tasks: Task[], categoryIds: string[]): Record<string, Task[]> {
  const groups: Record<string, Task[]> = {}
  for (const id of categoryIds) {
    groups[id] = []
  }

  for (const task of tasks) {
    const key = groups[task.category] ? task.category : categoryIds[0] ?? task.category
    if (!groups[key]) groups[key] = []
    groups[key].push(task)
  }

  for (const key of Object.keys(groups)) {
    groups[key].sort(compareTasks)
  }

  return groups
}

async function loadTasksForUser(userId: string): Promise<void> {
  const generation = ++fetchGeneration
  setSnapshot({ ...snapshot, loading: true, error: null })

  try {
    let tasks = await getTasks(userId)
    const migrated = await migrateLocalTasksToSupabase(userId, tasks)
    if (migrated.length > 0) {
      tasks = [...tasks, ...migrated]
    }

    if (generation !== fetchGeneration || activeUserId !== userId) return
    loadedUserId = userId
    setSnapshot({ tasks, loading: false, error: null })
  } catch (err) {
    if (generation !== fetchGeneration || activeUserId !== userId) return
    const msg = err instanceof Error ? err.message : 'Failed to load tasks'
    setSnapshot({ tasks: [], loading: false, error: msg })
  }
}

function buildTaskUpdates(task: Task) {
  return {
    title: task.title,
    category: task.category,
    status: task.status,
    completed_at: task.completedAt ?? null,
    planning: task.planning ?? 'backlog',
    sort_order: task.sort_order ?? 0,
  }
}

export function useTaskStore(userId: string | undefined) {
  useEffect(() => {
    if (!userId) {
      fetchGeneration += 1
      activeUserId = undefined
      loadedUserId = null
      setSnapshot({ tasks: [], loading: false, error: null })
      return
    }

    if (loadedUserId === userId) return

    activeUserId = userId
    void loadTasksForUser(userId)
  }, [userId])

  const tasks = useSyncExternalStore(
    subscribe,
    () => getSnapshot().tasks,
    () => getServerSnapshot().tasks,
  )
  const loading = useSyncExternalStore(
    subscribe,
    () => getSnapshot().loading,
    () => getServerSnapshot().loading,
  )
  const error = useSyncExternalStore(
    subscribe,
    () => getSnapshot().error,
    () => getServerSnapshot().error,
  )

  const addTask = useCallback(
    (
      title: string,
      category: string,
      source: TaskSource = 'manual',
      planning: TaskPlanning = 'backlog',
    ): Task | null => {
      if (!userId) return null

      const columnTasks = snapshot.tasks.filter(
        (t) => t.status === 'open' && (t.planning ?? 'backlog') === planning,
      )
      const maxOrder = columnTasks.reduce((max, t) => Math.max(max, t.sort_order ?? 0), -1)

      const task: Task = {
        id: generateId(),
        title: title.trim(),
        category,
        status: 'open',
        createdAt: new Date().toISOString(),
        source,
        planning,
        sort_order: maxOrder + 1,
      }

      patchTasks((current) => [...current, task])

      void createTask(userId, task).catch((err) => {
        console.error('[tasks] Failed to create:', err)
        patchTasks((current) => current.filter((t) => t.id !== task.id))
      })

      return task
    },
    [userId],
  )

  const updateTask = useCallback(
    (
      id: string,
      updates: Partial<Pick<Task, 'title' | 'category' | 'status' | 'planning' | 'sort_order'>>,
    ) => {
      if (!userId) return

      const previous = snapshot.tasks
      patchTasks((current) =>
        current.map((t) => {
          if (t.id !== id) return t
          const next = { ...t, ...updates }
          if (updates.status === 'done' && t.status !== 'done') {
            next.completedAt = new Date().toISOString()
          }
          if (updates.status === 'open') {
            next.completedAt = undefined
          }
          return next
        }),
      )

      const updated = snapshot.tasks.find((t) => t.id === id)
      if (!updated) return

      void updateTaskById(id, buildTaskUpdates(updated)).catch((err) => {
        console.error('[tasks] Failed to update:', err)
        setSnapshot({ ...snapshot, tasks: previous })
      })
    },
    [userId],
  )

  const reorderTask = useCallback(
    (taskId: string, targetPlanning: TaskPlanning, orderedIds: string[]) => {
      if (!userId) return

      const previous = snapshot.tasks
      const orderMap = new Map(orderedIds.map((id, index) => [id, index]))

      patchTasks((current) =>
        current.map((t) => {
          if (!orderMap.has(t.id)) return t
          return {
            ...t,
            planning: t.id === taskId ? targetPlanning : t.planning ?? 'backlog',
            sort_order: orderMap.get(t.id),
          }
        }),
      )

      const changed = snapshot.tasks.filter((t) => orderMap.has(t.id))
      void Promise.all(changed.map((t) => updateTaskById(t.id, buildTaskUpdates(t)))).catch(
        (err) => {
          console.error('[tasks] Failed to reorder:', err)
          setSnapshot({ ...snapshot, tasks: previous })
        },
      )
    },
    [userId],
  )

  const applyColumnOrders = useCallback(
    (mode: 'planning' | 'category', columns: Record<string, string[]>) => {
      if (!userId) return

      const previous = snapshot.tasks
      const patches = new Map<string, Partial<Task>>()

      for (const [columnKey, ids] of Object.entries(columns)) {
        ids.forEach((id, index) => {
          patches.set(id, {
            sort_order: index,
            ...(mode === 'planning'
              ? { planning: columnKey as TaskPlanning }
              : { category: columnKey }),
          })
        })
      }

      patchTasks((current) =>
        current.map((t) => {
          const patch = patches.get(t.id)
          return patch ? { ...t, ...patch } : t
        }),
      )

      const changed = snapshot.tasks.filter((t) => patches.has(t.id))
      if (changed.length === 0) return

      void Promise.all(changed.map((t) => updateTaskById(t.id, buildTaskUpdates(t)))).catch(
        (err) => {
          console.error('[tasks] Failed to apply column orders:', err)
          setSnapshot({ ...snapshot, tasks: previous })
        },
      )
    },
    [userId],
  )

  const reorderTaskByCategory = useCallback(
    (taskId: string, targetCategory: string, orderedIds: string[]) => {
      if (!userId) return

      const previous = snapshot.tasks
      const orderMap = new Map(orderedIds.map((id, index) => [id, index]))

      patchTasks((current) =>
        current.map((t) => {
          if (!orderMap.has(t.id)) return t
          return {
            ...t,
            category: t.id === taskId ? targetCategory : t.category,
            sort_order: orderMap.get(t.id),
          }
        }),
      )

      const changed = snapshot.tasks.filter((t) => orderMap.has(t.id))
      void Promise.all(changed.map((t) => updateTaskById(t.id, buildTaskUpdates(t)))).catch(
        (err) => {
          console.error('[tasks] Failed to reorder by category:', err)
          setSnapshot({ ...snapshot, tasks: previous })
        },
      )
    },
    [userId],
  )

  const removeTask = useCallback(
    (id: string) => {
      if (!userId) return

      const previous = snapshot.tasks
      patchTasks((current) => current.filter((t) => t.id !== id))

      void deleteTaskById(id).catch((err) => {
        console.error('[tasks] Failed to delete:', err)
        setSnapshot({ ...snapshot, tasks: previous })
      })
    },
    [userId],
  )

  const toggleTask = useCallback(
    (id: string) => {
      if (!userId) return

      const previous = snapshot.tasks
      patchTasks((current) =>
        current.map((t) => {
          if (t.id !== id) return t
          const nextStatus: TaskStatus = t.status === 'done' ? 'open' : 'done'
          return {
            ...t,
            status: nextStatus,
            completedAt: nextStatus === 'done' ? new Date().toISOString() : undefined,
          }
        }),
      )

      const updated = snapshot.tasks.find((t) => t.id === id)
      if (!updated) return

      void updateTaskById(id, buildTaskUpdates(updated)).catch((err) => {
        console.error('[tasks] Failed to toggle:', err)
        setSnapshot({ ...snapshot, tasks: previous })
      })
    },
    [userId],
  )

  const mergeTasks = useCallback(
    (incoming: Task[] | undefined) => {
      if (!userId || !Array.isArray(incoming) || incoming.length === 0) return

      const existingNormalized = new Set(snapshot.tasks.map((t) => normalizeTitle(t.title)))
      const newTasks = incoming.filter(
        (t) => t?.title && !existingNormalized.has(normalizeTitle(t.title)),
      )
      if (newTasks.length === 0) return

      const withIds = newTasks.map((task) => ({
        ...task,
        id: task.id || generateId(),
        createdAt: task.createdAt || new Date().toISOString(),
        planning: task.planning ?? 'backlog',
        sort_order: task.sort_order ?? 0,
      }))

      patchTasks((current) => [...current, ...withIds])

      void createTasks(userId, withIds).catch((err) => {
        console.error('[tasks] Failed to merge:', err)
        const mergedIds = new Set(withIds.map((t) => t.id))
        patchTasks((current) => current.filter((t) => !mergedIds.has(t.id)))
      })
    },
    [userId],
  )

  const clearAll = useCallback(async () => {
    if (!userId) return

    const previous = snapshot.tasks
    setSnapshot({ ...snapshot, tasks: [] })

    try {
      await Promise.all(previous.map((task) => deleteTaskById(task.id)))
    } catch (err) {
      console.error('[tasks] Failed to clear:', err)
      setSnapshot({ ...snapshot, tasks: previous })
    }
  }, [userId])

  const refetch = useCallback(async () => {
    if (!userId) return
    loadedUserId = null
    await loadTasksForUser(userId)
  }, [userId])

  return {
    tasks,
    loading,
    error,
    addTask,
    updateTask,
    reorderTask,
    reorderTaskByCategory,
    applyColumnOrders,
    removeTask,
    toggleTask,
    mergeTasks,
    clearAll,
    refetch,
  }
}
