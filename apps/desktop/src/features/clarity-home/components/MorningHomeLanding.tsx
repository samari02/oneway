import { MORNING_BG_SRC } from '../companion-avatars'
import type { DayPlan } from '../hooks/useMorningFlow'
import { getPriorityItem, getSecondaryItems, getSuccessFrameHint } from '../hooks/useMorningFlow'
import './MorningHome.css'

type MorningHomeLandingProps = {
  firstName: string
  plan: DayPlan
}

export function MorningHomeLanding({ firstName, plan }: MorningHomeLandingProps) {
  const priority = getPriorityItem(plan)
  const heroText = priority?.text || plan.intention
  const subtitle = plan.summaryFrame || getSuccessFrameHint(plan.successFrame, plan.intention)
  const secondaryItems = getSecondaryItems(plan)

  return (
    <>
      <div className="morning-home__bg" aria-hidden>
        <img className="morning-home__bg-img" src={MORNING_BG_SRC} alt="" />
      </div>

      <div className="morning-home__content">
        <div className="morning-home__greeting-block">
          <div className="morning-home__sun" aria-hidden>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          </div>
          <h1 className="morning-home__title">Good morning, {firstName}.</h1>
          <p className="morning-home__subtitle">
            Your focus is set. Stay close to what matters today.
          </p>
        </div>

        <section className="morning-home__intention" aria-labelledby="morning-home-intention">
          <h2 id="morning-home-intention" className="morning-home__intention-title">
            Today&apos;s focus
          </h2>
          <p className="morning-home__intention-desc morning-home__intention-desc--hero">{heroText}</p>
          <p className="morning-home__intention-desc">{subtitle}</p>
          {secondaryItems.length > 0 && (
            <div className="morning-home__plan-pills" aria-label="Also on your mind">
              {secondaryItems.map((item) => (
                <span key={item.id} className="morning-home__plan-pill">
                  {item.text}
                </span>
              ))}
            </div>
          )}
        </section>

        <footer className="morning-home__quote">
          The way is not in the sky. The way is in the heart. — Buddha
        </footer>
      </div>

      <div className="morning-home__mood-chip">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
        </svg>
        Peaceful morning
      </div>
    </>
  )
}
