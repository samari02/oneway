import { Mascot } from '@/features/mascot'
import { MOCK_HERO, MOCK_INTENTION } from '../mock-data'

type HomeHeaderProps = {
  greeting: string
  firstName: string
  intentionText?: string | null
}

function MiniSparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  const width = 120
  const height = 36
  const barWidth = width / values.length - 2

  return (
    <svg
      className="ch-sparkline"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden
    >
      {values.map((v, i) => {
        const barH = (v / max) * (height - 4)
        return (
          <rect
            key={i}
            x={i * (barWidth + 2)}
            y={height - barH}
            width={barWidth}
            height={barH}
            rx={2}
            fill="currentColor"
            opacity={0.35 + (i / values.length) * 0.55}
          />
        )
      })}
    </svg>
  )
}

export function HomeHeader({ greeting, firstName, intentionText }: HomeHeaderProps) {
  const intention = {
    ...MOCK_INTENTION,
    text: intentionText?.trim() || MOCK_INTENTION.text,
  }
  const { text, progress, focusedMinutes, targetMinutes } = intention
  const pct = Math.round(progress * 100)

  return (
    <header className="ch-home-hero">
      <div className="ch-home-hero__intro">
        <h1 className="ch-home-hero__greeting">
          {greeting}, {firstName} <span className="ch-home-hero__sparkle">✦</span>
        </h1>
        <p className="ch-home-hero__subtitle">Let&apos;s make today intentional.</p>
      </div>

      <div className="ch-home-hero__row">
        <article className="ch-glass-card ch-intention-card">
          <div className="ch-intention-card__head">
            <span className="ch-glass-card__eyebrow">Today&apos;s intention</span>
            <button type="button" className="ch-glass-card__link">
              Edit
            </button>
          </div>
          <p className="ch-intention-card__text">{text}</p>
          <div className="ch-intention-card__progress">
            <div className="ch-intention-card__bar" aria-hidden>
              <div className="ch-intention-card__fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="ch-intention-card__stat">
              {focusedMinutes}m / {targetMinutes}m
            </span>
          </div>
        </article>

        <div className="ch-home-hero__character">
          <div className="ch-hero-character">
            <div className="ch-hero-character__frame">
              <Mascot mood="happy" size="large" showMessage={false} />
            </div>
            <div className="ch-hero-character__meta">
              <span className="ch-status-pill">
                <span className="ch-status-pill__dot" aria-hidden />
                {MOCK_HERO.status}
              </span>
              <span className="ch-hero-character__detail">{MOCK_HERO.statusDetail}</span>
              <MiniSparkline values={MOCK_HERO.sparkline} />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
