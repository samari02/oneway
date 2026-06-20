import { useMemo, useState, type ReactNode } from 'react'
import { useAuth, LoginForm } from '@/features/auth'
import { useUserSettings } from '@/features/onboarding'
import { OnboardingFlow, useOnboardingStatus, saveOnboardingData } from '@/features/onboarding'
import type { OnboardingData } from '@/features/onboarding'
import { isSkipAuthPreview } from '@/lib/ui-variant'
import { CompanionCharacter, COMPANION_AVATAR_SRC, getCompanionAvatar, getOtherCompanionAvatarId, type CompanionAvatarId } from './CompanionCharacter'
import './AppV2.css'

type V2Nav = 'home' | 'sessions' | 'insights' | 'habits' | 'settings'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function getFirstName(displayName?: string, email?: string | null): string {
  if (displayName?.trim()) return displayName.trim().split(/\s+/)[0]
  if (email) return email.split('@')[0] ?? 'there'
  return 'Alex'
}

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
        <h1 className="v2-login__title">Clarity</h1>
        <p className="v2-login__copy">Sign in to preview the new companion UI.</p>
        <LoginForm />
      </div>
    </div>
  )
}

function NavIcon({ name }: { name: V2Nav | 'home' }) {
  const paths: Record<string, string> = {
    home: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z',
    sessions: 'M4 6h16v12H4z M8 10h8 M8 14h5',
    insights: 'M5 18V9 M12 18V5 M19 18v-7',
    habits: 'M8 6h8M8 10h8M8 14h5M6 4v16',
    settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  }
  return (
    <svg className="v2-nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d={paths[name] ?? paths.home} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function V2HomeView({ firstName }: { firstName: string }) {
  const greeting = getGreeting()
  const [avatarId, setAvatarId] = useState<CompanionAvatarId>('jian')
  const avatar = getCompanionAvatar(avatarId)
  const otherAvatar = getCompanionAvatar(getOtherCompanionAvatarId(avatarId))

  return (
    <>
      <header className="v2-header">
        <div>
          <h1 className="v2-header__title">
            {greeting}, {firstName} <span className="v2-header__sparkle">✦</span>
          </h1>
          <p className="v2-header__subtitle">Let&apos;s make this night productive.</p>
        </div>
        <div className="v2-header__actions">
          <button type="button" className="v2-icon-btn v2-icon-btn--notify" aria-label="Notifications">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15 17H9l1-2h4l1 2Z" strokeLinecap="round" />
              <path d="M12 3a5 5 0 0 0-5 5v4l-2 3h14l-2-3V8a5 5 0 0 0-5-5Z" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className="v2-icon-btn" aria-label="Insights">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 18V9M12 18V5M19 18v-7" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <section className="v2-stage" aria-label="AI companion">
        <div className="v2-bubble v2-bubble--left">
          <p className="v2-bubble__text">
            You&apos;ve been focused for <strong>43 minutes</strong>.
          </p>
          <p className="v2-bubble__sub">Keep going, you&apos;re building your future.</p>
          <div className="v2-bubble__heart">♡</div>
        </div>
        <div className="v2-stage__frame">
        </div>
        <div className="v2-bubble v2-bubble--right">
          <span className="v2-bubble__text">Take a deep breath</span>
          <span className="v2-wave" aria-hidden>
            <span />
            <span />
            <span />
            <span />
          </span>
        </div>
      </section>

      <div className="v2-companion-orb-wrap">
        <div className="v2-companion-orb">
          <CompanionCharacter
            key={avatarId}
            avatarId={avatarId}
            className="v2-companion-orb__canvas"
          />
        </div>
        <button
          type="button"
          className="v2-companion-orb__toggle"
          onClick={() => setAvatarId(getOtherCompanionAvatarId(avatarId))}
          aria-label={`Switch avatar to ${otherAvatar.label}`}
          title={`Avatar: ${avatar.label} — click for ${otherAvatar.label}`}
        >
          {avatar.label}
        </button>
      </div>

      <section className="v2-cards">
        <article className="v2-card">
          <div className="v2-card__head">
            <h2 className="v2-card__title">Today</h2>
            <button type="button" className="v2-card__link">View details &gt;</button>
          </div>
          <p className="v2-card__metric">5h 35m</p>
          <p className="v2-card__metric-label">Intentional time</p>
          <div className="v2-progress" aria-hidden>
            <div className="v2-progress__focused" />
            <div className="v2-progress__distracted" />
          </div>
          <div className="v2-legend">
            <span><i className="v2-legend__dot v2-legend__dot--focused" />4h 22m Focused</span>
            <span><i className="v2-legend__dot v2-legend__dot--distracted" />1h 13m Distracted</span>
          </div>
        </article>

        <article className="v2-card">
          <div className="v2-card__head">
            <h2 className="v2-card__title">Current state</h2>
          </div>
          <p className="v2-state">
            <span className="v2-state__dot" aria-hidden />
            Focused
          </p>
          <p className="v2-state__copy">
            You&apos;re in a deep focus flow. Keep protecting your attention.
          </p>
          <div className="v2-chips">
            <span className="v2-chip">🎧 Focus</span>
            <span className="v2-chip">〰 White noise</span>
            <span className="v2-chip">🍃 Nature</span>
          </div>
        </article>
      </section>
    </>
  )
}

function V2Placeholder({ title, copy }: { title: string; copy: string }) {
  return (
    <section className="v2-panel">
      <h2 className="v2-panel__title">{title}</h2>
      <p className="v2-panel__copy">{copy}</p>
    </section>
  )
}

function V2Shell({ previewName }: { previewName?: string }) {
  const { user } = useAuth()
  const { settings } = useUserSettings(user?.id)
  const [nav, setNav] = useState<V2Nav>('home')
  const [focusMode, setFocusMode] = useState(true)

  const firstName = useMemo(
    () => previewName ?? getFirstName(settings?.display_name, user?.email),
    [previewName, settings?.display_name, user?.email],
  )

  const navItems: { id: V2Nav; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'insights', label: 'Insights' },
    { id: 'habits', label: 'Habits' },
    { id: 'settings', label: 'Settings' },
  ]

  const content: Record<V2Nav, ReactNode> = {
    home: <V2HomeView firstName={firstName} />,
    sessions: <V2Placeholder title="Sessions" copy="Focus sessions and timers will live here." />,
    insights: <V2Placeholder title="Insights" copy="Screen time and trends will live here." />,
    habits: <V2Placeholder title="Habits" copy="Daily habits and check-ins will live here." />,
    settings: <V2Placeholder title="Settings" copy="Account, extension, and preferences will live here." />,
  }

  return (
    <div className="v2-root v2-app">
      <aside className="v2-sidebar">
        <div className="v2-brand">
          <span className="v2-brand__mark" aria-hidden />
          Clarity
        </div>

        <nav className="v2-nav" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`v2-nav__item${nav === item.id ? ' v2-nav__item--active' : ''}`}
              onClick={() => setNav(item.id)}
            >
              <NavIcon name={item.id} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="v2-sidebar__footer">
          <div className="v2-focus-toggle">
            <span className="v2-focus-toggle__label">Focus Mode</span>
            <button
              type="button"
              className={`v2-switch${focusMode ? ' v2-switch--on' : ''}`}
              onClick={() => setFocusMode((v) => !v)}
              aria-pressed={focusMode}
              aria-label="Toggle focus mode"
            >
              <span className="v2-switch__thumb" />
            </button>
          </div>
          <div className="v2-profile">
            <img className="v2-profile__avatar" src={COMPANION_AVATAR_SRC} alt="" />
            <span className="v2-profile__name">{greetingShort(firstName)}</span>
          </div>
        </div>
      </aside>

      <main className="v2-main">{content[nav]}</main>
    </div>
  )
}

function greetingShort(name: string): string {
  const g = getGreeting()
  return `${g}, ${name}`
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
  const skipPreview = isSkipAuthPreview()
  const { user, loading } = useAuth()

  if (skipPreview) {
    return <V2Shell previewName="Alex" />
  }

  if (loading) return <V2Loader />
  if (!user) return <V2LoginShell />

  return <V2AuthenticatedApp />
}
