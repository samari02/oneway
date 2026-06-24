/**
 * Morning plan extraction — one-shot LLM structuring of a brain dump.
 */

import { getApiKey } from './openai'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o-mini'

export type PlanItemKind = 'goal' | 'task' | 'routine'

export type ExtractedPlanItem = {
  text: string
  kind: PlanItemKind
  area?: string
}

export type MorningPlanExtraction = {
  items: ExtractedPlanItem[]
  suggestedBlockers: string[]
  suggestedDurationMinutes: number
  summaryFrame?: string
}

const DEFAULT_BLOCKERS = ['YouTube', 'Social Media', 'Reddit', 'News']

const SYSTEM_PROMPT = `You are a morning planning assistant for Clarity, a focus app.

The user shares a messy brain dump about their day. Extract and structure it silently — the user never sees your commentary.

Extract items into:
- goals: directional outcomes
- tasks: specific actionable items
- routines: recurring or low-thought items (habits, errands)

For each item, assign an optional life area when clear: Work, Health, Learning, Relationships, Creativity, or Other.

Rules:
- Return 3–5 total items across all categories (prioritize what matters most)
- Keep each item concise (under 12 words)
- Match the user's language
- suggestedBlockers: pick from YouTube, Social Media, Reddit, News based on what might distract them (pre-check likely ones)
- suggestedDurationMinutes: 25, 50, or 90 based on scope (default 50)
- summaryFrame: one calm line framing the day if they protect their top priority (optional, under 15 words, no exclamation marks)

Respond ONLY with valid JSON:
{
  "goals": [{ "text": "string", "area": "Work" }],
  "tasks": [{ "text": "string", "area": "Health" }],
  "routines": [{ "text": "string", "area": "Other" }],
  "suggestedBlockers": ["YouTube", "Social Media"],
  "suggestedDurationMinutes": 50,
  "summaryFrame": "string"
}`

type RawItem = { text?: string; area?: string }

function parseItemList(raw: unknown, kind: PlanItemKind): ExtractedPlanItem[] {
  if (!Array.isArray(raw)) return []

  return raw
    .map((entry): ExtractedPlanItem | null => {
      if (typeof entry === 'string') {
        const text = entry.trim()
        return text ? { text, kind } : null
      }
      if (entry && typeof entry === 'object') {
        const obj = entry as RawItem
        const text = typeof obj.text === 'string' ? obj.text.trim() : ''
        if (!text) return null
        const area = typeof obj.area === 'string' ? obj.area.trim() : undefined
        return { text, kind, area: area || undefined }
      }
      return null
    })
    .filter((item): item is ExtractedPlanItem => item !== null)
}

function parseBlockers(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_BLOCKERS]
  const labels = raw.filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
  return labels.length > 0 ? labels : [...DEFAULT_BLOCKERS]
}

function parseExtraction(raw: unknown): MorningPlanExtraction | null {
  if (!raw || typeof raw !== 'object') return null

  const data = raw as Record<string, unknown>
  const items: ExtractedPlanItem[] = [
    ...parseItemList(data.goals, 'goal'),
    ...parseItemList(data.tasks, 'task'),
    ...parseItemList(data.routines, 'routine'),
  ]

  if (items.length === 0) return null

  const suggestedBlockers = parseBlockers(data.suggestedBlockers)

  const durationRaw = data.suggestedDurationMinutes
  const suggestedDurationMinutes =
    typeof durationRaw === 'number' && durationRaw > 0 ? durationRaw : 50

  const summaryFrame =
    typeof data.summaryFrame === 'string' && data.summaryFrame.trim()
      ? data.summaryFrame.trim()
      : undefined

  return { items, suggestedBlockers, suggestedDurationMinutes, summaryFrame }
}

export function fallbackExtraction(brainDump: string): MorningPlanExtraction {
  const trimmed = brainDump.trim()
  return {
    items: [{ text: trimmed, kind: 'goal', area: 'Work' }],
    suggestedBlockers: [...DEFAULT_BLOCKERS],
    suggestedDurationMinutes: 50,
    summaryFrame: undefined,
  }
}

export async function extractMorningPlan(brainDump: string): Promise<MorningPlanExtraction> {
  const trimmed = brainDump.trim()
  if (!trimmed) {
    throw new Error('Empty brain dump')
  }

  const apiKey = getApiKey()
  if (!apiKey) {
    return fallbackExtraction(trimmed)
  }

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
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: trimmed },
        ],
        temperature: 0.5,
        max_tokens: 700,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      console.warn('[morning-plan] OpenAI error, using fallback')
      return fallbackExtraction(trimmed)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (typeof content !== 'string') {
      return fallbackExtraction(trimmed)
    }

    const parsed = parseExtraction(JSON.parse(content))
    if (!parsed) {
      return fallbackExtraction(trimmed)
    }

    return parsed
  } catch (err) {
    console.warn('[morning-plan] extraction failed, using fallback', err)
    return fallbackExtraction(trimmed)
  }
}
