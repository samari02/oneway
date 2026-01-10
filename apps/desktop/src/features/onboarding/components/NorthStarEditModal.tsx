import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { hasApiKey, refineGoal } from '@/lib/openai'
import type { Habit } from '@oneway/shared'
import './NorthStarEditModal.css'

interface NorthStarEditModalProps {
  userId: string
  goal: string
  icon: string
  habits: Habit[]
  onSave: () => void
  onCancel: () => void
  onAddHabits?: (habits: Array<{ name: string; icon: string; scheduled_time?: string; duration_minutes?: number }>) => Promise<void>
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AISuggestion {
  refined_goal: string
  habits: Array<{
    name: string
    icon: string
    scheduled_time?: string
    duration_minutes?: number
    type: 'do' | 'avoid'
    avoid_category?: 'digital' | 'physical'
  }>
}

const ICONS = ['🎯', '💪', '🧘', '📚', '💼', '❤️', '✨', '🌟', '🏃', '🎨', '💡', '🚀']

export function NorthStarEditModal({ 
  userId, 
  goal: initialGoal, 
  icon: initialIcon, 
  habits,
  onSave, 
  onCancel,
  onAddHabits
}: NorthStarEditModalProps) {
  const [goal, setGoal] = useState(initialGoal)
  const [icon, setIcon] = useState(initialIcon)
  const [linkedHabitIds, setLinkedHabitIds] = useState<Set<string>>(
    new Set(habits.filter(h => h.linked_to_north_star).map(h => h.id))
  )
  const [showIcons, setShowIcons] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // AI Chat state
  const [showAiChat, setShowAiChat] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [userInput, setUserInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion | null>(null)
  const [selectedSuggestedHabits, setSelectedSuggestedHabits] = useState<Set<number>>(new Set())
  const chatEndRef = useRef<HTMLDivElement>(null)
  
  const hasAiKey = hasApiKey()

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const startAiChat = async () => {
    setShowAiChat(true)
    setAiLoading(true)
    setChatMessages([])
    setAiSuggestions(null)
    
    try {
      const { response, suggestions } = await refineGoal(goal, [])
      setChatMessages([{ role: 'assistant', content: response }])
      if (suggestions) {
        setAiSuggestions(suggestions)
      }
    } catch (err) {
      setChatMessages([{ 
        role: 'assistant', 
        content: "Oops! I couldn't connect. Check your API key in Settings." 
      }])
    } finally {
      setAiLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!userInput.trim() || aiLoading) return
    
    const newMessages = [...chatMessages, { role: 'user' as const, content: userInput }]
    setChatMessages(newMessages)
    setUserInput('')
    setAiLoading(true)
    
    try {
      const { response, suggestions } = await refineGoal(goal, newMessages)
      setChatMessages([...newMessages, { role: 'assistant', content: response }])
      if (suggestions) {
        setAiSuggestions(suggestions)
      }
    } catch (err) {
      setChatMessages([...newMessages, { 
        role: 'assistant', 
        content: "Oops! Something went wrong. Try again?" 
      }])
    } finally {
      setAiLoading(false)
    }
  }

  const applySuggestions = () => {
    if (aiSuggestions) {
      setGoal(aiSuggestions.refined_goal)
      setShowAiChat(false)
    }
  }

  const toggleSuggestedHabit = (index: number) => {
    setSelectedSuggestedHabits(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const toggleHabitLink = (habitId: string) => {
    setLinkedHabitIds(prev => {
      const next = new Set(prev)
      if (next.has(habitId)) {
        next.delete(habitId)
      } else {
        next.add(habitId)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!goal.trim()) return
    setSaving(true)

    try {
      // Update user settings
      await supabase
        .from('user_settings')
        .update({
          north_star_goal: goal.trim(),
          north_star_icon: icon,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      // Update habits linked status
      for (const habit of habits) {
        const shouldBeLinked = linkedHabitIds.has(habit.id)
        if (habit.linked_to_north_star !== shouldBeLinked) {
          await supabase
            .from('habits')
            .update({ linked_to_north_star: shouldBeLinked })
            .eq('id', habit.id)
        }
      }

      onSave()
    } catch (err) {
      console.error('Failed to save North Star:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="north-star-modal-overlay" onClick={onCancel}>
      <div className="north-star-modal" onClick={e => e.stopPropagation()}>
        <header className="north-star-modal__header">
          <h2>🎯 Edit North Star</h2>
          <button className="north-star-modal__close" onClick={onCancel}>×</button>
        </header>

        <div className="north-star-modal__content">
          {/* Goal input */}
          <div className="north-star-modal__field">
            <label>Your goal</label>
            <div className="north-star-modal__input-row">
              <button 
                type="button"
                className="north-star-modal__icon-btn"
                onClick={() => setShowIcons(!showIcons)}
              >
                {icon}
              </button>
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="What do you want to achieve?"
              />
            </div>

            {showIcons && (
              <div className="north-star-modal__icons">
                {ICONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`north-star-modal__icon-option ${icon === emoji ? 'north-star-modal__icon-option--selected' : ''}`}
                    onClick={() => {
                      setIcon(emoji)
                      setShowIcons(false)
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            
            {/* AI Refine button */}
            {hasAiKey && !showAiChat && (
              <button
                type="button"
                className="north-star-modal__ai-btn"
                onClick={startAiChat}
                disabled={!goal.trim()}
              >
                ✨ Refine with AI
              </button>
            )}
          </div>

          {/* AI Chat interface */}
          {showAiChat && (
            <div className="north-star-modal__ai-chat">
              <div className="north-star-modal__ai-header">
                <span>✨ AI Assistant</span>
                <button 
                  type="button" 
                  className="north-star-modal__ai-close"
                  onClick={() => setShowAiChat(false)}
                >
                  ×
                </button>
              </div>
              
              <div className="north-star-modal__ai-messages">
                {chatMessages.map((msg, i) => (
                  <div 
                    key={i} 
                    className={`north-star-modal__ai-message north-star-modal__ai-message--${msg.role}`}
                  >
                    {msg.content}
                  </div>
                ))}
                {aiLoading && (
                  <div className="north-star-modal__ai-message north-star-modal__ai-message--assistant north-star-modal__ai-message--loading">
                    <span className="north-star-modal__ai-typing">●●●</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* AI Suggestions */}
              {aiSuggestions && (
                <div className="north-star-modal__ai-suggestions">
                  <div className="north-star-modal__ai-suggestion-goal">
                    <label>✅ Refined goal:</label>
                    <p>"{aiSuggestions.refined_goal}"</p>
                  </div>
                  
                  {aiSuggestions.habits.length > 0 && (
                    <div className="north-star-modal__ai-suggestion-habits">
                      <label>💡 Suggested habits:</label>
                      {aiSuggestions.habits.map((habit, i) => (
                        <label key={i} className="north-star-modal__ai-habit">
                          <input
                            type="checkbox"
                            checked={selectedSuggestedHabits.has(i)}
                            onChange={() => toggleSuggestedHabit(i)}
                          />
                          <span>{habit.icon}</span>
                          <span>{habit.name}</span>
                          {habit.scheduled_time && <span className="north-star-modal__ai-habit-time">{habit.scheduled_time}</span>}
                        </label>
                      ))}
                    </div>
                  )}
                  
                  <button
                    type="button"
                    className="north-star-modal__ai-apply"
                    onClick={applySuggestions}
                  >
                    Apply suggestions
                  </button>
                </div>
              )}

              {/* Chat input */}
              {!aiSuggestions && (
                <div className="north-star-modal__ai-input">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type your answer..."
                    disabled={aiLoading}
                  />
                  <button 
                    type="button" 
                    onClick={sendMessage}
                    disabled={aiLoading || !userInput.trim()}
                  >
                    →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Linked habits */}
          {habits.length > 0 && (
            <div className="north-star-modal__field">
              <label>Linked habits</label>
              <p className="north-star-modal__hint">
                Select habits that contribute to this goal
              </p>
              <div className="north-star-modal__habits">
                {habits.filter(h => h.habit_type === 'do').map(habit => (
                  <label key={habit.id} className="north-star-modal__habit">
                    <input
                      type="checkbox"
                      checked={linkedHabitIds.has(habit.id)}
                      onChange={() => toggleHabitLink(habit.id)}
                    />
                    <span className="north-star-modal__habit-icon">{habit.icon || '✨'}</span>
                    <span className="north-star-modal__habit-name">{habit.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="north-star-modal__actions">
          <button 
            className="north-star-modal__btn north-star-modal__btn--secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button 
            className="north-star-modal__btn north-star-modal__btn--primary"
            onClick={handleSave}
            disabled={!goal.trim() || saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
