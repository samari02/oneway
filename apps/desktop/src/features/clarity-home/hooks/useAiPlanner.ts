import { useCallback, useState } from 'react'
import { getApiKey } from '@/lib/openai'
import type { Task } from './useTaskStore'
import type { Category } from './useCategoryStore'
import type { FocusArea } from '@oneway/shared'

type AiPlannerResult = {
  tasks: Task[]
  isProcessing: boolean
  error: string | null
}

/** Shape returned by the planner API (mock and OpenAI). */
export type PlannerTaskOutput = {
  title: string
  rawInput: string
  category: string
  focus_area_id?: string
}

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o-mini'

const KEYWORD_RULES: { pattern: RegExp; category: string }[] = [
  { pattern: /\b(gym|exercise|workout|run|yoga|meditat|walk|stretch|health|sleep|water|diet|calendar)\b/i, category: 'health' },
  { pattern: /\b(proposal|deck|meeting|email|client|report|deadline|standup|review|sprint|jira|ticket|invoice|presentation|slack|kpmg)\b/i, category: 'work' },
  { pattern: /\b(read|study|learn|course|tutorial|book|research|practice|lesson|chapter)\b/i, category: 'learning' },
  { pattern: /\b(clarity|ship|build|code|design|feature|bug|deploy|mvp|prototype|refactor|component)\b/i, category: 'clarity' },
]

const ACTION_VERBS =
  /^(read|fix|finish|write|send|call|buy|make|prep|review|update|deploy|ship|build|code|design|run|walk|study|learn|practice|go|reorganize|organize|schedule|plan|complete|finish)\b/i

const INTENT_PREFIX =
  /^(?:today\s+)?(?:(?:i\s+)?(?:want\s+to|need\s+to|have\s+to|gotta|going\s+to|gonna)\s+)/i

function cleanRawLine(line: string): string {
  return line.trim().replace(/^[-•*]\s*/, '').replace(/^\d+[.)]\s*/, '')
}

function capitalizeFirst(text: string): string {
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ')
}

function stripIntentPrefix(raw: string): string {
  return raw.replace(INTENT_PREFIX, '').trim()
}

function stripPossessives(text: string): string {
  return text.replace(/\b(my|the)\b/gi, '').replace(/\s+/g, ' ').trim()
}

function formatEntity(entity: string): string {
  if (entity === entity.toUpperCase()) return entity
  const lower = entity.toLowerCase()
  if (/^[a-z]{2,6}$/.test(entity) && !/[aeiou]/i.test(entity)) {
    return entity.toUpperCase()
  }
  return capitalizeFirst(lower)
}

/** Move trailing "for ENTITY" to the front: "phase 2 for kpmg" → "KPMG phase 2" */
function reorderForEntity(phrase: string): string {
  const match = phrase.match(/^(.+?)\s+for\s+(\S+)\s*$/i)
  if (!match) return phrase

  const [, rest, entity] = match
  return `${formatEntity(entity)} ${rest.trim()}`
}

/** Rewrite a raw brain-dump line into a clear, actionable title (~6 words max). */
export function reformulateTitle(rawLine: string): string {
  const raw = cleanRawLine(rawLine)
  if (!raw) return raw

  const lower = raw.toLowerCase()

  if (/^(gym|workout|exercise)$/.test(lower)) {
    return 'Go to the gym'
  }

  let text = stripIntentPrefix(raw)

  const getDoneMatch = text.match(/^get\s+(.+?)\s+done$/i)
  if (getDoneMatch) {
    const subject = reorderForEntity(stripPossessives(getDoneMatch[1]))
    return truncateWords(`Finish ${capitalizeFirst(subject)}`, 6)
  }

  const proposalMatch = text.match(/^proposal\s+(\S+)$/i)
  if (proposalMatch) {
    return truncateWords(`Finish ${formatEntity(proposalMatch[1])} proposal`, 6)
  }

  text = stripPossessives(text)

  if (ACTION_VERBS.test(text)) {
    return truncateWords(capitalizeFirst(text), 6)
  }

  if (/^(re)?organiz(e|ing)\b/i.test(text)) {
    return truncateWords(capitalizeFirst(text), 6)
  }

  return truncateWords(capitalizeFirst(text), 6)
}

export function buildPlannerPrompt(
  rawText: string,
  categories: Category[],
  existingTasks: Task[],
  focusAreas?: FocusArea[],
): string {
  const useFocusAreas = focusAreas && focusAreas.length > 0

  const categoryList = useFocusAreas
    ? focusAreas
        .filter((a) => a.status === 'active')
        .map((a) => `- ${a.id}: ${a.emoji ?? '•'} ${a.label}`)
        .join('\n')
    : categories
        .filter((c) => c?.id)
        .map((c) => `- ${c.id}: ${c.emoji} ${c.label}`)
        .join('\n')

  const existingList =
    existingTasks.length > 0
      ? existingTasks.map((t) => `- ${t.title} (${t.category})`).join('\n')
      : '(none)'

  const categoryField = useFocusAreas ? 'focus_area_id' : 'category'
  const categoryLabel = useFocusAreas ? 'Focus Areas' : 'Categories'

  return `You are a personal task planner. Parse the user's brain dump into clear, actionable tasks.

${categoryLabel} (assign exactly one per task):
${categoryList}

Existing tasks (avoid duplicates):
${existingList}

User input:
"""
${rawText.trim()}
"""

For each distinct task, return JSON with a "tasks" array. Each item must have:
- "title": reformulated clear actionable phrase (verb + object, max ~6 words). MUST differ from rawInput.
- "rawInput": the original line from the user input (verbatim)
- "${categoryField}": one of the ${categoryLabel.toLowerCase()} ids above

Examples:
- "gym" → title: "Go to the gym", rawInput: "gym"
- "proposal kpmg" → title: "Finish KPMG proposal", rawInput: "proposal kpmg"
- "I want to reorganize my calendar" → title: "Reorganize calendar", rawInput: "I want to reorganize my calendar"
- "today i want to get phase 2 for kpmg done" → title: "Finish KPMG phase 2", rawInput: "today i want to get phase 2 for kpmg done"
- "read chapter 3" → title: "Read chapter 3", rawInput: "read chapter 3"
- "fix onboarding bug" → title: "Fix onboarding bug", rawInput: "fix onboarding bug"

Respond ONLY with valid JSON: {"tasks": [{ "title": "...", "rawInput": "...", "${categoryField}": "..." }]}`
}

function resolveCategoryId(preferred: string, categories: Category[]): string {
  const valid = categories.filter((c) => c?.id)
  if (valid.length === 0) return preferred

  const ids = new Set(valid.map((c) => c.id))
  if (ids.has(preferred)) return preferred

  const defaultCat = valid.find((c) => c.id === 'clarity')
  return defaultCat?.id ?? valid[0].id
}

function classifyLine(line: string, categories: Category[]): PlannerTaskOutput {
  const rawInput = cleanRawLine(line)
  const fallbackCategory = resolveCategoryId('clarity', categories)
  if (!rawInput) {
    return { title: line.trim(), rawInput: line.trim(), category: fallbackCategory }
  }

  const categoryIds = new Set(categories.filter((c) => c?.id).map((c) => c.id))
  let category = fallbackCategory

  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(rawInput) && categoryIds.has(rule.category)) {
      category = rule.category
      break
    }
  }

  return {
    title: reformulateTitle(rawInput),
    rawInput,
    category,
  }
}

function generateId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function splitInputLines(rawText: string): string[] {
  const lines = rawText
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) return []

  if (lines.length === 1 && !lines[0].includes(',')) {
    return lines
  }

  return lines.flatMap((line) => {
    if (line.includes(',') && !line.includes('\n')) {
      return line
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
    return [line]
  })
}

/** Mock planner — uses same output shape as the OpenAI call. */
export function mockPlanFromText(rawText: string, categories: Category[]): PlannerTaskOutput[] {
  return splitInputLines(rawText).map((line) => classifyLine(line, categories))
}

function normalizePlannerOutput(
  items: PlannerTaskOutput[],
  categories: Category[],
): PlannerTaskOutput[] {
  return items
    .filter((item) => item.title?.trim() && item.rawInput?.trim())
    .map((item) => ({
      title: item.title.trim(),
      rawInput: item.rawInput.trim(),
      category: resolveCategoryId(item.category, categories),
    }))
}

function parseOpenAiResponse(content: string, categories: Category[], focusAreas?: FocusArea[]): PlannerTaskOutput[] | null {
  try {
    const parsed = JSON.parse(content) as unknown
    const rawItems = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { tasks?: unknown }).tasks)
        ? (parsed as { tasks: PlannerTaskOutput[] }).tasks
        : null

    if (!rawItems || rawItems.length === 0) return null

    // If using focus areas, map focus_area_id back to category field
    if (focusAreas && focusAreas.length > 0) {
      const mapped = rawItems.map((item: Record<string, unknown>) => ({
        title: item.title as string,
        rawInput: item.rawInput as string,
        category: (item.focus_area_id as string) ?? (item.category as string) ?? '',
        focus_area_id: item.focus_area_id as string | undefined,
      }))
      const normalized = normalizePlannerOutputWithFocusAreas(mapped, focusAreas)
      return normalized.length > 0 ? normalized : null
    }

    const normalized = normalizePlannerOutput(rawItems, categories)
    return normalized.length > 0 ? normalized : null
  } catch {
    return null
  }
}

function normalizePlannerOutputWithFocusAreas(
  items: PlannerTaskOutput[],
  focusAreas: FocusArea[],
): PlannerTaskOutput[] {
  const areaIds = new Set(focusAreas.map((a) => a.id))
  const fallback = focusAreas[0]?.id ?? ''

  return items
    .filter((item) => item.title?.trim() && item.rawInput?.trim())
    .map((item) => ({
      title: item.title.trim(),
      rawInput: item.rawInput.trim(),
      category: areaIds.has(item.category) ? item.category : fallback,
      focus_area_id: areaIds.has(item.category) ? item.category : fallback,
    }))
}

async function callOpenAiPlanner(
  rawText: string,
  categories: Category[],
  existingTasks: Task[],
  focusAreas?: FocusArea[],
): Promise<PlannerTaskOutput[] | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null

  try {
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
              'You are a personal task planner. Respond ONLY with valid JSON containing a "tasks" array.',
          },
          { role: 'user', content: buildPlannerPrompt(rawText, categories, existingTasks, focusAreas) },
        ],
        temperature: 0.4,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      console.warn('[ai-planner] OpenAI error, using fallback')
      return null
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (typeof content !== 'string') return null

    return parseOpenAiResponse(content, categories, focusAreas)
  } catch (err) {
    console.warn('[ai-planner] OpenAI call failed, using fallback', err)
    return null
  }
}

function plannerOutputToTasks(outputs: PlannerTaskOutput[]): Task[] {
  return outputs.map((item) => ({
    id: generateId(),
    title: item.title,
    rawInput: item.rawInput,
    category: item.category,
    status: 'open' as const,
    createdAt: new Date().toISOString(),
    source: 'ai' as const,
  }))
}

async function planTasksFromText(
  rawText: string,
  categories: Category[],
  existingTasks: Task[],
  focusAreas?: FocusArea[],
): Promise<Task[]> {
  const aiResult = await callOpenAiPlanner(rawText, categories, existingTasks, focusAreas)
  if (aiResult) {
    return plannerOutputToTasks(aiResult)
  }

  return plannerOutputToTasks(mockPlanFromText(rawText, categories))
}

export function useAiPlanner(
  categories: Category[],
  existingTasks: Task[] = [],
  focusAreas?: FocusArea[],
): AiPlannerResult & {
  planFromText: (rawText: string) => Promise<Task[]>
  reset: () => void
} {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const planFromText = useCallback(
    async (rawText: string): Promise<Task[]> => {
      if (!rawText.trim()) {
        setError('Please enter some text first.')
        return []
      }

      setIsProcessing(true)
      setError(null)

      const safeCategories = Array.isArray(categories) ? categories : []
      const safeExisting = Array.isArray(existingTasks) ? existingTasks : []

      try {
        const result = await planTasksFromText(rawText, safeCategories, safeExisting, focusAreas)
        setTasks(result)
        return result
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to process tasks'
        setError(msg)
        return []
      } finally {
        setIsProcessing(false)
      }
    },
    [categories, existingTasks, focusAreas],
  )

  const reset = useCallback(() => {
    setTasks([])
    setError(null)
    setIsProcessing(false)
  }, [])

  return { tasks, isProcessing, error, planFromText, reset }
}
