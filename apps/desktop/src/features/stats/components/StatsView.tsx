import './StatsView.css'

export function StatsView() {
  return (
    <div className="stats-view">
      <header className="stats-view__header">
        <h1>Statistics</h1>
        <p className="stats-view__subtitle">Track your progress</p>
      </header>

      <section className="stats-view__placeholder">
        <span className="stats-view__icon">📊</span>
        <h2>Coming Soon</h2>
        <p>
          Streaks, weekly reviews, and pattern insights
          will appear here.
        </p>
      </section>

      <div className="stats-view__preview">
        <div className="stats-card">
          <span className="stats-card__icon">🔥</span>
          <div className="stats-card__content">
            <span className="stats-card__value">—</span>
            <span className="stats-card__label">Current Streak</span>
          </div>
        </div>

        <div className="stats-card">
          <span className="stats-card__icon">✅</span>
          <div className="stats-card__content">
            <span className="stats-card__value">—</span>
            <span className="stats-card__label">This Week</span>
          </div>
        </div>

        <div className="stats-card">
          <span className="stats-card__icon">⭐</span>
          <div className="stats-card__content">
            <span className="stats-card__value">—</span>
            <span className="stats-card__label">Best Streak</span>
          </div>
        </div>
      </div>
    </div>
  )
}
