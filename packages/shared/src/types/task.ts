export type TaskStatus = 'open' | 'done' | 'archived'
export type TaskSource = 'ai' | 'manual'

/** Row shape matching the `tasks` Supabase table. */
export type ClarityTaskRow = {
  id: string
  user_id: string
  title: string
  category: string
  status: TaskStatus
  source: TaskSource
  raw_input: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type ClarityTaskInsert = Omit<ClarityTaskRow, 'created_at' | 'updated_at'> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type ClarityTaskUpdate = Partial<
  Pick<ClarityTaskRow, 'title' | 'category' | 'status' | 'completed_at' | 'raw_input'>
>

/** App-facing task model (camelCase). */
export type Task = {
  id: string
  title: string
  category: string
  status: TaskStatus
  createdAt: string
  completedAt?: string
  source: TaskSource
  rawInput?: string
}
