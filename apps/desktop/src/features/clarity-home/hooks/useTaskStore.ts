import { useCallback, useSyncExternalStore } from 'react'

export type TaskStatus = 'open' | 'done' | 'archived'
export type TaskSource = 'ai' | 'manual'

export type Task = {
  id: string
  title: string
  category: string
  status: TaskStatus
  createdAt: string
  completedAt?: string
  source: TaskSource
}

const STORAGE_KEY = 'clarity-tasks'

const listeners = new Set<() => void>()

function emitChange() {
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

function isValidTask(value: unknown): value is Task {
  if (!value || typeof value !== 'object') return false
  const task = value as Partial<Task>
  return (
    typeof task.id === 'string' &&
    typeof task.title === 'string' &&
    typeof task.category === 'string' &&
    typeof task.status === 'string' &&
    typeof task.createdAt === 'string' &&
    typeof task.source === 'string'
  )
}

function readTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidTask)
  } catch {
    return []
  }
}

function writeTasks(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  emitChange()
}

let snapshotCache: Task[] | null = null

function getSnapshot(): Task[] {
  if (!snapshotCache) snapshotCache = readTasks()
  return snapshotCache
}

function getServerSnapshot(): Task[] {
  return []
}

function invalidateCache() {
  snapshotCache = null
}

function generateId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function useTaskStore() {
  const tasks = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const addTask = useCallback((title: string, category: string, source: TaskSource = 'manual'): Task => {
    const task: Task = {
      id: generateId(),
      title: title.trim(),
      category,
      status: 'open',
      createdAt: new Date().toISOString(),
      source,
    }
    const current = readTasks()
    invalidateCache()
    writeTasks([...current, task])
    return task
  }, [])

  const updateTask = useCallback((id: string, updates: Partial<Pick<Task, 'title' | 'category' | 'status'>>) => {
    const current = readTasks()
    const updated = current.map((t) => {
      if (t.id !== id) return t
      const next = { ...t, ...updates }
      if (updates.status === 'done' && t.status !== 'done') {
        next.completedAt = new Date().toISOString()
      }
      if (updates.status === 'open') {
        next.completedAt = undefined
      }
      return next
    })
    invalidateCache()
    writeTasks(updated)
  }, [])

  const removeTask = useCallback((id: string) => {
    const current = readTasks()
    invalidateCache()
    writeTasks(current.filter((t) => t.id !== id))
  }, [])

  const toggleTask = useCallback((id: string) => {
    const current = readTasks()
    const task = current.find((t) => t.id === id)
    if (!task) return
    const nextStatus: TaskStatus = task.status === 'done' ? 'open' : 'done'
    const updated = current.map((t) =>
      t.id === id
        ? {
            ...t,
            status: nextStatus,
            completedAt: nextStatus === 'done' ? new Date().toISOString() : undefined,
          }
        : t,
    )
    invalidateCache()
    writeTasks(updated)
  }, [])

  const mergeTasks = useCallback((incoming: Task[] | undefined) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return
    const current = readTasks()
    const existingNormalized = new Set(current.map((t) => normalizeTitle(t.title)))
    const newTasks = incoming.filter(
      (t) => isValidTask(t) && !existingNormalized.has(normalizeTitle(t.title)),
    )
    if (newTasks.length === 0) return
    invalidateCache()
    writeTasks([...current, ...newTasks])
  }, [])

  const clearAll = useCallback(() => {
    invalidateCache()
    writeTasks([])
  }, [])

  return { tasks, addTask, updateTask, removeTask, toggleTask, mergeTasks, clearAll }
}
