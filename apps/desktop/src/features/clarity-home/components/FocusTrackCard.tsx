import { MOCK_HERO } from '../mock-data'

function WavySparkline({ values }: { values: number[] }) {
  const width = 200
  const height = 48
  const max = Math.max(...values, 1)
  const step = width / (values.length - 1)

  const points = values.map((v, i) => {
    const x = i * step
    const y = height - (v / max) * (height - 8) - 4
    return `${x},${y}`
  })

  const linePath = `M ${points.join(' L ')}`
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`

  return (
    <svg
      className="ch-sparkline ch-sparkline--wave"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="ch-sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#ch-sparkline-fill)" />
      <path d={linePath} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function FocusTrackCard() {
  return (
    <article className="ch-glass-card ch-focus-track">
      <div className="ch-focus-track__status">
        <span className="ch-status-pill">
          <span className="ch-status-pill__dot" aria-hidden />
          {MOCK_HERO.status}
        </span>
      </div>
      <p className="ch-focus-track__metric">{MOCK_HERO.focusedLabel}</p>
      <WavySparkline values={MOCK_HERO.sparkline} />
    </article>
  )
}
