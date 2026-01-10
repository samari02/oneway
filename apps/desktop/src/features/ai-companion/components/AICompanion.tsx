import { useState, useRef, useEffect, useCallback } from 'react'
import { 
  hasApiKey, 
  refineGoal, 
  saveConversation,
  loadConversation,
  type UserContext,
  type ChatMessage as AIChatMessage
} from '@/lib/openai'
import type { Habit, Goal } from '@oneway/shared'
import './AICompanion.css'

type ConversationMode = 'north_star' | 'goals' | 'habits' | 'progress' | 'tasks' | null

// Structured suggestion from AI
interface AISuggestion {
  type: 'goal' | 'habits' | 'goal_with_habits'
  goal?: {
    name: string
    icon: string
    target_date?: string
  }
  habits?: Array<{
    name: string
    icon: string
    scheduled_time?: string
    duration_minutes?: number
  }>
}

interface AICompanionProps {
  userId: string
  displayName?: string
  currentGoal?: string
  habits: Habit[]
  goals?: Goal[]
  checkedIds: Set<string>
  userSettings?: {
    wake_time?: string
    sleep_time?: string
  }
  onGoalUpdate?: (goal: string) => void
  onCreateGoal?: (goal: { name: string; icon: string; target_date?: string }) => Promise<Goal>
  onCreateHabits?: (habits: Array<{ name: string; icon: string; scheduled_time?: string; duration_minutes?: number; goal_id?: string }>) => Promise<void>
  // External control props
  isOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  hideTrigger?: boolean
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  isTyping?: boolean
}

const MODE_CONFIG = {
  north_star: {
    icon: '⭐',
    label: 'North Star',
    systemContext: 'L\'utilisateur veut travailler sur son objectif principal (North Star). Aide-le à le définir, le clarifier ou le décomposer en sous-objectifs.'
  },
  goals: {
    icon: '🎯',
    label: 'Goals',
    systemContext: `L'utilisateur veut créer ou définir des objectifs (goals) qui contribuent à sa North Star.
    
Ton rôle:
1. Comprendre ce qu'il veut accomplir
2. Poser des questions pour clarifier (deadline? mesure de succès?)
3. Proposer un goal structuré avec des habits associés

Quand tu proposes un goal, utilise ce format EXACT:
---SUGGESTION---
{
  "type": "goal_with_habits",
  "goal": { "name": "Nom du goal", "icon": "target|star|heart|bolt|flag|trophy|mountain|book" },
  "habits": [
    { "name": "Habit 1", "icon": "🏃", "scheduled_time": "06:30", "duration_minutes": 30 },
    { "name": "Habit 2", "icon": "🧘", "scheduled_time": "22:00", "duration_minutes": 10 }
  ]
}
---END---

Inclus ce bloc JSON seulement quand tu proposes quelque chose de concret, pas avant.`
  },
  habits: {
    icon: '🔧',
    label: 'Habitudes',
    systemContext: 'L\'utilisateur veut discuter de ses habitudes. Il peut vouloir en créer, ajuster les horaires, en supprimer ou optimiser son setup.'
  },
  progress: {
    icon: '📊',
    label: 'Progrès',
    systemContext: 'L\'utilisateur veut discuter de son progrès. Analyse ses check-ins, identifie les patterns, célèbre les victoires et aide sur les blocages.'
  },
  tasks: {
    icon: '📝',
    label: 'Tâches',
    systemContext: 'Les tâches quotidiennes arrivent bientôt !'
  }
}

// Typing animation hook
function useTypingAnimation(text: string, speed: number = 20) {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    if (!text) {
      setDisplayedText('')
      setIsComplete(false)
      return
    }

    setDisplayedText('')
    setIsComplete(false)
    let index = 0

    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1))
        index++
      } else {
        setIsComplete(true)
        clearInterval(interval)
      }
    }, speed)

    return () => clearInterval(interval)
  }, [text, speed])

  return { displayedText, isComplete }
}

// Single message with typing animation
function TypingMessage({ content, onComplete }: { content: string; onComplete?: () => void }) {
  const { displayedText, isComplete } = useTypingAnimation(content, 15)
  
  useEffect(() => {
    if (isComplete && onComplete) {
      onComplete()
    }
  }, [isComplete, onComplete])

  return (
    <div className="ai-companion__message ai-companion__message--assistant">
      {displayedText}
      {!isComplete && <span className="ai-companion__cursor">|</span>}
    </div>
  )
}

export function AICompanion({
  userId,
  displayName,
  currentGoal,
  habits,
  goals = [],
  checkedIds,
  userSettings,
  onGoalUpdate,
  onCreateGoal,
  onCreateHabits,
  isOpen: externalIsOpen,
  onOpenChange,
  hideTrigger = false
}: AICompanionProps) {
  const [internalIsExpanded, setInternalIsExpanded] = useState(false)
  
  // Support controlled or uncontrolled mode
  const isExpanded = externalIsOpen !== undefined ? externalIsOpen : internalIsExpanded
  const setIsExpanded = (value: boolean) => {
    setInternalIsExpanded(value)
    onOpenChange?.(value)
  }
  const [mode, setMode] = useState<ConversationMode>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [userInput, setUserInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [typingMessageIndex, setTypingMessageIndex] = useState<number | null>(null)
  const [pendingSuggestion, setPendingSuggestion] = useState<AISuggestion | null>(null)
  const [creatingFromSuggestion, setCreatingFromSuggestion] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const hasKey = hasApiKey()

  // Get contextual greeting from Aoi
  const getAoiGreeting = () => {
    const hour = new Date().getHours()
    const name = displayName || ''
    
    if (hour >= 5 && hour < 12) {
      return name ? `Bonjour ${name} ! Qu'est-ce qui te ferait du bien aujourd'hui ?` : `Bonjour ! Comment puis-je t'aider ce matin ?`
    } else if (hour >= 12 && hour < 18) {
      return name ? `Hey ${name} ! Comment se passe ta journée ?` : `Hey ! De quoi veux-tu parler ?`
    } else if (hour >= 18 && hour < 22) {
      return name ? `Bonsoir ${name} ! Comment s'est passée ta journée ?` : `Bonsoir ! Envie de faire le point ?`
    } else {
      return name ? `Salut ${name}... Encore debout ? 🌙` : `Salut... Tu as du mal à dormir ?`
    }
  }

  // Scroll to bottom - only within the messages container
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [chatMessages, typingMessageIndex])

  // Load conversation history when chat opens
  useEffect(() => {
    if (isExpanded && userId && chatMessages.length === 0) {
      loadConversation(userId).then(saved => {
        if (saved && saved.messages.length > 0) {
          // Filter out system messages and convert to local format
          const loadedMessages: ChatMessage[] = saved.messages
            .filter(m => m.role !== 'system')
            .map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content
            }))
          
          if (loadedMessages.length > 0) {
            setChatMessages(loadedMessages)
          }
        }
      })
    }
  }, [isExpanded, userId])

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isExpanded])

  const buildContext = useCallback((): UserContext => {
    return {
      displayName,
      currentGoal,
      habits: habits.map(h => ({ 
        name: h.name, 
        icon: h.icon || '✨', 
        type: h.habit_type || 'do' 
      })),
      goals: goals.map(g => ({
        name: g.name,
        icon: g.icon || 'target',
        progress: g.progress
      })),
      wakeTime: userSettings?.wake_time,
      sleepTime: userSettings?.sleep_time,
    }
  }, [displayName, currentGoal, habits, goals, userSettings])

  // Parse AI suggestion from response
  const parseSuggestion = (response: string): { cleanResponse: string; suggestion: AISuggestion | null } => {
    const suggestionMatch = response.match(/---SUGGESTION---\s*([\s\S]*?)\s*---END---/)
    
    if (!suggestionMatch) {
      return { cleanResponse: response, suggestion: null }
    }
    
    try {
      const suggestion = JSON.parse(suggestionMatch[1]) as AISuggestion
      const cleanResponse = response.replace(/---SUGGESTION---[\s\S]*?---END---/, '').trim()
      return { cleanResponse, suggestion }
    } catch {
      return { cleanResponse: response, suggestion: null }
    }
  }

  // Create goal and habits from suggestion
  const handleCreateFromSuggestion = async () => {
    if (!pendingSuggestion || !onCreateGoal) return
    
    setCreatingFromSuggestion(true)
    
    try {
      let goalId: string | undefined
      
      // Create goal if present
      if (pendingSuggestion.goal) {
        const newGoal = await onCreateGoal({
          name: pendingSuggestion.goal.name,
          icon: pendingSuggestion.goal.icon,
          target_date: pendingSuggestion.goal.target_date
        })
        goalId = newGoal.id
      }
      
      // Create habits if present
      if (pendingSuggestion.habits && pendingSuggestion.habits.length > 0 && onCreateHabits) {
        await onCreateHabits(pendingSuggestion.habits.map(h => ({
          ...h,
          goal_id: goalId
        })))
      }
      
      // Success message
      const successMsg = { 
        role: 'assistant' as const, 
        content: `✅ C'est fait ! J'ai créé ${pendingSuggestion.goal ? `le goal "${pendingSuggestion.goal.name}"` : ''}${pendingSuggestion.habits?.length ? ` et ${pendingSuggestion.habits.length} habitude(s)` : ''}. Tu peux les voir dans ton dashboard !`
      }
      setChatMessages(prev => [...prev, successMsg])
      setTypingMessageIndex(chatMessages.length)
      setPendingSuggestion(null)
    } catch (err) {
      console.error('Failed to create from suggestion:', err)
      const errorMsg = { role: 'assistant' as const, content: "Oops ! J'ai pas réussi à créer ça. On réessaie ?" }
      setChatMessages(prev => [...prev, errorMsg])
    } finally {
      setCreatingFromSuggestion(false)
    }
  }

  const selectMode = (selectedMode: ConversationMode) => {
    setMode(selectedMode)
    
    if (selectedMode === 'tasks') {
      const msg = { role: 'assistant' as const, content: '📝 Les tâches arrivent bientôt ! En attendant, parle-moi de tes habitudes ou de ta North Star.' }
      setChatMessages([msg])
      setTypingMessageIndex(0)
    }
    
    // Focus input after mode selection
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const sendMessage = async () => {
    if (!userInput.trim() || loading) return

    const userMessage = userInput.trim()
    setUserInput('')
    setPendingSuggestion(null) // Clear any pending suggestion
    
    // Add user message
    const newMessages = [...chatMessages, { role: 'user' as const, content: userMessage }]
    setChatMessages(newMessages)
    setLoading(true)

    try {
      const context = buildContext()
      const modeContext = mode ? MODE_CONFIG[mode].systemContext : ''
      
      const aiMessages: AIChatMessage[] = newMessages.map(m => ({
        role: m.role,
        content: m.content
      }))

      const { response } = await refineGoal(
        currentGoal || 'Pas encore défini',
        aiMessages,
        { ...context, previousConversations: modeContext }
      )

      // Parse any suggestion from the response
      const { cleanResponse, suggestion } = parseSuggestion(response)
      
      if (suggestion) {
        setPendingSuggestion(suggestion)
      }

      // Add assistant message with typing animation (cleaned of JSON)
      const updatedMessages = [...newMessages, { role: 'assistant' as const, content: cleanResponse }]
      setChatMessages(updatedMessages)
      setTypingMessageIndex(updatedMessages.length - 1)

      // Save conversation
      saveConversation(userId, aiMessages, context)
    } catch (err) {
      const errorMsg = { role: 'assistant' as const, content: "Oops ! Quelque chose s'est mal passé. On réessaie ?" }
      setChatMessages([...newMessages, errorMsg])
      setTypingMessageIndex(newMessages.length)
    } finally {
      setLoading(false)
    }
  }

  const handleTypingComplete = useCallback(() => {
    setTypingMessageIndex(null)
  }, [])

  const resetConversation = () => {
    setMode(null)
    setChatMessages([])
    setTypingMessageIndex(null)
    setPendingSuggestion(null)
  }

  const closeCompanion = () => {
    setIsExpanded(false)
  }

  if (!hasKey) {
    return null
  }

  return (
    <div className={`ai-companion ${isExpanded ? 'ai-companion--expanded' : ''}`}>
      {/* Trigger button - hidden when controlled externally */}
      {!isExpanded && !hideTrigger && (
        <button 
          className="ai-companion__trigger"
          onClick={() => setIsExpanded(true)}
        >
          <span className="ai-companion__trigger-icon">✨</span>
          <span className="ai-companion__trigger-text">Parle-moi</span>
        </button>
      )}

      {/* Expanded panel */}
      {isExpanded && (
        <div className="ai-companion__panel">
          <header className="ai-companion__header">
            <div className="ai-companion__title">
              Chat with Aoi
            </div>
            <div className="ai-companion__header-actions">
              {mode && (
                <button 
                  className="ai-companion__back"
                  onClick={resetConversation}
                  title="Retour"
                >
                  ←
                </button>
              )}
              <button 
                className="ai-companion__close"
                onClick={closeCompanion}
              >
                ×
              </button>
            </div>
          </header>

          <div className="ai-companion__content">
            {/* Mode pills - always visible at top when no mode selected */}
            {!mode && (
              <div className="ai-companion__mode-pills">
                {(Object.keys(MODE_CONFIG) as ConversationMode[]).map(m => (
                  <button
                    key={m}
                    className={`ai-companion__pill ${m === 'tasks' ? 'ai-companion__pill--disabled' : ''}`}
                    onClick={() => selectMode(m)}
                    disabled={m === 'tasks'}
                  >
                    <span>{MODE_CONFIG[m!].icon}</span>
                    <span>{MODE_CONFIG[m!].label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Active mode indicator */}
            {mode && (
              <div className="ai-companion__active-mode">
                <span>{MODE_CONFIG[mode].icon}</span>
                <span>{MODE_CONFIG[mode].label}</span>
              </div>
            )}

            {/* Chat area - always visible */}
            <div className="ai-companion__chat">
              <div className="ai-companion__messages" ref={messagesContainerRef}>
                {chatMessages.length === 0 && (
                  <div className="ai-companion__message ai-companion__message--assistant ai-companion__message--greeting">
                    {getAoiGreeting()}
                  </div>
                )}

                {chatMessages.map((msg, i) => (
                  msg.role === 'assistant' && i === typingMessageIndex ? (
                    <TypingMessage 
                      key={i} 
                      content={msg.content} 
                      onComplete={handleTypingComplete}
                    />
                  ) : (
                    <div
                      key={i}
                      className={`ai-companion__message ai-companion__message--${msg.role}`}
                    >
                      {msg.content}
                    </div>
                  )
                ))}
                
                {loading && (
                  <div className="ai-companion__message ai-companion__message--assistant ai-companion__message--loading">
                    <span className="ai-companion__typing-dots">
                      <span>●</span><span>●</span><span>●</span>
                    </span>
                  </div>
                )}

                {/* Suggestion card */}
                {pendingSuggestion && !loading && (
                  <div className="ai-companion__suggestion">
                    {pendingSuggestion.goal && (
                      <div className="ai-companion__suggestion-goal">
                        <span className="ai-companion__suggestion-label">🎯 Goal</span>
                        <span className="ai-companion__suggestion-name">{pendingSuggestion.goal.name}</span>
                      </div>
                    )}
                    {pendingSuggestion.habits && pendingSuggestion.habits.length > 0 && (
                      <div className="ai-companion__suggestion-habits">
                        <span className="ai-companion__suggestion-label">💡 Habitudes</span>
                        {pendingSuggestion.habits.map((h, i) => (
                          <div key={i} className="ai-companion__suggestion-habit">
                            <span>{h.icon}</span>
                            <span>{h.name}</span>
                            {h.scheduled_time && <span className="ai-companion__suggestion-time">{h.scheduled_time}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      className="ai-companion__suggestion-create"
                      onClick={handleCreateFromSuggestion}
                      disabled={creatingFromSuggestion}
                    >
                      {creatingFromSuggestion ? 'Création...' : '✨ Créer tout ça'}
                    </button>
                  </div>
                )}
              </div>

              {/* Input - always visible */}
              <div className="ai-companion__input-area">
                <input
                  ref={inputRef}
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (!mode && userInput.trim()) {
                        // Auto-select north_star if typing without mode
                        setMode('north_star')
                      }
                      sendMessage()
                    }
                  }}
                  placeholder={displayName ? `Hey ${displayName}, écris-moi...` : 'Écris-moi...'}
                  disabled={loading}
                />
                <button
                  onClick={() => {
                    if (!mode && userInput.trim()) {
                      setMode('north_star')
                    }
                    sendMessage()
                  }}
                  disabled={loading || !userInput.trim()}
                >
                  →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
