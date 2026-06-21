import { MOCK_SESSION } from '../mock-data'

function ProgressRing({ progress }: { progress: number }) {
  const size = 88
  const stroke = 7
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - progress)

  return (
    <svg className="ch-progress-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        className="ch-progress-ring__track"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
      />
      <circle
        className="ch-progress-ring__fill"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}

export function CurrentSessionCard() {
  const { elapsed, goal, progress, sites } = MOCK_SESSION

  return (
    <article className="ch-glass-card ch-session-card">
      <div className="ch-session-card__head">
        <h2 className="ch-glass-card__title">Current session</h2>
        <span className="ch-session-card__goal">{goal}</span>
      </div>

      <div className="ch-session-card__body">
        <div className="ch-session-card__timer-wrap">
          <ProgressRing progress={progress} />
          <span className="ch-session-card__timer">{elapsed}</span>
        </div>

        <div className="ch-session-card__sites">
          <p className="ch-session-card__sites-label">Active tabs</p>
          <div className="ch-session-card__favicons">
            {sites.map((site) => (
              <span key={site.name} className="ch-favicon-chip" title={site.name}>
                <span className="ch-favicon-chip__icon" aria-hidden>
                  {site.favicon}
                </span>
                {site.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <button type="button" className="ch-btn ch-btn--danger ch-session-card__end">
        End session
      </button>
    </article>
  )
}
