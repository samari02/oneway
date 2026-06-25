import { supabase } from '@/lib/supabase'
import type { ClarityTaskInsert, ClarityTaskRow, ClarityTaskUpdate, Task } from '@oneway/shared'

export const LOCAL_TASKS_STORAGE_KEY = 'clarity-tasks'
const CURRENT_FOCUS_STORAGE_KEY = 'clarity-current-focus'

export function rowToTask(row: ClarityTaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    source: row.source,
    rawInput: row.raw_input ?? undefined,
  }
}

export function taskToInsert(userId: string, task: Task): ClarityTaskInsert {
  return {
    id: task.id,
    user_id: userId,
    title: task.title,
    category: task.category,
    status: task.status,
    source: task.source,
    raw_input: task.rawInput ?? null,
    completed_at: task.completedAt ?? null,
    created_at: task.createdAt,
  }
}

function isValidLocalTask(value: unknown): value is Task {
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

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ')
}

function readLocalTasks(): Task[] {
  try {
    const raw = localStorage.getItem(LOCAL_TASKS_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidLocalTask)
  } catch {
    return []
  }
}

function remapCurrentFocusTaskIds(idMap: Map<string, string>): void {
  try {
    const raw = localStorage.getItem(CURRENT_FOCUS_STORAGE_KEY)
    if (!raw) return
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return
    const state = parsed as { taskId?: string | null }
    if (typeof state.taskId !== 'string') return
    const nextId = idMap.get(state.taskId)
    if (!nextId) return
    localStorage.setItem(
      CURRENT_FOCUS_STORAGE_KEY,
      JSON.stringify({ ...state, taskId: nextId }),
    )
  } catch {
    // ignore
  }
}

export async function getTasks(userId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return ((data as ClarityTaskRow[]) ?? []).map(rowToTask)
}

export async function createTask(userId: string, task: Task): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert(taskToInsert(userId, task))
    .select()
    .single()

  if (error) throw error
  return rowToTask(data as ClarityTaskRow)
}

export async function createTasks(userId: string, tasks: Task[]): Promise<Task[]> {
  if (tasks.length === 0) return []

  const { data, error } = await supabase
    .from('tasks')
    .insert(tasks.map((task) => taskToInsert(userId, task)))
    .select()

  if (error) throw error
  return ((data as ClarityTaskRow[]) ?? []).map(rowToTask)
}

export async function updateTaskById(id: string, updates: ClarityTaskUpdate): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return rowToTask(data as ClarityTaskRow)
}

export async function deleteTaskById(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

export async function migrateLocalTasksToSupabase(
  userId: string,
  existingTasks: Task[] = [],
): Promise<Task[]> {
  const localTasks = readLocalTasks()
  if (localTasks.length === 0) {
    localStorage.removeItem(LOCAL_TASKS_STORAGE_KEY)
    return []
  }

  const existingNormalized = new Set(existingTasks.map((task) => normalizeTitle(task.title)))
  const toMigrate = localTasks.filter(
    (task) => !existingNormalized.has(normalizeTitle(task.title)),
  )

  if (toMigrate.length === 0) {
    localStorage.removeItem(LOCAL_TASKS_STORAGE_KEY)
    return []
  }

  const idMap = new Map<string, string>()
  const migrated = toMigrate.map((task) => {
    const id = crypto.randomUUID()
    idMap.set(task.id, id)
    return { ...task, id }
  })

  const created = await createTasks(userId, migrated)
  remapCurrentFocusTaskIds(idMap)
  localStorage.removeItem(LOCAL_TASKS_STORAGE_KEY)
  return created
}
