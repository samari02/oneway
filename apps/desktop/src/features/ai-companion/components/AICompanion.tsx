import { useState, useRef, useEffect, useCallback } from 'react'
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
  isTyping?: boolean
}

const MODE_CONFIG = {
  north_star: {
    icon: '🎯',
    label: 'North Star',
    systemContext: 'L\'utilisateur veut travailler sur son objectif principal (North Star). Aide-le à le définir, le clarifier ou le décomposer en sous-objectifs.'
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
  checkedIds,
  userSettings,
  onGoalUpdate
}: AICompanionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [mode, setMode] = useState<ConversationMode>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [userInput, setUserInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [typingMessageIndex, setTypingMessageIndex] = useState<number | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const hasKey = hasApiKey()

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, typingMessageIndex])

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
      wakeTime: userSettings?.wake_time,
      sleepTime: userSettings?.sleep_time,
    }
  }, [displayName, currentGoal, habits, userSettings])

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

      // Add assistant message with typing animation
      const updatedMessages = [...newMessages, { role: 'assistant' as const, content: response }]
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
  }

  const closeCompanion = () => {
    setIsExpanded(false)
  }

  if (!hasKey) {
    return null
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
              <div className="ai-companion__messages">
                {chatMessages.length === 0 && !mode && (
                  <div className="ai-companion__placeholder">
                    Choisis un sujet ou écris directement 👆
                  </div>
                )}
                
                {chatMessages.length === 0 && mode && mode !== 'tasks' && (
                  <div className="ai-companion__placeholder">
                    Qu'est-ce que tu veux me dire ?
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
                <div ref={chatEndRef} />
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
