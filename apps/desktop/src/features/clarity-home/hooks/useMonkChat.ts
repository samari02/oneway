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
  | 'areas_explore'
  | 'projects'
  | 'projects_explore'
  | 'tasks'
  | 'tasks_explore'
  | 'priorities'
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
  collectedTasks: string[]
  areaNotes: string
  projectNotes: string
  taskNotes: string
  priorityNotes: string
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
const MODEL = 'gpt-4o'

const MONK_SYSTEM_PROMPT = `You are Monk, a warm and thoughtful productivity coach in the Clarity app.

Your style:
- Speak like a supportive coach having a real conversation, not a form or survey
- Always reflect back something meaningful the user said before asking your next question
- Ask ONE focused follow-up question at a time — be curious, gently inquisitive
- Help the user discover and clarify their focus areas, projects, and priorities through dialogue
- Keep messages to 2-4 sentences — warm, human, not verbose
- The app UI is in English, but if the user writes in French, respond naturally in French
- Never rush to conclusions — explore before proposing anything
- Do NOT use bullet lists unless reflecting back what the user listed
- Do NOT propose a plan or structure yet — that comes later`

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

function buildConversationHistory(
  messages: ChatMessage[],
): { role: string; content: string }[] {
  return messages.map((m) => ({
    role: m.role === 'monk' ? 'assistant' : 'user',
    content: m.text,
  }))
}

async function askMonk(
  instruction: string,
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
          { role: 'system', content: MONK_SYSTEM_PROMPT },
          ...conversationSoFar,
          { role: 'user', content: instruction },
        ],
        temperature: 0.75,
        max_tokens: 500,
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
  tasks: string[],
  notes: { areas: string; projects: string; tasks: string; priorities: string },
): Promise<{ areas: ProposedArea[]; tasks: ProposedTask[] } | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null

  const prompt = `You are a productivity coach. Based on this conversation with the user, generate their workspace.

Focus areas mentioned: ${areas.join(', ')}
Area context: ${notes.areas || '(none)'}
Projects/goals: ${projects.join(', ')}
Project context: ${notes.projects || '(none)'}
Tasks mentioned: ${tasks.join(', ')}
Task context: ${notes.tasks || '(none)'}
Priorities: ${notes.priorities || '(none)'}

Generate a JSON response with:
1. "areas": array of {label, emoji, color} for each focus area (use hex colors from: #7c3aed, #f97316, #22c55e, #3b82f6, #ec4899, #eab308, #14b8a6)
2. "tasks": array of {title, areaLabel} — clear actionable tasks (verb + object, max 6 words), assigned to the best area label. Include tasks from the conversation plus any implied by their projects.

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
        max_tokens: 1000,
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

const INITIAL_STATE: MonkChatState = {
  messages: [],
  phase: 'welcome',
  isTyping: false,
  proposedAreas: [],
  proposedTasks: [],
  collectedAreas: [],
  collectedProjects: [],
  collectedTasks: [],
  areaNotes: '',
  projectNotes: '',
  taskNotes: '',
  priorityNotes: '',
}

export function useMonkChat(
  existingCategories: Category[],
  existingFocusAreas: FocusArea[],
) {
  const [state, setState] = useState<MonkChatState>(INITIAL_STATE)

  const phaseRef = useRef(state.phase)
  phaseRef.current = state.phase

  const stateRef = useRef(state)
  stateRef.current = state

  const addMessages = useCallback((...msgs: ChatMessage[]) => {
    setState((s) => ({ ...s, messages: [...s.messages, ...msgs] }))
  }, [])

  const setTyping = useCallback((typing: boolean) => {
    setState((s) => ({ ...s, isTyping: typing }))
  }, [])

  const simulateTyping = useCallback(
    async (delay = 1200): Promise<void> => {
      setTyping(true)
      await new Promise((r) => setTimeout(r, delay))
      setTyping(false)
    },
    [setTyping],
  )

  const start = useCallback(async () => {
    setState(INITIAL_STATE)

    await new Promise((r) => setTimeout(r, 400))

    const hasExisting = existingFocusAreas.length > 0 || existingCategories.length > 1
    const welcomeText = hasExisting
      ? "Hey — I see you've already got some things set up. I'd love to understand your world a little better before we refine anything. What are the main areas of your life you want to focus on right now?"
      : "Hey, I'm Monk. I'm here to help you get organized — but first, I want to really understand your world. What are the big areas of your life you want to track? Think work, health, hobbies, side projects… whatever matters to you."

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
      const s = stateRef.current
      const history = buildConversationHistory(s.messages)

      if (currentPhase === 'areas') {
        const areas = parseListFromText(trimmed)
        setState((prev) => ({
          ...prev,
          collectedAreas: areas.length > 0 ? areas : [trimmed],
          areaNotes: trimmed,
        }))

        await simulateTyping()

        const aiResponse = await askMonk(
          `The user just shared their focus areas: "${trimmed}". Reflect back what you heard warmly, then ask ONE deeper question — e.g. which area feels most important right now, or what each area means to them personally. Do not ask about projects yet.`,
          history,
        )

        const responseText =
          aiResponse ??
          `I hear you — ${areas.join(', ')}. Those are meaningful areas to focus on. Which of these feels most important to you right now, or is there one that's been neglected lately?`

        addMessages(monkMsg(responseText))
        setState((prev) => ({ ...prev, phase: 'areas_explore' }))
      } else if (currentPhase === 'areas_explore') {
        setState((prev) => ({
          ...prev,
          areaNotes: [prev.areaNotes, trimmed].filter(Boolean).join('. '),
        }))

        await simulateTyping()

        const areas = s.collectedAreas
        const aiResponse = await askMonk(
          `The user elaborated on their focus areas. Areas so far: ${areas.join(', ')}. Their latest message: "${trimmed}". Acknowledge what they shared, then transition naturally to asking about their current projects or goals within these areas. One warm question about what they're actively working on.`,
          history,
        )

        const responseText =
          aiResponse ??
          `Thank you for sharing that — it helps me understand what matters to you. Now, tell me about your current projects or goals. What are you actively working on in these areas?`

        addMessages(
          monkMsg(responseText, [
            'Building a side project',
            'Getting healthier',
            'Learning something new',
          ]),
        )
        setState((prev) => ({ ...prev, phase: 'projects' }))
      } else if (currentPhase === 'projects') {
        const projects = parseListFromText(trimmed)
        setState((prev) => ({
          ...prev,
          collectedProjects: projects.length > 0 ? projects : [trimmed],
          projectNotes: trimmed,
        }))

        await simulateTyping()

        const aiResponse = await askMonk(
          `The user shared their projects/goals: "${trimmed}". Reflect back what you heard, then ask ONE follow-up — e.g. which project excites them most, what's blocking progress, or what success looks like for one of them. Do not ask about tasks yet.`,
          history,
        )

        const responseText =
          aiResponse ??
          `Those are great goals. Which one feels most alive for you right now — or is there one where you're feeling stuck?`

        addMessages(monkMsg(responseText))
        setState((prev) => ({ ...prev, phase: 'projects_explore' }))
      } else if (currentPhase === 'projects_explore') {
        setState((prev) => ({
          ...prev,
          projectNotes: [prev.projectNotes, trimmed].filter(Boolean).join('. '),
        }))

        await simulateTyping()

        const aiResponse = await askMonk(
          `The user elaborated on their projects. Latest: "${trimmed}". Acknowledge warmly, then ask about specific tasks they need to get done this week — invite them to dump everything on their mind, no need to organize.`,
          history,
        )

        const responseText =
          aiResponse ??
          `Got it — that gives me a clearer picture. What specific tasks do you need to get done this week? Just dump everything that's on your mind, no need to organize it.`

        addMessages(monkMsg(responseText))
        setState((prev) => ({ ...prev, phase: 'tasks' }))
      } else if (currentPhase === 'tasks') {
        const tasks = parseListFromText(trimmed)
        setState((prev) => ({
          ...prev,
          collectedTasks: tasks.length > 0 ? tasks : [trimmed],
          taskNotes: trimmed,
        }))

        await simulateTyping()

        const aiResponse = await askMonk(
          `The user listed tasks: "${trimmed}". Reflect back briefly, then ask if anything is missing OR what their top priority is this week. Keep it conversational.`,
          history,
        )

        const responseText =
          aiResponse ??
          `That's a solid list. Is there anything else weighing on you, or if you had to pick just one thing to move forward this week — what would it be?`

        addMessages(monkMsg(responseText))
        setState((prev) => ({ ...prev, phase: 'tasks_explore' }))
      } else if (currentPhase === 'tasks_explore') {
        setState((prev) => ({
          ...prev,
          taskNotes: [prev.taskNotes, trimmed].filter(Boolean).join('. '),
          priorityNotes: trimmed,
        }))

        await simulateTyping()

        const aiResponse = await askMonk(
          `The user shared priorities: "${trimmed}". Acknowledge warmly and let them know you're putting together a plan based on everything they've shared. Keep it brief and encouraging — 1-2 sentences.`,
          history,
        )

        const responseText =
          aiResponse ??
          `Perfect — I think I have a good picture now. Give me a moment to put together a plan based on everything you've shared.`

        addMessages(monkMsg(responseText))
        setState((prev) => ({ ...prev, phase: 'priorities', isTyping: true }))

        const areas = s.collectedAreas
        const projects = s.collectedProjects
        const tasks = s.collectedTasks.length > 0 ? s.collectedTasks : parseListFromText(s.taskNotes)
        const notes = {
          areas: [s.areaNotes, trimmed].filter(Boolean).join('. '),
          projects: s.projectNotes,
          tasks: s.taskNotes,
          priorities: trimmed,
        }

        const aiResult = await askAiForTasks(areas, projects, tasks, notes)

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

          const taskLines = tasks.length > 0 ? tasks : parseListFromText(s.taskNotes)
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
        const summaryText = `Here's what I've put together based on our conversation:\n\n**Focus Areas:** ${areaList}\n\n**Tasks:** ${taskCount} task${taskCount !== 1 ? 's' : ''} organized across your areas.\n\nDoes this look right? You can confirm to save everything, or tell me what to change.`

        addMessages(monkMsg(summaryText))
        setState((prev) => ({
          ...prev,
          proposedAreas,
          proposedTasks,
          phase: 'proposal',
        }))
      } else if (currentPhase === 'proposal') {
        const lower = trimmed.toLowerCase()
        const isConfirm =
          /^(yes|yep|yeah|sure|ok|okay|confirm|looks good|perfect|great|save|do it|go ahead|lgtm|ship it|oui|d'accord|parfait|c'est bon)/i.test(
            lower,
          )

        if (isConfirm) {
          setState((prev) => ({ ...prev, phase: 'saving' }))
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
    [addMessages, simulateTyping, setTyping],
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
    setState(INITIAL_STATE)
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
