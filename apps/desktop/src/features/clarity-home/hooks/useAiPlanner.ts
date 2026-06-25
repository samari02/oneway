import { useCallback, useState } from 'react'
import type { Task } from './useTaskStore'
import type { Category } from './useCategoryStore'

type AiPlannerResult = {
  tasks: Task[]
  isProcessing: boolean
  error: string | null
}

/** Shape returned by the planner API (mock and future OpenAI). */
export type PlannerTaskOutput = {
  title: string
  rawInput: string
  category: string
}

const KEYWORD_RULES: { pattern: RegExp; category: string }[] = [
  { pattern: /\b(gym|exercise|workout|run|yoga|meditat|walk|stretch|health|sleep|water|diet)\b/i, category: 'health' },
  { pattern: /\b(proposal|deck|meeting|email|client|report|deadline|standup|review|sprint|jira|ticket|invoice|presentation|slack)\b/i, category: 'work' },
  { pattern: /\b(read|study|learn|course|tutorial|book|research|practice|lesson|chapter)\b/i, category: 'learning' },
  { pattern: /\b(clarity|ship|build|code|design|feature|bug|deploy|mvp|prototype|refactor|component)\b/i, category: 'clarity' },
]

const ACTION_VERBS =
  /^(read|fix|finish|write|send|call|buy|make|prep|review|update|deploy|ship|build|code|design|run|walk|study|learn|practice|go)\b/i

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

/** Rewrite a raw brain-dump line into a clear, actionable title (~6 words max). */
export function reformulateTitle(rawLine: string): string {
  const raw = cleanRawLine(rawLine)
  if (!raw) return raw

  const lower = raw.toLowerCase()

  if (/^(gym|workout|exercise)$/.test(lower)) {
    return 'Go to the gym'
  }

  const proposalMatch = raw.match(/^proposal\s+(\S+)$/i)
  if (proposalMatch) {
    const entity = proposalMatch[1]
    const formatted =
      entity === entity.toUpperCase() ? entity : capitalizeFirst(entity)
    return truncateWords(`Finish ${formatted} proposal`, 6)
  }

  if (ACTION_VERBS.test(raw)) {
    return truncateWords(capitalizeFirst(raw), 6)
  }

  return truncateWords(capitalizeFirst(raw), 6)
}

export function buildPlannerPrompt(
  rawText: string,
  categories: Category[],
  existingTasks: Task[],
): string {
  const categoryList = categories
    .filter((c) => c?.id)
    .map((c) => `- ${c.id}: ${c.emoji} ${c.label}`)
    .join('\n')

  const existingList =
    existingTasks.length > 0
      ? existingTasks.map((t) => `- ${t.title} (${t.category})`).join('\n')
      : '(none)'

  return `You are a personal task planner. Parse the user's brain dump into clear, actionable tasks.

Categories (assign exactly one per task):
${categoryList}

Existing tasks (avoid duplicates):
${existingList}

User input:
"""
${rawText.trim()}
"""

For each distinct task, return JSON array items with:
- "title": reformulated clear actionable phrase (verb + object, max ~6 words)
- "rawInput": the original line from the user input
- "category": one of the category ids above

Examples:
- "gym" → title: "Go to the gym", rawInput: "gym"
- "proposal kpmg" → title: "Finish KPMG proposal", rawInput: "proposal kpmg"
- "read chapter 3" → title: "Read chapter 3", rawInput: "read chapter 3"
- "fix onboarding bug" → title: "Fix onboarding bug", rawInput: "fix onboarding bug"`
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

/** Mock planner — uses same output shape as a future OpenAI call. */
export function mockPlanFromText(rawText: string, categories: Category[]): PlannerTaskOutput[] {
  return splitInputLines(rawText).map((line) => classifyLine(line, categories))
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

function parseAndClassify(rawText: string, categories: Category[]): Task[] {
  return plannerOutputToTasks(mockPlanFromText(rawText, categories))
}

export function useAiPlanner(categories: Category[]): AiPlannerResult & {
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

      try {
        // Simulate AI processing delay; future: call OpenAI with buildPlannerPrompt(...)
        await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 600))

        const result = parseAndClassify(rawText, safeCategories)
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
    [categories],
  )

  const reset = useCallback(() => {
    setTasks([])
    setError(null)
    setIsProcessing(false)
  }, [])

  return { tasks, isProcessing, error, planFromText, reset }
}
