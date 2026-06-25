import { useState, useEffect } from 'react'
import { useAuth } from '@/features/auth'
import { getUserContext } from '../../api/userContext'
import { MonkChatModal } from './MonkChatModal'

export function MonkContextPrompt() {
  const { user } = useAuth()
  const [contextText, setContextText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    getUserContext(user.id)
      .then((ctx) => setContextText(ctx?.context_text ?? null))
      .catch(() => setContextText(null))
      .finally(() => setLoading(false))
  }, [user])

  const handleCloseChat = () => {
    setChatOpen(false)
    if (user) {
      getUserContext(user.id)
        .then((ctx) => setContextText(ctx?.context_text ?? null))
        .catch(() => {})
    }
  }

  if (loading) return null

  return (
    <div className="monk-ctx">
      {contextText ? (
        <p className="monk-ctx__status">
          <span className="monk-ctx__dot" aria-hidden />
          Monk knows a bit about you
          <button type="button" className="monk-ctx__link" onClick={() => setChatOpen(true)}>
            update
          </button>
        </p>
      ) : (
        <button type="button" className="monk-ctx__invite" onClick={() => setChatOpen(true)}>
          Monk doesn&apos;t know you yet — tell him what you&apos;re working on
        </button>
      )}
      <MonkChatModal open={chatOpen} onClose={handleCloseChat} />
    </div>
  )
}
