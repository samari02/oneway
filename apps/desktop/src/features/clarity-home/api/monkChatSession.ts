import { supabase } from '@/lib/supabase'
import type {
  ChatMessage,
  MonkChatPersistedSession,
  MonkChatPhase,
  ProposedArea,
  ProposedTask,
} from '../hooks/useMonkChat'

type CollectedData = {
  collectedAreas: string[]
  collectedProjects: string[]
  collectedTasks: string[]
  areaNotes: string
  projectNotes: string
  taskNotes: string
  priorityNotes: string
}

type ProposalData = {
  proposedAreas: ProposedArea[]
  proposedTasks: ProposedTask[]
}

type MonkChatSessionRow = {
  user_id: string
  messages: ChatMessage[]
  phase: string
  collected_data: CollectedData
  proposal: ProposalData
  saved_summary: { areas: ProposedArea[]; tasks: ProposedTask[] } | null
  updated_at: string
}

function sessionToRow(
  userId: string,
  session: MonkChatPersistedSession,
): Omit<MonkChatSessionRow, 'updated_at'> {
  const {
    messages,
    phase,
    proposedAreas,
    proposedTasks,
    collectedAreas,
    collectedProjects,
    collectedTasks,
    areaNotes,
    projectNotes,
    taskNotes,
    priorityNotes,
    savedSummary,
    savedAt: _savedAt,
  } = session

  return {
    user_id: userId,
    messages,
    phase,
    collected_data: {
      collectedAreas,
      collectedProjects,
      collectedTasks,
      areaNotes,
      projectNotes,
      taskNotes,
      priorityNotes,
    },
    proposal: { proposedAreas, proposedTasks },
    saved_summary: savedSummary,
  }
}

function rowToSession(row: MonkChatSessionRow): MonkChatPersistedSession {
  const collected = row.collected_data ?? ({} as CollectedData)
  const proposal = row.proposal ?? ({} as ProposalData)

  return {
    messages: Array.isArray(row.messages) ? row.messages : [],
    phase: row.phase as MonkChatPhase,
    proposedAreas: proposal.proposedAreas ?? [],
    proposedTasks: proposal.proposedTasks ?? [],
    collectedAreas: collected.collectedAreas ?? [],
    collectedProjects: collected.collectedProjects ?? [],
    collectedTasks: collected.collectedTasks ?? [],
    areaNotes: collected.areaNotes ?? '',
    projectNotes: collected.projectNotes ?? '',
    taskNotes: collected.taskNotes ?? '',
    priorityNotes: collected.priorityNotes ?? '',
    savedSummary: row.saved_summary ?? null,
    savedAt: new Date(row.updated_at).getTime(),
  }
}

export async function getSession(userId: string): Promise<MonkChatPersistedSession | null> {
  const { data, error } = await supabase
    .from('monk_chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  const session = rowToSession(data as MonkChatSessionRow)
  if (!Array.isArray(session.messages) || typeof session.phase !== 'string') return null
  return session
}

export async function upsertSession(
  userId: string,
  session: MonkChatPersistedSession,
): Promise<void> {
  const row = sessionToRow(userId, session)
  const { error } = await supabase.from('monk_chat_sessions').upsert(
    {
      ...row,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) throw error
}

export async function deleteSession(userId: string): Promise<void> {
  const { error } = await supabase.from('monk_chat_sessions').delete().eq('user_id', userId)

  if (error) throw error
}
