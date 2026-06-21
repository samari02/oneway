import { MOCK_SESSION } from '../mock-data'

function ProgressRing({ progress, label }: { progress: number; label: string }) {
  const size = 96
  const stroke = 6
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
      <text
        className="ch-progress-ring__label"
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {label}
      </text>
    </svg>
  )
}

export function CurrentSessionCard() {
  const { elapsed, mode, onTrack, progress, progressLabel, sites } = MOCK_SESSION

  return (
    <article className="ch-glass-card ch-session-card">
      <h2 className="ch-glass-card__title ch-session-card__title">Current session</h2>

      <div className="ch-session-card__hero">
        <p className="ch-session-card__timer">{elapsed}</p>
        <ProgressRing progress={progress} label={progressLabel} />
      </div>

      <div className="ch-session-card__meta">
        <span className="ch-session-card__mode">{mode}</span>
        {onTrack && (
          <span className="ch-session-card__on-track">
            <span className="ch-status-pill__dot" aria-hidden />
            On track
          </span>
        )}
      </div>

      <div className="ch-session-card__sites">
        <p className="ch-session-card__sites-label">Currently on</p>
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

      <button type="button" className="ch-btn ch-btn--danger ch-session-card__end">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
        End session
      </button>
    </article>
  )
}
