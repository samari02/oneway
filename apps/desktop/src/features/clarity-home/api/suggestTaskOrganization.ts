import { getApiKey } from '@/lib/openai'
import type { Task, TaskPlanning } from '@oneway/shared'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o-mini'

const VALID_PLANNING: TaskPlanning[] = ['today', 'next', 'later', 'backlog']

export type TaskOrgSuggestion = {
  taskId: string
  suggestedPlanning?: TaskPlanning
  suggestedCategoryId?: string
  reason?: string
}

export type BucketContext = {
  id: string
  label: string
  emoji?: string | null
}

export type SubContext = {
  id: string
  label: string
  bucketId: string
  bucketLabel: string
}

export type TaskOrganizeContext = {
  id: string
  title: string
  categoryId: string
  categoryLabel: string
  bucketLabel: string
  planning: TaskPlanning
}

export function buildOrganizePrompt(
  tasks: TaskOrganizeContext[],
  buckets: BucketContext[],
  subs: SubContext[],
  userMessage?: string,
): string {
  const bucketList = buckets
    .map((b) => `- ${b.id}: ${b.emoji ? `${b.emoji} ` : ''}${b.label}`)
    .join('\n')

  const subList = subs
    .map((s) => `- ${s.id}: ${s.bucketLabel} → ${s.label}`)
    .join('\n')

  const taskList = tasks
    .map(
      (t) =>
        `- id: ${t.id} | "${t.title}" | planning: ${t.planning} | sub: ${t.categoryLabel} (${t.categoryId}) | bucket: ${t.bucketLabel}`,
    )
    .join('\n')

  const userSection = userMessage?.trim()
    ? `\nUser guidance:\n"""\n${userMessage.trim()}\n"""\n`
    : ''

  return `You are a personal task organizer for Clarity. Review open tasks and suggest how to reorganize them across planning horizons (Today, Next, Later, Backlog) and optionally move them to a better sub-category.

Planning horizons (use these exact values for suggestedPlanning):
- today: do today (keep Today lean — max ~5 tasks)
- next: soon, this week
- later: eventually, not urgent
- backlog: unprioritized / someday

Buckets:
${bucketList || '(none)'}

Sub-categories (use sub id for suggestedCategoryId):
${subList || '(none)'}

Open tasks (ONLY suggest moves for these — never delete, never touch completed tasks):
${taskList || '(none)'}
${userSection}
Rules:
- SUGGESTION MODE ONLY: return moves/replans, never create or delete tasks
- Only include tasks that should actually change (planning and/or sub-category)
- Prefer keeping tasks in their current sub unless there is a clear better fit
- Balance Today — don't overload it
- Each suggestion must reference a valid task id from the list above
- suggestedCategoryId must be one of the sub ids above (omit if no category change)
- suggestedPlanning must be one of: today, next, later, backlog (omit if no planning change)
- At least one of suggestedPlanning or suggestedCategoryId must be present per suggestion

Respond ONLY with valid JSON:
{"suggestions":[{"taskId":"...","suggestedPlanning":"today","suggestedCategoryId":"...","reason":"brief why"}]}`
}

function parseSuggestions(content: string): TaskOrgSuggestion[] | null {
  try {
    const parsed = JSON.parse(content) as unknown
    const rawItems = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { suggestions?: unknown }).suggestions)
        ? (parsed as { suggestions: TaskOrgSuggestion[] }).suggestions
        : null

    if (!rawItems) return null

    return rawItems
      .filter(
        (item): item is TaskOrgSuggestion =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as TaskOrgSuggestion).taskId === 'string',
      )
      .map((item) => ({
        taskId: item.taskId,
        suggestedPlanning: VALID_PLANNING.includes(item.suggestedPlanning as TaskPlanning)
          ? (item.suggestedPlanning as TaskPlanning)
          : undefined,
        suggestedCategoryId:
          typeof item.suggestedCategoryId === 'string' ? item.suggestedCategoryId : undefined,
        reason: typeof item.reason === 'string' ? item.reason : undefined,
      }))
      .filter((item) => item.suggestedPlanning !== undefined || item.suggestedCategoryId !== undefined)
  } catch {
    return null
  }
}

export function filterActionableSuggestions(
  suggestions: TaskOrgSuggestion[],
  openTasks: Task[],
  validSubIds: Set<string>,
): TaskOrgSuggestion[] {
  const openById = new Map(openTasks.map((t) => [t.id, t]))

  return suggestions.filter((s) => {
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
  })
}

export async function suggestTaskOrganization(
  tasks: TaskOrganizeContext[],
  buckets: BucketContext[],
  subs: SubContext[],
  openTasks: Task[],
  userMessage?: string,
): Promise<TaskOrgSuggestion[]> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('NO_API_KEY')
  }

  if (tasks.length === 0) {
    return []
  }

  const validSubIds = new Set(subs.map((s) => s.id))

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a personal task organizer. Respond ONLY with valid JSON containing a "suggestions" array. Never suggest deleting tasks.',
        },
        {
          role: 'user',
          content: buildOrganizePrompt(tasks, buckets, subs, userMessage),
        },
      ],
      temperature: 0.35,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.warn('[organize] OpenAI error:', response.status, errorBody)
    throw new Error('Failed to get organization suggestions. Please try again.')
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error('Unexpected response from AI. Please try again.')
  }

  const parsed = parseSuggestions(content)
  if (!parsed) {
    throw new Error('Could not parse AI suggestions. Please try again.')
  }

  return filterActionableSuggestions(parsed, openTasks, validSubIds)
}
