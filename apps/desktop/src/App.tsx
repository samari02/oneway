import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import type { User } from '@supabase/supabase-js'
import './App.css'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Check your email for the magic link!')
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loader" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container">
        <div className="logo">⚡</div>
        <h1>oneway</h1>
        <p className="tagline">One path. No distractions.</p>
        
        <form onSubmit={handleLogin} className="auth-form">
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send Magic Link'}
          </button>
        </form>
        
        {message && <p className="message">{message}</p>}
      </div>
    )
  }

  return (
    <div className="container">
      <header>
        <h1>oneway</h1>
        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      </header>

      <main>
        <section className="today">
          <h2>Today</h2>
          <p className="date">{new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'short', 
            day: 'numeric' 
          })}</p>
        </section>

        <section className="habits">
          <div className="habit">
            <span className="habit-icon">☀️</span>
            <span className="habit-name">Morning light</span>
            <button className="habit-check">○</button>
          </div>
          <div className="habit">
            <span className="habit-icon">🏃</span>
            <span className="habit-name">Exercise</span>
            <button className="habit-check">○</button>
          </div>
          <div className="habit">
            <span className="habit-icon">🧘</span>
            <span className="habit-name">Meditate</span>
            <button className="habit-check">○</button>
          </div>
        </section>

        <section className="status">
          <div className="status-card">
            <span className="status-label">Focus mode</span>
            <span className="status-value off">Off</span>
          </div>
          <div className="status-card">
            <span className="status-label">Streak</span>
            <span className="status-value">0 days</span>
          </div>
        </section>
      </main>

      <footer>
        <p className="user-email">{user.email}</p>
      </footer>
    </div>
  )
}

export default App
