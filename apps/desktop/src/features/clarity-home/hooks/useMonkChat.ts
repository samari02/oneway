import { useCallback, useRef, useState } from 'react'
import { getApiKey } from '@/lib/openai'
import type { FocusArea } from '@oneway/shared'
import type { Category } from './useCategoryStore'

export type ChatRole = 'monk' | 'user'

export type ChatMessage = {
  id: string
  role: ChatRole
  text: string
  timestamp: number
  options?: string[]
}

export type MonkChatPhase =
  | 'welcome'
  | 'areas'
  | 'projects'
  | 'tasks'
  | 'proposal'
  | 'saving'
  | 'done'

export type ProposedArea = {
  label: string
  emoji: string
  color: string
}

export type ProposedTask = {
  title: string
  areaLabel: string
}

type MonkChatState = {
  messages: ChatMessage[]
  phase: MonkChatPhase
  isTyping: boolean
  proposedAreas: ProposedArea[]
  proposedTasks: ProposedTask[]
  collectedAreas: string[]
  collectedProjects: string[]
}

const AREA_COLORS = [
  '#7c3aed', '#f97316', '#22c55e', '#3b82f6', '#ec4899',
  '#eab308', '#14b8a6', '#f43f5e', '#06b6d4', '#8b5cf6',
]

const AREA_EMOJIS: Record<string, string> = {
  work: '💼', health: '❤️', learning: '📘', personal: '🏠',
  fitness: '💪', creative: '🎨', social: '👥', finance: '💰',
  career: '🚀', family: '👨‍👩‍👧‍👦', travel: '✈️', spiritual: '🧘',
  'side project': '💻', music: '🎵', writing: '✍️', coding: '💻',
}

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o-mini'

function msgId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function monkMsg(text: string, options?: string[]): ChatMessage {
  return { id: msgId(), role: 'monk', text, timestamp: Date.now(), options }
}

function userMsg(text: string): ChatMessage {
  return { id: msgId(), role: 'user', text, timestamp: Date.now() }
}

function guessEmoji(label: string): string {
  const lower = label.toLowerCase()
  for (const [key, emoji] of Object.entries(AREA_EMOJIS)) {
    if (lower.includes(key)) return emoji
  }
  return '📌'
}

function pickColor(index: number): string {
  return AREA_COLORS[index % AREA_COLORS.length]
}

function parseListFromText(text: string): string[] {
  const lines = text
    .split(/[\n,]+/)
    .map((l) => l.replace(/^[-•*\d.)]+\s*/, '').trim())
    .filter((l) => l.length > 0 && l.length < 80)

  if (lines.length > 0) return lines.slice(0, 10)

  return text
    .split(/\band\b|,/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 80)
    .slice(0, 10)
}

async function askAiForResponse(
  systemPrompt: string,
  conversationSoFar: { role: string; content: string }[],
): Promise<string | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null

  try {
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationSoFar,
        ],
        temperature: 0.7,
        max_tokens: 400,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? null
  } catch {
    return null
  }
}

async function askAiForTasks(
  areas: string[],
  projects: string[],
  userTaskText: string,
): Promise<{ areas: ProposedArea[]; tasks: ProposedTask[] } | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null

  const prompt = `You are a productivity coach. The user told you about their life.

Areas of focus: ${areas.join(', ')}
Projects/goals: ${projects.join(', ')}
Tasks they mentioned: "${userTaskText}"

Generate a JSON response with:
1. "areas": array of {label, emoji, color} for each focus area (use hex colors from this palette: #7c3aed, #f97316, #22c55e, #3b82f6, #ec4899, #eab308, #14b8a6)
2. "tasks": array of {title, areaLabel} — clear actionable tasks (verb + object, max 6 words), assigned to the best area label

Respond ONLY with valid JSON: {"areas": [...], "tasks": [...]}`

  try {
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return null
    const parsed = JSON.parse(content) as { areas?: ProposedArea[]; tasks?: ProposedTask[] }
    if (Array.isArray(parsed.areas) && Array.isArray(parsed.tasks)) {
      return { areas: parsed.areas, tasks: parsed.tasks }
    }
    return null
  } catch {
    return null
  }
}

export function useMonkChat(
  existingCategories: Category[],
  existingFocusAreas: FocusArea[],
) {
  const [state, setState] = useState<MonkChatState>({
    messages: [],
    phase: 'welcome',
    isTyping: false,
    proposedAreas: [],
    proposedTasks: [],
    collectedAreas: [],
    collectedProjects: [],
  })

  const phaseRef = useRef(state.phase)
  phaseRef.current = state.phase

  const addMessages = useCallback((...msgs: ChatMessage[]) => {
    setState((s) => ({ ...s, messages: [...s.messages, ...msgs] }))
  }, [])

  const setTyping = useCallback((typing: boolean) => {
    setState((s) => ({ ...s, isTyping: typing }))
  }, [])

  const simulateTyping = useCallback(
    async (delay = 800): Promise<void> => {
      setTyping(true)
      await new Promise((r) => setTimeout(r, delay))
      setTyping(false)
    },
    [setTyping],
  )

  const start = useCallback(async () => {
    setState({
      messages: [],
      phase: 'welcome',
      isTyping: false,
      proposedAreas: [],
      proposedTasks: [],
      collectedAreas: [],
      collectedProjects: [],
    })

    await new Promise((r) => setTimeout(r, 300))

    const hasExisting = existingFocusAreas.length > 0 || existingCategories.length > 1
    const welcomeText = hasExisting
      ? "Hey — I see you've already got some things set up. Let's make sure I really understand what you're working on. What are the main areas of your life you want to focus on?"
      : "Hey, I'm Monk. I'm going to help you get organized. Let's start by mapping out your world. What are the big areas of your life you want to track? Think work, health, hobbies, side projects..."

    const m = monkMsg(welcomeText, [
      'Work, Health, Learning',
      'Work, Side Project, Fitness',
      'Career, Creative, Personal',
    ])

    setState((s) => ({
      ...s,
      messages: [m],
      phase: 'areas',
    }))
  }, [existingFocusAreas, existingCategories])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      addMessages(userMsg(trimmed))
      const currentPhase = phaseRef.current

      if (currentPhase === 'areas') {
        const areas = parseListFromText(trimmed)
        setState((s) => ({ ...s, collectedAreas: areas }))

        await simulateTyping(1000)

        const aiConvo = [
          {
            role: 'assistant',
            content: `The user listed these focus areas: ${areas.join(', ')}. Respond warmly, acknowledge their areas, then ask about their current projects or goals within these areas. Keep it to 2-3 sentences. Be conversational, not formal.`,
          },
        ]
        const aiResponse = await askAiForResponse(
          'You are Monk, a calm and supportive productivity companion. Speak naturally in English, be warm but concise.',
          aiConvo,
        )

        const responseText =
          aiResponse ??
          `Nice — ${areas.join(', ')}. That's a solid foundation. Now tell me about your current projects or goals. What are you actively working on in these areas?`

        addMessages(monkMsg(responseText))
        setState((s) => ({ ...s, phase: 'projects' }))
      } else if (currentPhase === 'projects') {
        const projects = parseListFromText(trimmed)
        setState((s) => ({ ...s, collectedProjects: projects }))

        await simulateTyping(1000)

        const responseText =
          "Got it. Last thing — what specific tasks do you need to get done this week? Just dump everything that's on your mind."

        addMessages(monkMsg(responseText))
        setState((s) => ({ ...s, phase: 'tasks' }))
      } else if (currentPhase === 'tasks') {
        setState((s) => ({ ...s, phase: 'proposal', isTyping: true }))

        const areas = state.collectedAreas
        const projects = state.collectedProjects

        const aiResult = await askAiForTasks(areas, projects, trimmed)

        let proposedAreas: ProposedArea[]
        let proposedTasks: ProposedTask[]

        if (aiResult) {
          proposedAreas = aiResult.areas
          proposedTasks = aiResult.tasks
        } else {
          proposedAreas = areas.map((label, i) => ({
            label: label.charAt(0).toUpperCase() + label.slice(1),
            emoji: guessEmoji(label),
            color: pickColor(i),
          }))

          const taskLines = parseListFromText(trimmed)
          proposedTasks = taskLines.map((title) => {
            const bestArea = proposedAreas[0]?.label ?? 'General'
            const lower = title.toLowerCase()
            for (const area of proposedAreas) {
              if (lower.includes(area.label.toLowerCase())) {
                return { title, areaLabel: area.label }
              }
            }
            return { title, areaLabel: bestArea }
          })
        }

        setTyping(false)

        const areaList = proposedAreas.map((a) => `${a.emoji} ${a.label}`).join(', ')
        const taskCount = proposedTasks.length
        const summaryText = `Here's what I've put together:\n\n**Focus Areas:** ${areaList}\n\n**Tasks:** ${taskCount} task${taskCount !== 1 ? 's' : ''} organized across your areas.\n\nDoes this look right? You can confirm to save everything, or tell me what to change.`

        addMessages(monkMsg(summaryText))
        setState((s) => ({
          ...s,
          proposedAreas,
          proposedTasks,
          phase: 'proposal',
        }))
      } else if (currentPhase === 'proposal') {
        const lower = trimmed.toLowerCase()
        const isConfirm =
          /^(yes|yep|yeah|sure|ok|okay|confirm|looks good|perfect|great|save|do it|go ahead|lgtm|ship it)/i.test(
            lower,
          )

        if (isConfirm) {
          setState((s) => ({ ...s, phase: 'saving' }))
        } else {
          await simulateTyping(800)
          addMessages(
            monkMsg(
              "No problem — tell me what you'd like to change and I'll update the plan.",
            ),
          )
        }
      }
    },
    [addMessages, simulateTyping, setTyping, state.collectedAreas, state.collectedProjects],
  )

  const confirmProposal = useCallback(() => {
    setState((s) => ({ ...s, phase: 'saving' }))
  }, [])

  const markDone = useCallback(() => {
    addMessages(
      monkMsg(
        "All set! I've saved your focus areas and tasks. You're ready to start making progress.",
      ),
    )
    setState((s) => ({ ...s, phase: 'done' }))
  }, [addMessages])

  const reset = useCallback(() => {
    setState({
      messages: [],
      phase: 'welcome',
      isTyping: false,
      proposedAreas: [],
      proposedTasks: [],
      collectedAreas: [],
      collectedProjects: [],
    })
  }, [])

  return {
    messages: state.messages,
    phase: state.phase,
    isTyping: state.isTyping,
    proposedAreas: state.proposedAreas,
    proposedTasks: state.proposedTasks,
    start,
    send,
    confirmProposal,
    markDone,
    reset,
  }
}
