import type { DaySetup } from '../../hooks/useMorningFlow'

type SetupItem = {
  key: keyof DaySetup
  label: string
  hint: string
  minimal?: boolean
}

const SETUP_ITEMS: SetupItem[] = [
  {
    key: 'blockSites',
    label: 'Block distracting websites',
    hint: 'YouTube, Shorts, Social Media',
  },
  {
    key: 'nudges',
    label: 'Gentle nudges',
    hint: 'Remind me when I drift',
  },
  {
    key: 'focusSounds',
    label: 'Focus sounds',
    hint: 'Play ambient concentration music',
  },
  {
    key: 'pomodoro',
    label: 'Pomodoro timer',
    hint: 'Use focus sessions',
  },
  {
    key: 'minimal',
    label: 'Nothing today',
    hint: "I'll go minimal",
    minimal: true,
  },
]

type MorningStepSetupProps = {
  daySetup: DaySetup
  onToggle: (patch: Partial<DaySetup>) => void
  onComplete: () => void
}

export function MorningStepSetup({ daySetup, onToggle, onComplete }: MorningStepSetupProps) {
  const handleToggle = (key: keyof DaySetup) => {
    const next = !daySetup[key]
    if (key === 'minimal') {
      onToggle({ minimal: next })
      return
    }
    onToggle({ [key]: next })
  }

  return (
    <div className="mf-stagger">
      <header>
        <h1 className="mf-title mf-title--sm">What usually helps you stay on track?</h1>
        <p className="mf-subtitle mf-subtitle--tight">We&apos;ll set things up for you.</p>
      </header>

      <section className="mf-setup" aria-labelledby="mf-setup-heading">
        <h2 id="mf-setup-heading" className="visually-hidden">
          Day setup preferences
        </h2>

        <div className="mf-setup__list">
          {SETUP_ITEMS.map((item) => {
            const on = daySetup[item.key]
            return (
              <div
                key={item.key}
                className={`mf-toggle-row${on ? ' mf-toggle-row--active' : ''}${item.minimal ? ' mf-toggle-row--minimal' : ''}`}
              >
                <div className="mf-toggle-row__text">
                  <span className="mf-toggle-row__label">{item.label}</span>
                  <span className="mf-toggle-row__hint">{item.hint}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${item.label}: ${on ? 'on' : 'off'}`}
                  className={`mf-switch${on ? ' mf-switch--on' : ''}`}
                  onClick={() => handleToggle(item.key)}
                />
              </div>
            )
          })}
        </div>

        <footer className="mf-setup__footer">
          <button type="button" className="mf-btn mf-btn--ghost">
            Customize
          </button>
          <button type="button" className="mf-btn mf-btn--primary" onClick={onComplete}>
            Use these
          </button>
        </footer>
      </section>
    </div>
  )
}
