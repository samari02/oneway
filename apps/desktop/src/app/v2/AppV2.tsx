import { useState, type ReactNode } from 'react'
import { useAuth, LoginForm } from '@/features/auth'
import { useExtensionStatus } from '@/features/boundaries'
import { OnboardingFlow, useOnboardingStatus, saveOnboardingData } from '@/features/onboarding'
import type { OnboardingData } from '@/features/onboarding'
import './AppV2.css'

type V2Tab = 'today' | 'focus' | 'boundaries' | 'settings'

function V2Loader() {
  return (
    <div className="v2-root v2-loader">
      <div className="v2-loader__mark" aria-label="Loading" />
    </div>
  )
}

function V2LoginShell() {
  return (
    <div className="v2-root v2-login">
      <div className="v2-login__panel">
        <p className="v2-login__eyebrow">Design v2</p>
        <h1 className="v2-login__title">Clarity, reimagined.</h1>
        <p className="v2-login__copy">
          Experimental shell for a completely different product direction. Auth and data still use the current backend.
        </p>
        <div className="v2-login__classic">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}

function V2TodayPanel() {
  const { status } = useExtensionStatus()

  return (
    <>
      <section className="v2-hero">
        <h2 className="v2-hero__title">Stay on one path.</h2>
        <p className="v2-hero__copy">
          This is the new visual direction: editorial typography, warm paper tones, bottom navigation instead of a sidebar.
          Iterate here without touching the classic app on <code>main</code>.
        </p>
        <div className="v2-grid">
          <article className="v2-card">
            <p className="v2-card__label">Protection</p>
            <p className="v2-card__value">
              {status?.alertLevel === 'ok' ? 'Connected' : 'Check extension'}
            </p>
            <p className="v2-card__hint">
              {status?.alertLevel === 'ok'
                ? 'Extension heartbeat looks healthy.'
                : 'Load the Chrome extension and native host from the classic setup guide.'}
            </p>
          </article>
          <article className="v2-card">
            <p className="v2-card__label">Direction</p>
            <p className="v2-card__value">v2 shell</p>
            <p className="v2-card__hint">Replace these cards with real habits, boundaries, and screen time views.</p>
          </article>
          <article className="v2-card">
            <p className="v2-card__label">Branch</p>
            <p className="v2-card__value">design/v2</p>
            <p className="v2-card__hint">Worktree folder: <code>oneway-design-v2</code></p>
          </article>
        </div>
      </section>
      <p className="v2-note">
        Next iteration ideas: single-column day plan, softer mascot, no purple accents, focus mode as full-screen state.
      </p>
    </>
  )
}

function V2PlaceholderPanel({ title, copy }: { title: string; copy: string }) {
  return (
    <section className="v2-panel">
      <h2 className="v2-panel__title">{title}</h2>
      <p className="v2-panel__copy">{copy}</p>
    </section>
  )
}

function V2Shell() {
  const [tab, setTab] = useState<V2Tab>('today')

  const panels: Record<V2Tab, ReactNode> = {
    today: <V2TodayPanel />,
    focus: (
      <V2PlaceholderPanel
        title="Focus"
        copy="Future home for deep work sessions, timers, and distraction friction."
      />
    ),
    boundaries: (
      <V2PlaceholderPanel
        title="Boundaries"
        copy="Future home for block lists, schedules, and protection status."
      />
    ),
    settings: (
      <V2PlaceholderPanel
        title="Settings"
        copy="Future home for account, theme, extension setup, and data controls."
      />
    ),
  }

  const tabs: { id: V2Tab; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'focus', label: 'Focus' },
    { id: 'boundaries', label: 'Boundaries' },
    { id: 'settings', label: 'Settings' },
  ]

  return (
    <div className="v2-root v2-shell">
      <header className="v2-topbar">
        <div className="v2-topbar__brand">Clarity</div>
        <span className="v2-topbar__badge">Design v2</span>
      </header>

      <main className="v2-main">{panels[tab]}</main>

      <nav className="v2-nav" aria-label="Primary">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`v2-nav__item${tab === item.id ? ' v2-nav__item--active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

function V2AuthenticatedApp() {
  const { user } = useAuth()
  const { needsOnboarding, loading, refetch } = useOnboardingStatus(user?.id)

  const handleOnboardingComplete = async (data: OnboardingData) => {
    if (!user) return
    await saveOnboardingData(user.id, data)
    refetch()
  }

  if (loading) return <V2Loader />
  if (needsOnboarding) return <OnboardingFlow onComplete={handleOnboardingComplete} />

  return <V2Shell />
}

export function AppV2() {
  const { user, loading } = useAuth()

  if (loading) return <V2Loader />
  if (!user) return <V2LoginShell />

  return <V2AuthenticatedApp />
}
