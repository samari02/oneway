/**
 * OpenAI Service for Goal Refinement
 * 
 * Empathetic AI coach that helps users define meaningful goals
 */

import { supabase } from './supabase'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions'
const MODEL = 'gpt-4o-mini'
const WHISPER_MODEL = 'whisper-1'

// Store API key in localStorage (client-side only)
const API_KEY_STORAGE_KEY = 'clarity_openai_api_key'

export function getApiKey(): string | null {
  const key = localStorage.getItem(API_KEY_STORAGE_KEY)?.trim()
  return key || null
}

export function setApiKey(key: string): void {
  const trimmed = key.trim()
  if (trimmed) {
    localStorage.setItem(API_KEY_STORAGE_KEY, trimmed)
  } else {
    localStorage.removeItem(API_KEY_STORAGE_KEY)
  }
}

export function removeApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY)
}

export function hasApiKey(): boolean {
  return !!getApiKey()
}

export function getMaskedApiKey(): string | null {
  const key = getApiKey()
  if (!key) return null
  if (key.length <= 4) return '••••'
  return `••••••••${key.slice(-4)}`
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

export interface ConversationEntry {
  id: string
  user_id: string
  messages: ChatMessage[]
  context: UserContext
  title: string | null
  mode: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// Generate a title from the first user message
function generateTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find(m => m.role === 'user')
  if (firstUserMessage) {
    const content = firstUserMessage.content
    return content.length > 40 ? content.substring(0, 40) + '...' : content
  }
  return 'Nouvelle conversation'
}

// Create a new conversation
export async function createConversation(
  userId: string,
  messages: ChatMessage[],
  context: UserContext,
  mode?: string
): Promise<string | null> {
  const title = generateTitle(messages)
  
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({
      user_id: userId,
      messages: JSON.stringify(messages),
      context: JSON.stringify(context),
      title,
      mode: mode || null,
      is_active: true
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to create conversation:', error)
    return null
  }

  return data?.id || null
}

// Update an existing conversation
export async function updateConversation(
  conversationId: string,
  messages: ChatMessage[],
  context: UserContext
): Promise<void> {
  const title = generateTitle(messages)
  
  const { error } = await supabase
    .from('ai_conversations')
    .update({
      messages: JSON.stringify(messages),
      context: JSON.stringify(context),
      title,
      updated_at: new Date().toISOString()
    })
    .eq('id', conversationId)

  if (error) {
    console.error('Failed to update conversation:', error)
  }
}

// Save conversation (creates new or updates existing)
export async function saveConversation(
  userId: string,
  messages: ChatMessage[],
  context: UserContext,
  conversationId?: string,
  mode?: string
): Promise<string | null> {
  if (conversationId) {
    await updateConversation(conversationId, messages, context)
    return conversationId
  } else {
    return createConversation(userId, messages, context, mode)
  }
}

// Load most recent conversation
export async function loadConversation(userId: string): Promise<{
  id: string
  messages: ChatMessage[]
  context: UserContext
  title: string | null
  mode: string | null
} | null> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return {
    id: data.id,
    messages: JSON.parse(data.messages),
    context: JSON.parse(data.context),
    title: data.title,
    mode: data.mode
  }
}

// Get a specific conversation by ID
export async function getConversation(conversationId: string): Promise<{
  id: string
  messages: ChatMessage[]
  context: UserContext
  title: string | null
  mode: string | null
  created_at: string
} | null> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('id', conversationId)
    .single()

  if (error || !data) {
    return null
  }

  return {
    id: data.id,
    messages: JSON.parse(data.messages),
    context: JSON.parse(data.context),
    title: data.title,
    mode: data.mode,
    created_at: data.created_at
  }
}

// List all conversations for a user
export async function listConversations(userId: string, limit = 20): Promise<Array<{
  id: string
  title: string | null
  mode: string | null
  created_at: string
  updated_at: string
  preview: string
}>> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('id, title, mode, created_at, updated_at, messages')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error || !data) {
    return []
  }

  return data.map(conv => {
    const messages: ChatMessage[] = JSON.parse(conv.messages)
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant')
    const preview = lastAssistantMsg 
      ? (lastAssistantMsg.content.length > 60 ? lastAssistantMsg.content.substring(0, 60) + '...' : lastAssistantMsg.content)
      : 'Conversation vide'

    return {
      id: conv.id,
      title: conv.title,
      mode: conv.mode,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      preview
    }
  })
}

// Delete a conversation
export async function deleteConversation(conversationId: string): Promise<void> {
  await supabase
    .from('ai_conversations')
    .delete()
    .eq('id', conversationId)
}

// Clear all conversations for a user
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

function audioFilenameForBlob(blob: Blob): string {
  const type = blob.type.toLowerCase()
  if (type.includes('mp4') || type.includes('m4a') || type.includes('aac')) return 'speech.m4a'
  if (type.includes('mpeg') || type.includes('mp3')) return 'speech.mp3'
  if (type.includes('wav')) return 'speech.wav'
  if (type.includes('ogg')) return 'speech.ogg'
  return 'speech.webm'
}

export async function transcribeAudio(audio: Blob, lang?: string): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('No API key configured')
  }

  if (audio.size === 0) {
    throw new Error('Empty audio')
  }

  const formData = new FormData()
  formData.append('file', audio, audioFilenameForBlob(audio))
  formData.append('model', WHISPER_MODEL)
  formData.append('response_format', 'text')
  if (lang) {
    formData.append('language', lang.split('-')[0])
  }

  let response: Response
  try {
    response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    })
  } catch (err) {
    console.error('[transcribeAudio] Network request failed:', err)
    throw new Error('Network error')
  }

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('[transcribeAudio] OpenAI API error:', response.status, errorBody)

    if (response.status === 401) {
      throw new Error('Invalid API key')
    }

    let apiMessage = 'Failed to transcribe audio'
    try {
      const parsed = JSON.parse(errorBody) as { error?: { message?: string } }
      if (parsed.error?.message) {
        apiMessage = parsed.error.message
      }
    } catch {
      if (errorBody.trim()) {
        apiMessage = errorBody.trim()
      }
    }

    throw new Error(apiMessage)
  }

  const text = (await response.text()).trim()
  if (!text) {
    throw new Error('No speech detected')
  }

  return text
}
