/**
 * Morning plan extraction — one-shot LLM structuring of a brain dump.
 */

import { getApiKey } from './openai'
import type { FocusArea } from '@oneway/shared'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o-mini'

export type PlanItemKind = 'goal' | 'task' | 'routine'

export type ExtractedPlanItem = {
  text: string
  kind: PlanItemKind
  area?: string
  focus_area_id?: string
}

export type ProposedFocusArea = {
  label: string
  emoji?: string
  confidence: number
}

export type MorningPlanExtraction = {
  items: ExtractedPlanItem[]
  suggestedBlockers: string[]
  suggestedDurationMinutes: number
  summaryFrame?: string
  proposedAreas?: ProposedFocusArea[]
}

const DEFAULT_BLOCKERS = ['YouTube', 'Social Media', 'Reddit', 'News']

function buildSystemPrompt(focusAreas: FocusArea[], userContext?: string): string {
  const hasAreas = focusAreas.length > 0
  const areaList = hasAreas
    ? focusAreas.map((a) => `- "${a.label}" (id: ${a.id})`).join('\n')
    : ''

  const areaInstructions = hasAreas
    ? `The user has these personal Focus Areas:
${areaList}

For each item, assign the "area" field to the Focus Area label that best fits. If a goal doesn't map to any existing area, use the closest match or leave area empty. Also set "focus_area_id" to the matching id.`
    : `The user has no Focus Areas yet. For each item, assign a general "area" label (a short descriptive phrase like "Fitness", "Work project", "Language learning") — these will be used to detect patterns over time.`

  const contextBlock = userContext
    ? `\nUser context (background about this person):\n"${userContext}"\n`
    : ''

  const proposalBlock = !hasAreas
    ? `\nIf you can clearly identify 2–5 recurring themes from the goals, include a "proposedAreas" array:
[{ "label": "Short name", "emoji": "🎯", "confidence": 0.8 }]
Only propose if themes are obvious. Confidence 0–1.`
    : ''

  return `You are a morning planning assistant for Clarity, a focus app with a silent AI companion called Monk.

The user shares a messy brain dump about their day. Extract and structure it silently — the user never sees your commentary.
${contextBlock}
Extract items into:
- goals: directional outcomes
- tasks: specific actionable items
- routines: recurring or low-thought items (habits, errands)

${areaInstructions}

Rules:
- Return 3–5 total items across all categories (prioritize what matters most)
- Keep each item concise (under 12 words)
- Match the user's language
- suggestedBlockers: pick from YouTube, Social Media, Reddit, News based on what might distract them (pre-check likely ones)
- suggestedDurationMinutes: 25, 50, or 90 based on scope (default 50)
- summaryFrame: one calm line framing the day if they protect their top priority (optional, under 15 words, no exclamation marks)
${proposalBlock}
Respond ONLY with valid JSON:
{
  "goals": [{ "text": "string", "area": "string"${hasAreas ? ', "focus_area_id": "uuid"' : ''} }],
  "tasks": [{ "text": "string", "area": "string"${hasAreas ? ', "focus_area_id": "uuid"' : ''} }],
  "routines": [{ "text": "string", "area": "string"${hasAreas ? ', "focus_area_id": "uuid"' : ''} }],
  "suggestedBlockers": ["YouTube", "Social Media"],
  "suggestedDurationMinutes": 50,
  "summaryFrame": "string"${!hasAreas ? ',\n  "proposedAreas": []' : ''}
}`
}

type RawItem = { text?: string; area?: string; focus_area_id?: string }

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
        const focus_area_id = typeof obj.focus_area_id === 'string' ? obj.focus_area_id : undefined
        return { text, kind, area: area || undefined, focus_area_id }
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

function parseProposedAreas(raw: unknown): ProposedFocusArea[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .map((entry) => ({
      label: typeof entry.label === 'string' ? entry.label.trim() : '',
      emoji: typeof entry.emoji === 'string' ? entry.emoji : undefined,
      confidence: typeof entry.confidence === 'number' ? entry.confidence : 0.7,
    }))
    .filter((a) => a.label.length > 0)
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

  const proposedAreas = parseProposedAreas(data.proposedAreas)

  return {
    items,
    suggestedBlockers,
    suggestedDurationMinutes,
    summaryFrame,
    proposedAreas: proposedAreas.length > 0 ? proposedAreas : undefined,
  }
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

export type MorningPlanOptions = {
  focusAreas?: FocusArea[]
  userContext?: string
}

export async function extractMorningPlan(
  brainDump: string,
  options: MorningPlanOptions = {},
): Promise<MorningPlanExtraction> {
  const trimmed = brainDump.trim()
  if (!trimmed) {
    throw new Error('Empty brain dump')
  }

  const apiKey = getApiKey()
  if (!apiKey) {
    return fallbackExtraction(trimmed)
  }

  const systemPrompt = buildSystemPrompt(
    options.focusAreas ?? [],
    options.userContext,
  )

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
          { role: 'system', content: systemPrompt },
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
