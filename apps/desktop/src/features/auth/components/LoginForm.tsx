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
  if (lower.includes('rate limit') || lower.includes('over_email')) {
    return 'Too many reset emails sent. Wait about an hour, then try once here (same limit as the Supabase dashboard).'
  }
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

/** Must be listed in Supabase → Auth → URL Configuration → Redirect URLs */
const RESET_REDIRECT =
  import.meta.env.VITE_AUTH_RESET_REDIRECT_URL?.trim() ||
  'http://localhost:1420/reset-password.html'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [isForgot, setIsForgot] = useState(false)

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Enter your email first, then tap Forgot password.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: RESET_REDIRECT,
      })
      if (error) {
        setError(formatAuthError(error))
      } else {
        setError(
          `Reset email sent to ${email.trim()}. Before opening the link, run "pnpm dev:desktop" in the project (serves the reset page). Then open the link, set a new password, and log in here.`
        )
      }
    } catch (e) {
      setError(formatAuthError(e))
    }
    setLoading(false)
  }

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
        {!isForgot && (
          <input
            type="password"
            className="login-form__input"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        )}
        <button
          type="submit"
          className="login-form__button"
          disabled={loading || isForgot}
        >
          {loading ? '...' : isSignUp ? 'Sign Up' : 'Login'}
        </button>
      </form>

      {!isSignUp && (
        <button
          type="button"
          className="login-form__switch"
          disabled={loading}
          onClick={() => {
            if (isForgot) {
              handleForgotPassword()
            } else {
              setIsForgot(true)
              setError('')
            }
          }}
        >
          {isForgot ? 'Send reset email' : 'Forgot password?'}
        </button>
      )}

      {isForgot && (
        <button
          type="button"
          className="login-form__switch"
          onClick={() => {
            setIsForgot(false)
            setError('')
          }}
        >
          Back to login
        </button>
      )}

      <button
        className="login-form__switch"
        onClick={() => {
          setIsSignUp(!isSignUp)
          setIsForgot(false)
          setError('')
        }}
      >
        {isSignUp ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
      </button>

      {isForgot && !error && (
        <p className="login-form__message">
          Enter your email, then tap Send reset email. Uses the same Supabase quota as the dashboard.
        </p>
      )}

      {error && (
        <p
          className={`login-form__message ${
            error.includes('Check') || error.includes('sent to')
              ? 'login-form__message--success'
              : 'login-form__message--error'
          }`}
        >
          {error}
        </p>
      )}
    </div>
  )
}
