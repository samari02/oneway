import { useMemo } from 'react'
import { useBrowsingStats } from '@/features/stats/hooks/useBrowsingStats'
import { MOCK_INSIGHTS } from '../mock-data'

type InsightRow = {
  label: string
  value: string
  trend: string
  bars: number[]
}

function MiniBarChart({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  const width = 72
  const height = 28
  const barWidth = width / values.length - 1.5

  return (
    <svg className="ch-mini-chart" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden>
      {values.map((v, i) => {
        const barH = (v / max) * (height - 2)
        return (
          <rect
            key={i}
            x={i * (barWidth + 1.5)}
            y={height - barH}
            width={barWidth}
            height={barH}
            rx={1.5}
            className="ch-mini-chart__bar"
          />
        )
      })}
    </svg>
  )
}

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

type HomeInsightsCardProps = {
  userId?: string
}

export function HomeInsightsCard({ userId }: HomeInsightsCardProps) {
  const { stats, loading } = useBrowsingStats(userId, 'week')

  const rows = useMemo((): InsightRow[] => {
    if (!stats || loading) {
      return MOCK_INSIGHTS
    }

    const scoreBars = stats.dailyScores.length > 0
      ? stats.dailyScores.slice(-10).map((d) => d.score)
      : MOCK_INSIGHTS[0].bars

    return [
      {
        label: 'Focused time',
        value: formatMinutes(stats.totalTimeTracked),
        trend: stats.focusTrend === 'up' ? '+12%' : stats.focusTrend === 'down' ? '-5%' : '+12%',
        bars: scoreBars.length >= 3 ? scoreBars : MOCK_INSIGHTS[0].bars,
      },
      MOCK_INSIGHTS[1],
      MOCK_INSIGHTS[2],
    ]
  }, [stats, loading])

  return (
    <article className="ch-glass-card ch-insights-card">
      <h2 className="ch-glass-card__title">Insights (This week)</h2>

      <ul className="ch-insights-list">
        {rows.map((row) => (
          <li key={row.label} className="ch-insights-row">
            <div className="ch-insights-row__text">
              <span className="ch-insights-row__label">{row.label}</span>
              <span className="ch-insights-row__value">{row.value}</span>
            </div>
            <div className="ch-insights-row__right">
              <span className="ch-insights-row__trend">{row.trend}</span>
              <MiniBarChart values={row.bars} />
            </div>
          </li>
        ))}
      </ul>

      <button type="button" className="ch-insights-card__link">
        See all insights →
      </button>
    </article>
  )
}
