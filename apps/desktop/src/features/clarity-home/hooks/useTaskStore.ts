import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { Task, TaskSource, TaskStatus } from '@oneway/shared'
import {
  createTask,
  createTasks,
  deleteTaskById,
  getTasks,
  migrateLocalTasksToSupabase,
  updateTaskById,
} from '../api/tasks'

export type { Task, TaskSource, TaskStatus }

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
    (title: string, category: string, source: TaskSource = 'manual'): Task | null => {
      if (!userId) return null

      const task: Task = {
        id: generateId(),
        title: title.trim(),
        category,
        status: 'open',
        createdAt: new Date().toISOString(),
        source,
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
    (id: string, updates: Partial<Pick<Task, 'title' | 'category' | 'status'>>) => {
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

      void updateTaskById(id, {
        title: updated.title,
        category: updated.category,
        status: updated.status,
        completed_at: updated.completedAt ?? null,
      }).catch((err) => {
        console.error('[tasks] Failed to update:', err)
        setSnapshot({ ...snapshot, tasks: previous })
      })
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

      void updateTaskById(id, {
        status: updated.status,
        completed_at: updated.completedAt ?? null,
      }).catch((err) => {
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
    removeTask,
    toggleTask,
    mergeTasks,
    clearAll,
    refetch,
  }
}
