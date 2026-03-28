import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import './LoginForm.css'

function formatAuthError(err: unknown): string {
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : err instanceof Error
        ? err.message
        : String(err)
  const lower = msg.toLowerCase()
  if (
    lower.includes('load failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed')
  ) {
    return 'Cannot reach Supabase. Use the Project URL and anon/publishable key from Supabase → Settings → API. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in apps/desktop/.env.local if the defaults are wrong or the project was moved.'
  }
  return msg
}

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) {
          setError(formatAuthError(error))
        } else {
          setError('Check your email to confirm your account!')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) {
          setError(formatAuthError(error))
        }
      }
    } catch (e) {
      setError(formatAuthError(e))
    }
    setLoading(false)
  }

  return (
    <div className="login-form">
      <div className="login-form__header">
        <div className="login-form__mascot">💧</div>
        <h1 className="login-form__title">Clarity</h1>
        <p className="login-form__tagline">See clear. Stay sharp.</p>
      </div>

      <form onSubmit={handleSubmit} className="login-form__form">
        <input
          type="email"
          className="login-form__input"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          className="login-form__input"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <button 
          type="submit" 
          className="login-form__button"
          disabled={loading}
        >
          {loading ? '...' : isSignUp ? 'Sign Up' : 'Login'}
        </button>
      </form>

      <button 
        className="login-form__switch" 
        onClick={() => { setIsSignUp(!isSignUp); setError('') }}
      >
        {isSignUp ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
      </button>

      {error && (
        <p className={`login-form__message ${error.includes('Check') ? 'login-form__message--success' : 'login-form__message--error'}`}>
          {error}
        </p>
      )}
    </div>
  )
}
