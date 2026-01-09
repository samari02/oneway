import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import type { User } from '@supabase/supabase-js'
import './App.css'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setError('Check your email to confirm your account!')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      }
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (loading && !error) {
    return (
      <div className="container center">
        <div className="loader" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container center">
        <div className="logo">⚡</div>
        <h1>oneway</h1>
        <p className="tagline">One path. No distractions.</p>
        
        <form onSubmit={handleAuth} className="auth-form">
          <input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button type="submit" disabled={loading}>
            {loading ? '...' : isSignUp ? 'Sign Up' : 'Login'}
          </button>
        </form>

        <button 
          className="switch-auth" 
          onClick={() => { setIsSignUp(!isSignUp); setError('') }}
        >
          {isSignUp ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
        </button>
        
        {error && <p className={error.includes('Check') ? 'message success' : 'message error'}>{error}</p>}
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
