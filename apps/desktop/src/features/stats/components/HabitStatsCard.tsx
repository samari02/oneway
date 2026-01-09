import type { HabitStat } from '../hooks/useStats'
import './HabitStatsCard.css'

interface HabitStatsCardProps {
  habitStats: HabitStat[]
}

export function HabitStatsCard({ habitStats }: HabitStatsCardProps) {
  if (habitStats.length === 0) {
    return (
      <div className="habit-stats-card habit-stats-card--empty">
        <p>No habits yet. Add some to track your progress!</p>
      </div>
    )
  }

  return (
    <div className="habit-stats-card">
      <h3 className="habit-stats-card__title">Your habits</h3>
      <p className="habit-stats-card__subtitle">Last 14 days</p>

      <div className="habit-stats-card__list">
        {habitStats.map(({ habit, completionRate, totalCheckIns, totalDays }) => (
          <div key={habit.id} className="habit-stat">
            <div className="habit-stat__header">
              <span className="habit-stat__icon">{habit.icon || '✨'}</span>
              <span className="habit-stat__name">{habit.name}</span>
              {habit.is_required && (
                <span className="habit-stat__badge">required</span>
              )}
            </div>

            <div className="habit-stat__bar-container">
              <div className="habit-stat__bar">
                <div
                  className="habit-stat__bar-fill"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
              <span className="habit-stat__rate">{completionRate}%</span>
            </div>

            <div className="habit-stat__detail">
              {totalCheckIns} of {totalDays} days
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
