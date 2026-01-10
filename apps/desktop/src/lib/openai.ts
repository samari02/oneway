/**
 * OpenAI Service for Goal Refinement
 * 
 * Uses GPT-4o-mini for cost-effective, fast responses
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o-mini'

// Store API key in localStorage (client-side only)
const API_KEY_STORAGE_KEY = 'clarity_openai_api_key'

export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE_KEY)
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE_KEY, key)
}

export function removeApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY)
}

export function hasApiKey(): boolean {
  return !!getApiKey()
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GoalRefinementResult {
  refined_goal: string
  habits: Array<{
    name: string
    icon: string
    scheduled_time?: string
    duration_minutes?: number
    type: 'do' | 'avoid'
    avoid_category?: 'digital' | 'physical'
  }>
  follow_up_question?: string
}

const SYSTEM_PROMPT = `You are a friendly, supportive life coach helping someone define their goals and build better habits. You work for Clarity, an app that helps people build digital wellness habits.

Your role:
1. Help users clarify vague goals into specific, actionable ones
2. Suggest concrete habits that support their goals
3. Be encouraging but practical
4. Keep responses concise and conversational

When the user's goal is clear enough, provide structured suggestions.

IMPORTANT: When you have enough information, respond with a JSON block like this:
\`\`\`json
{
  "refined_goal": "A clear, specific version of their goal",
  "habits": [
    {
      "name": "Habit name",
      "icon": "emoji",
      "scheduled_time": "HH:MM",
      "duration_minutes": 15,
      "type": "do"
    },
    {
      "name": "Boundary name",
      "icon": "emoji", 
      "type": "avoid",
      "avoid_category": "digital"
    }
  ],
  "follow_up_question": null
}
\`\`\`

If you need more information, ask ONE focused follow-up question and set follow_up_question to your question.

Always be warm and use the user's language (French if they write in French).`

export async function chatWithAI(
  messages: ChatMessage[],
  userGoal: string
): Promise<{ response: string; suggestions?: GoalRefinementResult }> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('No API key configured')
  }

  const fullMessages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `My initial goal is: "${userGoal}"` },
    ...messages
  ]

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: fullMessages,
      temperature: 0.7,
      max_tokens: 1000
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Failed to call OpenAI API')
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content || ''

  // Try to parse JSON from the response
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/)
  if (jsonMatch) {
    try {
      const suggestions = JSON.parse(jsonMatch[1]) as GoalRefinementResult
      // Remove the JSON block from the display text
      const textResponse = content.replace(/```json\n[\s\S]*?\n```/, '').trim()
      return { response: textResponse, suggestions }
    } catch {
      // JSON parsing failed, return as plain text
    }
  }

  return { response: content }
}

export async function refineGoal(
  currentGoal: string,
  conversationHistory: ChatMessage[]
): Promise<{ response: string; suggestions?: GoalRefinementResult }> {
  return chatWithAI(conversationHistory, currentGoal)
}
