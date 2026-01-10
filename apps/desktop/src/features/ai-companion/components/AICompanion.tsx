import { useState, useRef, useEffect } from 'react'
import { 
  hasApiKey, 
  refineGoal, 
  saveConversation,
  type UserContext,
  type ChatMessage as AIChatMessage
} from '@/lib/openai'
import type { Habit } from '@oneway/shared'
import './AICompanion.css'

type ConversationMode = 'north_star' | 'habits' | 'progress' | 'tasks' | null

interface AICompanionProps {
  userId: string
  displayName?: string
  currentGoal?: string
  habits: Habit[]
  checkedIds: Set<string>
  userSettings?: {
    wake_time?: string
    sleep_time?: string
  }
  onGoalUpdate?: (goal: string) => void
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const MODE_CONFIG = {
  north_star: {
    icon: '🎯',
    label: 'Ma North Star',
    systemContext: 'L\'utilisateur veut travailler sur son objectif principal (North Star). Aide-le à le définir, le clarifier ou le décomposer en sous-objectifs.'
  },
  habits: {
    icon: '🔧',
    label: 'Mes habitudes',
    systemContext: 'L\'utilisateur veut discuter de ses habitudes. Il peut vouloir en créer, ajuster les horaires, en supprimer ou optimiser son setup.'
  },
  progress: {
    icon: '📊',
    label: 'Mon progrès',
    systemContext: 'L\'utilisateur veut discuter de son progrès. Analyse ses check-ins, identifie les patterns, célèbre les victoires et aide sur les blocages.'
  },
  tasks: {
    icon: '📝',
    label: 'Mes tâches',
    systemContext: 'Les tâches quotidiennes arrivent bientôt ! Pour l\'instant, dis à l\'utilisateur que cette fonctionnalité est en cours de développement.'
  }
}

function getContextualGreeting(displayName?: string, hour?: number): string {
  const name = displayName || ''
  const h = hour ?? new Date().getHours()
  
  const greetings = [
    `Hey${name ? ` ${name}` : ''} ! Comment je peux t'aider ?`,
    `Salut${name ? ` ${name}` : ''} ! De quoi tu veux parler aujourd'hui ?`,
    `${name ? `${name}, ` : ''}qu'est-ce qui te ferait du bien là ?`,
  ]
  
  // Time-based greetings
  if (h >= 5 && h < 12) {
    greetings.push(`Bonjour${name ? ` ${name}` : ''} ! Prêt pour ta journée ?`)
  } else if (h >= 18 && h < 22) {
    greetings.push(`Bonsoir${name ? ` ${name}` : ''} ! Comment s'est passée ta journée ?`)
  } else if (h >= 22 || h < 5) {
    greetings.push(`Encore debout${name ? ` ${name}` : ''} ? On discute avant de dormir ?`)
  }
  
  return greetings[Math.floor(Math.random() * greetings.length)]
}

export function AICompanion({
  userId,
  displayName,
  currentGoal,
  habits,
  checkedIds,
  userSettings,
  onGoalUpdate
}: AICompanionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [mode, setMode] = useState<ConversationMode>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [userInput, setUserInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [greeting, setGreeting] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  
  const hasKey = hasApiKey()

  // Set greeting when expanded
  useEffect(() => {
    if (isExpanded && !greeting) {
      setGreeting(getContextualGreeting(displayName))
    }
  }, [isExpanded, displayName, greeting])

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const buildContext = (): UserContext => {
    const completedToday = habits.filter(h => checkedIds.has(h.id)).length
    const totalHabits = habits.length
    
    return {
      displayName,
      currentGoal,
      habits: habits.map(h => ({ 
        name: h.name, 
        icon: h.icon || '✨', 
        type: h.habit_type || 'do' 
      })),
      wakeTime: userSettings?.wake_time,
      sleepTime: userSettings?.sleep_time,
    }
  }

  const selectMode = async (selectedMode: ConversationMode) => {
    if (selectedMode === 'tasks') {
      // Placeholder for tasks
      setMode(selectedMode)
      setChatMessages([{
        role: 'assistant',
        content: '📝 Les tâches quotidiennes arrivent bientôt ! Cette fonctionnalité est en cours de développement. En attendant, tu peux me parler de tes habitudes ou de ta North Star !'
      }])
      return
    }

    setMode(selectedMode)
    setLoading(true)
    setChatMessages([])

    try {
      const modeConfig = MODE_CONFIG[selectedMode!]
      const context = buildContext()
      
      // Build a contextual first message based on mode
      let firstMessage = ''
      if (selectedMode === 'north_star') {
        firstMessage = currentGoal 
          ? `Mon objectif actuel : "${currentGoal}". J'aimerais en discuter.`
          : `Je n'ai pas encore défini mon objectif principal.`
      } else if (selectedMode === 'habits') {
        firstMessage = habits.length > 0
          ? `J'ai ${habits.length} habitudes. Je voudrais en discuter.`
          : `Je n'ai pas encore d'habitudes définies.`
      } else if (selectedMode === 'progress') {
        const completedToday = habits.filter(h => checkedIds.has(h.id)).length
        firstMessage = `Aujourd'hui j'ai complété ${completedToday}/${habits.length} habitudes.`
      }

      const { response } = await refineGoal(
        currentGoal || 'Pas encore défini',
        [{ role: 'user', content: firstMessage }],
        { ...context, previousConversations: modeConfig.systemContext }
      )
      
      setChatMessages([{ role: 'assistant', content: response }])
    } catch (err) {
      setChatMessages([{
        role: 'assistant',
        content: "Oops ! Je n'arrive pas à me connecter. Vérifie ta clé API dans Settings."
      }])
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!userInput.trim() || loading || !mode) return

    const newMessages = [...chatMessages, { role: 'user' as const, content: userInput }]
    setChatMessages(newMessages)
    setUserInput('')
    setLoading(true)

    try {
      const context = buildContext()
      const modeConfig = MODE_CONFIG[mode]
      const aiMessages: AIChatMessage[] = newMessages.map(m => ({
        role: m.role,
        content: m.content
      }))

      const { response } = await refineGoal(
        currentGoal || 'Pas encore défini',
        aiMessages,
        { ...context, previousConversations: modeConfig.systemContext }
      )

      const updatedMessages = [...newMessages, { role: 'assistant' as const, content: response }]
      setChatMessages(updatedMessages)

      // Save conversation
      saveConversation(userId, aiMessages, context)
    } catch (err) {
      setChatMessages([...newMessages, {
        role: 'assistant',
        content: "Oops ! Quelque chose s'est mal passé. On réessaie ?"
      }])
    } finally {
      setLoading(false)
    }
  }

  const resetConversation = () => {
    setMode(null)
    setChatMessages([])
    setGreeting(getContextualGreeting(displayName))
  }

  const closeCompanion = () => {
    setIsExpanded(false)
    // Keep state for when they reopen
  }

  if (!hasKey) {
    return null // Don't show if no API key
  }

  return (
    <div className={`ai-companion ${isExpanded ? 'ai-companion--expanded' : ''}`}>
      {/* Trigger button */}
      {!isExpanded && (
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
              <span>✨</span>
              <span>Clarity Coach</span>
            </div>
            <div className="ai-companion__header-actions">
              {mode && (
                <button 
                  className="ai-companion__back"
                  onClick={resetConversation}
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
            {/* Mode selection */}
            {!mode && (
              <div className="ai-companion__mode-select">
                <p className="ai-companion__greeting">{greeting}</p>
                <div className="ai-companion__modes">
                  {(Object.keys(MODE_CONFIG) as ConversationMode[]).map(m => (
                    <button
                      key={m}
                      className="ai-companion__mode-btn"
                      onClick={() => selectMode(m)}
                    >
                      <span>{MODE_CONFIG[m!].icon}</span>
                      <span>{MODE_CONFIG[m!].label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat interface */}
            {mode && (
              <div className="ai-companion__chat">
                <div className="ai-companion__messages">
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`ai-companion__message ai-companion__message--${msg.role}`}
                    >
                      {msg.content}
                    </div>
                  ))}
                  {loading && (
                    <div className="ai-companion__message ai-companion__message--assistant ai-companion__message--loading">
                      <span className="ai-companion__typing">●●●</span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="ai-companion__input-area">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Écris ta réponse..."
                    disabled={loading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={loading || !userInput.trim()}
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
