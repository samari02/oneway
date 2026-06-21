import { useState } from 'react'
import { useAuth } from '@/features/auth'
import { useUserSettings } from '@/features/onboarding'
import { MORNING_BG_SRC } from '../companion-avatars'
import './MorningHome.css'

type MorningHomeViewProps = {
  firstName?: string
}

export function MorningHomeView({ firstName: firstNameProp }: MorningHomeViewProps) {
  const { user } = useAuth()
  const { settings } = useUserSettings(user?.id)
  const firstName = firstNameProp || settings?.display_name?.split(' ')[0] || 'Sam'
  const [intention, setIntention] = useState(settings?.north_star_goal?.trim() || '')
  const [bgFailed, setBgFailed] = useState(false)

  return (
    <div className={`morning-home${bgFailed ? ' morning-home--no-bg' : ''}`}>
      <div className="morning-home__hero">
        {!bgFailed && (
          <img
            className="morning-home__hero-img"
            src={MORNING_BG_SRC}
            alt=""
            aria-hidden
            onError={() => setBgFailed(true)}
          />
        )}
      </div>

      <div className="morning-home__toolbar">
        <button type="button" className="morning-home__tool-btn" aria-label="Focus mode">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="morning-home__tool-label">Focus mode</span>
        </button>
        <button type="button" className="morning-home__tool-btn morning-home__tool-btn--icon" aria-label="Focus sounds">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </button>
        <button type="button" className="morning-home__tool-btn morning-home__tool-btn--icon" aria-label="Notifications">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>
      </div>

      <main className="morning-home__content">
        <header className="morning-home__greeting-block">
          <div className="morning-home__sun" aria-hidden>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          </div>
          <h1 className="morning-home__title">Good morning, {firstName}.</h1>
          <p className="morning-home__subtitle">
            Every day is a new opportunity to stay close to what matters.
          </p>
        </header>

        <section className="morning-home__intention">
          <h2 className="morning-home__intention-title">What matters today?</h2>
          <p className="morning-home__intention-desc">Set one intention to guide your focus</p>
          <input
            className="morning-home__intention-input"
            type="text"
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            placeholder="e.g. Build the Clarity MVP, Study deeply, Be present..."
          />
          <button type="button" className="morning-home__cta">
            Begin my day →
          </button>
        </section>

        <footer className="morning-home__quote">
          The way is not in the sky. The way is in the heart. — Buddha
        </footer>
      </main>

      <div className="morning-home__mood-chip">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
        </svg>
        Peaceful morning
      </div>
    </div>
  )
}
