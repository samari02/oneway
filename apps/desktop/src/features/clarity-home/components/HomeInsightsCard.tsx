import { useMemo } from 'react'
import { useBrowsingStats } from '@/features/stats/hooks/useBrowsingStats'
import { MOCK_INSIGHTS } from '../mock-data'

type KpiItem = {
  label: string
  value: string
  unit: string
  trend: string
  bars: number[]
}

function MiniBarChart({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  const width = 100
  const height = 32
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

function trendLabel(trend: 'up' | 'down' | 'stable'): string {
  if (trend === 'up') return '↑ trending'
  if (trend === 'down') return '↓ trending'
  return 'stable'
}

type HomeInsightsCardProps = {
  userId?: string
}

export function HomeInsightsCard({ userId }: HomeInsightsCardProps) {
  const { stats, loading } = useBrowsingStats(userId, 'today')

  const kpis = useMemo((): KpiItem[] => {
    if (!stats || loading) {
      return MOCK_INSIGHTS
    }

    const scoreBars = stats.dailyScores.length > 0
      ? stats.dailyScores.slice(-10).map((d) => d.score)
      : MOCK_INSIGHTS[0].bars

    const timeBars = scoreBars.map((score) => Math.round(score * 0.8))

    return [
      {
        label: 'Focus score',
        value: String(Math.round(stats.focusScore)),
        unit: '%',
        trend: trendLabel(stats.focusTrend),
        bars: scoreBars.length >= 3 ? scoreBars : MOCK_INSIGHTS[0].bars,
      },
      {
        label: 'Intentional time',
        value: formatMinutes(stats.totalTimeTracked),
        unit: '',
        trend: stats.dataSource.isConnected ? 'today' : 'mock',
        bars: timeBars.length >= 3 ? timeBars : MOCK_INSIGHTS[1].bars,
      },
      MOCK_INSIGHTS[2],
    ]
  }, [stats, loading])

  return (
    <article className="ch-glass-card ch-insights-card">
      <div className="ch-insights-card__head">
        <h2 className="ch-glass-card__title">Insights</h2>
        <button type="button" className="ch-glass-card__link">
          View all
        </button>
      </div>

      <div className="ch-kpi-grid">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="ch-kpi">
            <span className="ch-kpi__label">{kpi.label}</span>
            <p className="ch-kpi__value">
              {kpi.value}
              {kpi.unit && <span className="ch-kpi__unit"> {kpi.unit}</span>}
            </p>
            <div className="ch-kpi__footer">
              <span className="ch-kpi__trend">{kpi.trend}</span>
              <MiniBarChart values={kpi.bars} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}
