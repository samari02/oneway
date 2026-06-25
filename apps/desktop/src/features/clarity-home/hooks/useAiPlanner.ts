import { useCallback, useState } from 'react'
import type { Task } from './useTaskStore'
import type { Category } from './useCategoryStore'

type AiPlannerResult = {
  tasks: Task[]
  isProcessing: boolean
  error: string | null
}

type ClassifyResult = Omit<Task, 'id' | 'createdAt' | 'status' | 'completedAt'>

const KEYWORD_RULES: { pattern: RegExp; category: string }[] = [
  { pattern: /\b(gym|exercise|workout|run|yoga|meditat|walk|stretch|health|sleep|water|diet)\b/i, category: 'health' },
  { pattern: /\b(proposal|deck|meeting|email|client|report|deadline|standup|review|sprint|jira|ticket|invoice|presentation|slack)\b/i, category: 'work' },
  { pattern: /\b(read|study|learn|course|tutorial|book|research|practice|lesson|chapter)\b/i, category: 'learning' },
  { pattern: /\b(clarity|ship|build|code|design|feature|bug|deploy|mvp|prototype|refactor|component)\b/i, category: 'clarity' },
]

function classifyLine(line: string, categories: Category[]): ClassifyResult {
  const trimmed = line.trim().replace(/^[-•*]\s*/, '').replace(/^\d+[.)]\s*/, '')
  if (!trimmed) return { title: line.trim(), category: 'clarity', source: 'ai' }

  const categoryIds = new Set(categories.map((c) => c.id))

  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(trimmed) && categoryIds.has(rule.category)) {
      return { title: trimmed, category: rule.category, source: 'ai' }
    }
  }

  return { title: trimmed, category: 'clarity', source: 'ai' }
}

function generateId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function parseAndClassify(rawText: string, categories: Category[]): Task[] {
  const lines = rawText
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) return []

  if (lines.length === 1 && !lines[0].includes(',')) {
    const classified = classifyLine(lines[0], categories)
    return [
      {
        id: generateId(),
        title: classified.title,
        category: classified.category,
        status: 'open',
        createdAt: new Date().toISOString(),
        source: 'ai',
      },
    ]
  }

  const expanded = lines.flatMap((line) => {
    if (line.includes(',') && !line.includes('\n')) {
      return line.split(',').map((s) => s.trim()).filter(Boolean)
    }
    return [line]
  })

  return expanded.map((text) => {
    const classified = classifyLine(text, categories)
    return {
      id: generateId(),
      title: classified.title,
      category: classified.category,
      status: 'open' as const,
      createdAt: new Date().toISOString(),
      source: 'ai' as const,
    }
  })
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

      try {
        // Simulate AI processing delay
        await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 600))

        const result = parseAndClassify(rawText, categories)
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
