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
}

export type MorningPlanExtraction = {
  items: ExtractedPlanItem[]
  avatarMessage: string
  priorityQuestion: string
  summaryFrame?: string
}

const SYSTEM_PROMPT = `You are a warm, opinionated-but-kind morning planning coach for Clarity, a focus app.

The user will share a messy brain dump about their day. Extract and structure it into:
- goals: directional outcomes (what they're moving toward)
- tasks: specific actionable items (concrete things to do)
- routines: recurring or low-thought items (habits, errands, maintenance)

Rules:
- Return 3–5 total items across all categories (prioritize what matters most)
- Keep each item concise (under 12 words)
- Match the user's language (English if they write in English, French if French)
- Be kind and encouraging in avatarMessage (1–2 sentences)
- priorityQuestion should ask which ONE item would make today feel like a win
- summaryFrame: one inspiring line framing the day if they pick their top priority (optional, under 15 words)

Respond ONLY with valid JSON matching this schema:
{
  "goals": ["string"],
  "tasks": ["string"],
  "routines": ["string"],
  "avatarMessage": "string",
  "priorityQuestion": "string",
  "summaryFrame": "string"
}`

function parseExtraction(raw: unknown): MorningPlanExtraction | null {
  if (!raw || typeof raw !== 'object') return null

  const data = raw as Record<string, unknown>
  const goals = Array.isArray(data.goals) ? data.goals.filter((g): g is string => typeof g === 'string') : []
  const tasks = Array.isArray(data.tasks) ? data.tasks.filter((t): t is string => typeof t === 'string') : []
  const routines = Array.isArray(data.routines)
    ? data.routines.filter((r): r is string => typeof r === 'string')
    : []

  const items: ExtractedPlanItem[] = [
    ...goals.map((text) => ({ text: text.trim(), kind: 'goal' as const })),
    ...tasks.map((text) => ({ text: text.trim(), kind: 'task' as const })),
    ...routines.map((text) => ({ text: text.trim(), kind: 'routine' as const })),
  ].filter((item) => item.text.length > 0)

  if (items.length === 0) return null

  const avatarMessage =
    typeof data.avatarMessage === 'string' && data.avatarMessage.trim()
      ? data.avatarMessage.trim()
      : "Here's what I pulled from your brain dump."

  const priorityQuestion =
    typeof data.priorityQuestion === 'string' && data.priorityQuestion.trim()
      ? data.priorityQuestion.trim()
      : 'Which one would make today a win?'

  const summaryFrame =
    typeof data.summaryFrame === 'string' && data.summaryFrame.trim()
      ? data.summaryFrame.trim()
      : undefined

  return { items, avatarMessage, priorityQuestion, summaryFrame }
}

export function fallbackExtraction(brainDump: string): MorningPlanExtraction {
  const trimmed = brainDump.trim()
  return {
    items: [{ text: trimmed, kind: 'goal' }],
    avatarMessage: "Let's keep it simple — one clear focus for today.",
    priorityQuestion: 'Does this feel like your priority?',
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
        temperature: 0.6,
        max_tokens: 600,
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
