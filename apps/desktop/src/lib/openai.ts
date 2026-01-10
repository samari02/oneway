/**
 * OpenAI Service for Goal Refinement
 * 
 * Empathetic AI coach that helps users define meaningful goals
 */

import { supabase } from './supabase'

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

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GoalRefinementResult {
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

export interface UserContext {
  displayName?: string
  currentGoal?: string
  habits?: Array<{ name: string; icon: string; type: string }>
  goals?: Array<{ name: string; icon: string; progress: number }>
  wakeTime?: string
  sleepTime?: string
  problems?: string[]
  previousConversations?: string
}

const buildSystemPrompt = (context: UserContext) => `Tu es un coach bienveillant et empathique qui aide les gens à définir leurs objectifs de vie. Tu travailles pour Clarity, une app qui aide à développer de meilleures habitudes.

${context.displayName ? `Tu parles à ${context.displayName}.` : ''}

## Ta personnalité
- Tu es chaleureux, patient et genuinement curieux
- Tu écoutes vraiment avant de conseiller
- Tu valides les émotions ("Je comprends que ça peut être frustrant...")
- Tu poses des questions profondes sur le "pourquoi", pas juste le "quoi"
- Tu es direct mais jamais condescendant
- Tu utilises un ton conversationnel, comme un ami qui te veut du bien

## Ton approche
1. **D'abord comprendre** — Explore la motivation profonde. Pourquoi cet objectif compte vraiment ?
2. **Identifier les blocages** — Qu'est-ce qui a empêché d'y arriver jusqu'ici ?
3. **Visualiser le succès** — À quoi ressemble la vie quand c'est accompli ?
4. **Seulement ensuite** — Proposer des actions concrètes

## Ce que tu sais sur cette personne
${context.currentGoal ? `- Sa North Star (vision long terme) : "${context.currentGoal}"` : ''}
${context.goals && context.goals.length > 0 ? `- Ses goals actuels : ${context.goals.map(g => `${g.name} (${g.progress}%)`).join(', ')}` : ''}
${context.wakeTime ? `- Se réveille à ${context.wakeTime}` : ''}
${context.sleepTime ? `- Se couche à ${context.sleepTime}` : ''}
${context.habits && context.habits.length > 0 ? `- Ses habitudes actuelles : ${context.habits.map(h => `${h.icon} ${h.name}`).join(', ')}` : ''}
${context.previousConversations ? `\n## Conversations précédentes\n${context.previousConversations}` : ''}

## Règles importantes
- Réponds TOUJOURS dans la langue de l'utilisateur (français si français)
- Garde tes réponses courtes et percutantes (2-4 phrases max par message)
- Ne rush pas vers les suggestions — prends le temps de comprendre
- Pose UNE seule question à la fois
- Sois spécifique dans tes questions ("Qu'est-ce qui te manque le plus ?" vs "Parle-moi de ton objectif")

## Quand proposer des suggestions
Seulement quand tu as compris :
1. Le POURQUOI profond (motivation émotionnelle)
2. Les OBSTACLES actuels
3. La VISION du succès

Alors, et seulement alors, génère un bloc JSON :
\`\`\`json
{
  "refined_goal": "Objectif reformulé de façon inspirante et personnelle",
  "habits": [
    {
      "name": "Nom de l'habitude",
      "icon": "emoji",
      "scheduled_time": "HH:MM",
      "duration_minutes": 15,
      "type": "do"
    }
  ]
}
\`\`\`

Commence toujours par accueillir la personne chaleureusement et poser une question qui creuse le pourquoi.`

// ============================================
// Conversation History Storage
// ============================================

interface ConversationEntry {
  id: string
  user_id: string
  messages: ChatMessage[]
  context: UserContext
  created_at: string
  updated_at: string
}

export async function saveConversation(
  userId: string,
  messages: ChatMessage[],
  context: UserContext
): Promise<void> {
  const { error } = await supabase
    .from('ai_conversations')
    .upsert({
      user_id: userId,
      messages: JSON.stringify(messages),
      context: JSON.stringify(context),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    })

  if (error) {
    console.error('Failed to save conversation:', error)
  }
}

export async function loadConversation(userId: string): Promise<{
  messages: ChatMessage[]
  context: UserContext
} | null> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return null
  }

  return {
    messages: JSON.parse(data.messages),
    context: JSON.parse(data.context)
  }
}

export async function clearConversation(userId: string): Promise<void> {
  await supabase
    .from('ai_conversations')
    .delete()
    .eq('user_id', userId)
}

// Build a summary of previous conversations for context
export async function getPreviousConversationsSummary(userId: string): Promise<string | undefined> {
  const saved = await loadConversation(userId)
  if (!saved || saved.messages.length === 0) {
    return undefined
  }

  // Create a brief summary of the last conversation
  const lastMessages = saved.messages.slice(-6) // Last 3 exchanges
  const summary = lastMessages
    .filter(m => m.role !== 'system')
    .map(m => `${m.role === 'user' ? 'Utilisateur' : 'Coach'}: ${m.content.substring(0, 150)}${m.content.length > 150 ? '...' : ''}`)
    .join('\n')

  return summary ? `Dernière conversation:\n${summary}` : undefined
}

// ============================================
// Main Chat Function
// ============================================

export async function chatWithAI(
  messages: ChatMessage[],
  userGoal: string,
  context: UserContext = {}
): Promise<{ response: string; suggestions?: GoalRefinementResult }> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('No API key configured')
  }

  const systemPrompt = buildSystemPrompt({
    ...context,
    currentGoal: userGoal
  })

  const fullMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages
  ]

  // If this is the first message, add the goal as context
  if (messages.length === 0) {
    fullMessages.push({
      role: 'user',
      content: `Mon objectif : "${userGoal}"`
    })
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: fullMessages,
      temperature: 0.8, // Slightly higher for more personality
      max_tokens: 800
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
  conversationHistory: ChatMessage[],
  context: UserContext = {}
): Promise<{ response: string; suggestions?: GoalRefinementResult }> {
  return chatWithAI(conversationHistory, currentGoal, context)
}
