import { getApiKey } from '@/lib/openai'
import type { Task, TaskPlanning } from '@oneway/shared'
import {
  type BucketContext,
  type SubContext,
  type TaskOrganizeContext,
} from './suggestTaskOrganization'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o-mini'

const VALID_PLANNING: TaskPlanning[] = ['today', 'next', 'later', 'backlog']

export type OrganizeSuggestion =
  | {
      type: 'move'
      taskId: string
      suggestedPlanning?: TaskPlanning
      suggestedCategoryId?: string
      reason?: string
    }
  | {
      type: 'merge'
      keepTaskId: string
      mergeTaskIds: string[]
      suggestedTitle?: string
      reason?: string
    }
  | { type: 'archive'; taskId: string; reason?: string }

export type OrganizeChatResponse = {
  message: string
  suggestions?: OrganizeSuggestion[]
  question?: string
}

export type DuplicateCandidate = {
  taskIdA: string
  titleA: string
  taskIdB: string
  titleB: string
  similarity: number
}

export type RecentlyCompletedTask = {
  id: string
  title: string
  categoryLabel: string
  completedAt?: string
}

export type OrganizeChatTurn = {
  role: 'user' | 'assistant'
  content: string
}

export type OrganizeScanPayload = {
  openTasks: TaskOrganizeContext[]
  buckets: BucketContext[]
  subs: SubContext[]
  duplicateCandidates: DuplicateCandidate[]
  recentlyCompleted: RecentlyCompletedTask[]
  userContext?: string
}

function normalizeForMatch(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  const row = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    let prev = i - 1
    row[0] = i
    for (let j = 1; j <= n; j++) {
      const temp = row[j]
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost)
      prev = temp
    }
  }
  return row[n]
}

function titleSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

export function findDuplicateCandidates(tasks: TaskOrganizeContext[]): DuplicateCandidate[] {
  const pairs: DuplicateCandidate[] = []
  const seen = new Set<string>()

  const normalized = tasks.map((t) => ({
    ...t,
    norm: normalizeForMatch(t.title),
  }))

  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const a = normalized[i]
      const b = normalized[j]
      if (!a.norm || !b.norm) continue

      const sim = titleSimilarity(a.norm, b.norm)
      const includesMatch =
        a.norm.length >= 5 &&
        b.norm.length >= 5 &&
        (a.norm.includes(b.norm) || b.norm.includes(a.norm))

      if (sim >= 0.82 || includesMatch) {
        const key = [a.id, b.id].sort().join(':')
        if (seen.has(key)) continue
        seen.add(key)
        pairs.push({
          taskIdA: a.id,
          titleA: a.title,
          taskIdB: b.id,
          titleB: b.title,
          similarity: Math.round(sim * 100) / 100,
        })
      }
    }
  }

  return pairs.sort((x, y) => y.similarity - x.similarity)
}

function buildContextBlock(payload: OrganizeScanPayload): string {
  const bucketList = payload.buckets
    .map((b) => `- ${b.id}: ${b.emoji ? `${b.emoji} ` : ''}${b.label}`)
    .join('\n')

  const subList = payload.subs
    .map((s) => `- ${s.id}: ${s.bucketLabel} → ${s.label}`)
    .join('\n')

  const taskList = payload.openTasks
    .map(
      (t) =>
        `- id: ${t.id} | "${t.title}" | planning: ${t.planning} | sub: ${t.categoryLabel} (${t.categoryId}) | bucket: ${t.bucketLabel}`,
    )
    .join('\n')

  const todayCount = payload.openTasks.filter((t) => t.planning === 'today').length
  const backlogCount = payload.openTasks.filter((t) => t.planning === 'backlog').length

  const dupList =
    payload.duplicateCandidates.length > 0
      ? payload.duplicateCandidates
          .map(
            (d) =>
              `- "${d.titleA}" (${d.taskIdA}) ↔ "${d.titleB}" (${d.taskIdB}) — similarity ${d.similarity}`,
          )
          .join('\n')
      : '(none detected)'

  const completedList =
    payload.recentlyCompleted.length > 0
      ? payload.recentlyCompleted
          .map((t) => `- "${t.title}" (${t.categoryLabel}) completed ${t.completedAt ?? 'recently'}`)
          .join('\n')
      : '(none)'

  const userContextBlock = payload.userContext?.trim()
    ? `\nUser background context:\n"""\n${payload.userContext.trim()}\n"""\n`
    : ''

  return `Open tasks (${payload.openTasks.length} total, ${todayCount} in Today, ${backlogCount} in Backlog):
${taskList || '(none)'}

Buckets:
${bucketList || '(none)'}

Sub-categories (use sub id for suggestedCategoryId):
${subList || '(none)'}

Probable duplicate pairs (client-detected — confirm before suggesting merge):
${dupList}

Recently completed tasks (last 7 days, read-only context):
${completedList}
${userContextBlock}`
}

function buildSystemPrompt(): string {
  return `You are Clarity, a personal task organizer in a multi-turn chat. Help the user tidy open tasks across planning horizons (today, next, later, backlog) and sub-categories.

SUGGESTION-ONLY MODE:
- Never delete tasks. merge = keep one task, archive the duplicate on apply.
- archive suggestions mark a task as archived (optional).
- move = change planning and/or sub-category.
- Only suggest changes for OPEN tasks listed in context.
- Keep Today lean (~5 tasks max). Ask targeted questions when ambiguous (duplicates, wrong bucket, overloaded Today).
- Respond conversationally in "message". Use "question" for a single focused follow-up when needed.

Suggestion types (JSON):
- move: { "type":"move", "taskId", "suggestedPlanning"?, "suggestedCategoryId"?, "reason"? }
- merge: { "type":"merge", "keepTaskId", "mergeTaskIds": ["id1","id2"], "suggestedTitle"?, "reason"? }
- archive: { "type":"archive", "taskId", "reason"? }

Respond ONLY with valid JSON:
{"message":"...","suggestions":[...],"question":"..."}`
}

function buildScanUserPrompt(payload: OrganizeScanPayload): string {
  return `The user just opened Organize with Clarity. Run an initial scan and greet them with a concise summary of findings (duplicates, misplaced tasks, backlog without planning, overloaded Today, etc.). Include initial suggestions only when confident.

${buildContextBlock(payload)}

On this first turn: summarize what you found in message. Add suggestions for clear wins. Use question only if you need user input before suggesting merges or bucket moves.`
}

function buildTurnUserPrompt(
  payload: OrganizeScanPayload,
  history: OrganizeChatTurn[],
  userMessage: string,
): string {
  const historyBlock =
    history.length > 0
      ? `\nConversation so far:\n${history.map((t) => `${t.role === 'user' ? 'User' : 'Clarity'}: ${t.content}`).join('\n')}\n`
      : ''

  return `Continue the organize chat. The user said:
"""
${userMessage.trim()}
"""
${historyBlock}
Current task snapshot:
${buildContextBlock(payload)}

Reply in message. Add suggestions when appropriate. Use question for ambiguity.`
}

function parseSuggestionItem(raw: unknown): OrganizeSuggestion | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const type = item.type

  if (type === 'move' && typeof item.taskId === 'string') {
    return {
      type: 'move',
      taskId: item.taskId,
      suggestedPlanning: VALID_PLANNING.includes(item.suggestedPlanning as TaskPlanning)
        ? (item.suggestedPlanning as TaskPlanning)
        : undefined,
      suggestedCategoryId:
        typeof item.suggestedCategoryId === 'string' ? item.suggestedCategoryId : undefined,
      reason: typeof item.reason === 'string' ? item.reason : undefined,
    }
  }

  if (type === 'merge' && typeof item.keepTaskId === 'string') {
    const mergeTaskIds: string[] = []
    if (Array.isArray(item.mergeTaskIds)) {
      for (const id of item.mergeTaskIds) {
        if (typeof id === 'string' && id !== item.keepTaskId && !mergeTaskIds.includes(id)) {
          mergeTaskIds.push(id)
        }
      }
    } else if (typeof item.mergeTaskId === 'string' && item.mergeTaskId !== item.keepTaskId) {
      mergeTaskIds.push(item.mergeTaskId)
    }
    if (mergeTaskIds.length === 0) return null

    return {
      type: 'merge',
      keepTaskId: item.keepTaskId,
      mergeTaskIds,
      suggestedTitle: typeof item.suggestedTitle === 'string' ? item.suggestedTitle : undefined,
      reason: typeof item.reason === 'string' ? item.reason : undefined,
    }
  }

  if (type === 'archive' && typeof item.taskId === 'string') {
    return {
      type: 'archive',
      taskId: item.taskId,
      reason: typeof item.reason === 'string' ? item.reason : undefined,
    }
  }

  return null
}

function suggestionDedupeKey(s: OrganizeSuggestion): string {
  if (s.type === 'move') {
    return `move:${s.taskId}:${s.suggestedPlanning ?? ''}:${s.suggestedCategoryId ?? ''}`
  }
  if (s.type === 'merge') {
    const mergeIds = [...s.mergeTaskIds].sort().join(',')
    return `merge:${s.keepTaskId}:${mergeIds}`
  }
  if (s.type === 'archive') {
    return `archive:${s.taskId}`
  }
  return ''
}

function mergeClusterKey(titles: string[]): string {
  const norms = titles.map(normalizeForMatch).filter(Boolean)
  if (norms.length === 0) return ''
  return norms.reduce((shortest, norm) => (norm.length < shortest.length ? norm : shortest))
}

function pickKeepTaskId(
  taskIds: string[],
  taskById: Map<string, Task>,
  keepVotes: Map<string, number>,
): string {
  return [...taskIds].sort((a, b) => {
    const votesA = keepVotes.get(a) ?? 0
    const votesB = keepVotes.get(b) ?? 0
    if (votesA !== votesB) return votesB - votesA

    const titleA = taskById.get(a)?.title ?? ''
    const titleB = taskById.get(b)?.title ?? ''
    if (titleA.length !== titleB.length) return titleB.length - titleA.length

    return a.localeCompare(b)
  })[0]
}

function pickBestMergeTitle(
  titles: string[],
  aiSuggestions: (string | undefined)[],
): string | undefined {
  const aiTitle = aiSuggestions.find((t) => t?.trim())?.trim()
  if (aiTitle) return aiTitle

  if (titles.length === 0) return undefined

  const longest = titles.reduce((best, title) => (title.length > best.length ? title : best))
  const shortest = titles.reduce((best, title) => (title.length < best.length ? title : best))
  if (longest.length > shortest.length + 3) return longest

  const uniqueTitles = new Set(titles.map(normalizeForMatch))
  if (uniqueTitles.size === 1 && longest !== shortest) return longest

  return undefined
}

function consolidateMergeSuggestions(
  merges: Extract<OrganizeSuggestion, { type: 'merge' }>[],
  openTasks: Task[],
): Extract<OrganizeSuggestion, { type: 'merge' }>[] {
  if (merges.length === 0) return []

  const taskById = new Map(openTasks.map((t) => [t.id, t]))
  const clusters = new Map<
    string,
    {
      taskIds: Set<string>
      keepVotes: Map<string, number>
      aiTitles: string[]
      reasons: string[]
    }
  >()

  for (const merge of merges) {
    const involvedIds = [merge.keepTaskId, ...merge.mergeTaskIds].filter((id) => taskById.has(id))
    if (involvedIds.length < 2) continue

    const titles = involvedIds.map((id) => taskById.get(id)?.title ?? '')
    const key = mergeClusterKey(titles)
    if (!key) continue

    if (!clusters.has(key)) {
      clusters.set(key, { taskIds: new Set(), keepVotes: new Map(), aiTitles: [], reasons: [] })
    }
    const cluster = clusters.get(key)!
    for (const id of involvedIds) cluster.taskIds.add(id)
    cluster.keepVotes.set(
      merge.keepTaskId,
      (cluster.keepVotes.get(merge.keepTaskId) ?? 0) + 1,
    )
    if (merge.suggestedTitle) cluster.aiTitles.push(merge.suggestedTitle)
    if (merge.reason) cluster.reasons.push(merge.reason)
  }

  const results: Extract<OrganizeSuggestion, { type: 'merge' }>[] = []

  for (const cluster of clusters.values()) {
    if (cluster.taskIds.size < 2) continue

    const taskIds = [...cluster.taskIds]
    const keepTaskId = pickKeepTaskId(taskIds, taskById, cluster.keepVotes)
    const mergeTaskIds = taskIds.filter((id) => id !== keepTaskId)
    if (mergeTaskIds.length === 0) continue

    const titles = taskIds.map((id) => taskById.get(id)?.title ?? '')
    const suggestedTitle = pickBestMergeTitle(titles, cluster.aiTitles)
    const keepTitle = taskById.get(keepTaskId)?.title ?? 'task'
    const duplicateCount = mergeTaskIds.length

    let reason: string | undefined
    if (duplicateCount > 1) {
      reason = `${duplicateCount + 1} similar tasks — keep one, archive ${duplicateCount} duplicate${duplicateCount === 1 ? '' : 's'}`
    } else {
      reason = cluster.reasons[0]
    }

    results.push({
      type: 'merge',
      keepTaskId,
      mergeTaskIds,
      suggestedTitle: suggestedTitle && suggestedTitle !== keepTitle ? suggestedTitle : undefined,
      reason,
    })
  }

  return results
}

export function dedupeAndGroupOrganizeSuggestions(
  suggestions: OrganizeSuggestion[],
  openTasks: Task[],
): OrganizeSuggestion[] {
  const openById = new Map(openTasks.map((t) => [t.id, t]))
  const sanitized = suggestions
    .map((s) => {
      if (s.type !== 'merge') return s
      const keep = openById.get(s.keepTaskId)
      if (!keep || keep.status !== 'open') return null
      const mergeTaskIds = s.mergeTaskIds.filter((id) => {
        const merge = openById.get(id)
        return !!merge && merge.status === 'open' && id !== s.keepTaskId
      })
      if (mergeTaskIds.length === 0) return null
      return { ...s, mergeTaskIds }
    })
    .filter((s): s is OrganizeSuggestion => s !== null)

  const seen = new Set<string>()
  const moves: Extract<OrganizeSuggestion, { type: 'move' }>[] = []
  const merges: Extract<OrganizeSuggestion, { type: 'merge' }>[] = []
  const archives: Extract<OrganizeSuggestion, { type: 'archive' }>[] = []

  for (const s of sanitized) {
    const key = suggestionDedupeKey(s)
    if (seen.has(key)) continue
    seen.add(key)

    if (s.type === 'move') moves.push(s)
    else if (s.type === 'merge') merges.push(s)
    else if (s.type === 'archive') archives.push(s)
  }

  const groupedMerges = consolidateMergeSuggestions(merges, openTasks)
  const archivedByMerge = new Set(groupedMerges.flatMap((m) => m.mergeTaskIds))
  const filteredArchives = archives.filter((a) => !archivedByMerge.has(a.taskId))

  return [...groupedMerges, ...moves, ...filteredArchives]
}

function parseOrganizeResponse(content: string): OrganizeChatResponse | null {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>
    if (typeof parsed.message !== 'string') return null

    const rawSuggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : []
    const suggestions = rawSuggestions
      .map(parseSuggestionItem)
      .filter((s): s is OrganizeSuggestion => s !== null)

    return {
      message: parsed.message,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      question: typeof parsed.question === 'string' ? parsed.question : undefined,
    }
  } catch {
    return null
  }
}

export function filterActionableOrganizeSuggestions(
  suggestions: OrganizeSuggestion[],
  openTasks: Task[],
  validSubIds: Set<string>,
): OrganizeSuggestion[] {
  const openById = new Map(openTasks.map((t) => [t.id, t]))

  return suggestions.filter((s) => {
    if (s.type === 'move') {
      const task = openById.get(s.taskId)
      if (!task || task.status !== 'open') return false

      const planning = task.planning ?? 'backlog'
      const planningChange =
        s.suggestedPlanning !== undefined && s.suggestedPlanning !== planning
      const categoryChange =
        s.suggestedCategoryId !== undefined &&
        validSubIds.has(s.suggestedCategoryId) &&
        s.suggestedCategoryId !== task.category

      return planningChange || categoryChange
    }

    if (s.type === 'merge') {
      const keep = openById.get(s.keepTaskId)
      if (!keep || keep.status !== 'open') return false
      return s.mergeTaskIds.some((id) => {
        const merge = openById.get(id)
        return !!merge && merge.status === 'open' && id !== s.keepTaskId
      })
    }

    if (s.type === 'archive') {
      const task = openById.get(s.taskId)
      return !!task && task.status === 'open'
    }

    return false
  })
}

async function callOrganizeChat(userPrompt: string): Promise<OrganizeChatResponse> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('NO_API_KEY')

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.warn('[organize-chat] OpenAI error:', response.status, errorBody)
    throw new Error('Failed to get a response from Clarity. Please try again.')
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error('Unexpected response from Clarity. Please try again.')
  }

  const parsed = parseOrganizeResponse(content)
  if (!parsed) {
    throw new Error('Could not parse Clarity response. Please try again.')
  }

  return parsed
}

export async function scanOrganizeChat(
  payload: OrganizeScanPayload,
  openTasks: Task[],
): Promise<OrganizeChatResponse> {
  const validSubIds = new Set(payload.subs.map((s) => s.id))
  const result = await callOrganizeChat(buildScanUserPrompt(payload))

  return {
    ...result,
    message: result.question
      ? `${result.message}\n\n${result.question}`
      : result.message,
    suggestions: result.suggestions
      ? dedupeAndGroupOrganizeSuggestions(
          filterActionableOrganizeSuggestions(result.suggestions, openTasks, validSubIds),
          openTasks,
        )
      : undefined,
  }
}

export async function sendOrganizeChatMessage(
  payload: OrganizeScanPayload,
  history: OrganizeChatTurn[],
  userMessage: string,
  openTasks: Task[],
): Promise<OrganizeChatResponse> {
  const validSubIds = new Set(payload.subs.map((s) => s.id))
  const result = await callOrganizeChat(buildTurnUserPrompt(payload, history, userMessage))

  return {
    ...result,
    message: result.question
      ? `${result.message}\n\n${result.question}`
      : result.message,
    suggestions: result.suggestions
      ? dedupeAndGroupOrganizeSuggestions(
          filterActionableOrganizeSuggestions(result.suggestions, openTasks, validSubIds),
          openTasks,
        )
      : undefined,
  }
}
