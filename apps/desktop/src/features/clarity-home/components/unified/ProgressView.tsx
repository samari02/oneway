import type { CSSProperties } from 'react'
import type { FocusArea } from '@oneway/shared'
import { useAuth } from '@/features/auth'
import { useFocusAreaStore } from '../../hooks/useFocusAreaStore'
import { useProgressStats } from '../../hooks/useProgressStats'
import { formatGoalDate } from '../../api/progressStats'
import './UnifiedHome.css'

function resolveAreaLabel(areaId: string | null, focusAreas: FocusArea[]): string {
  if (!areaId) return 'Other'
  return focusAreas.find((a) => a.id === areaId)?.label ?? areaId
}

export function ProgressView() {
  const { user } = useAuth()
  const { activeAreas } = useFocusAreaStore(user?.id)
  const { summary, loading, error } = useProgressStats(user?.id, activeAreas)

  const hasData = (summary?.weekGroups.length ?? 0) > 0

  return (
    <div className="progress-view">
      <div className="progress-view__bg" aria-hidden />

      <div className="progress-view__shell">
        <header className="progress-view__header">
          <h1 className="progress-view__title">Your Journey</h1>
          <p className="progress-view__subtitle">Quiet progress, tracked over time.</p>
        </header>

        {loading && (
          <div className="progress-view__empty">
            <p className="progress-view__empty-text">Loading your progress…</p>
          </div>
        )}

        {error && (
          <div className="progress-view__empty">
            <p className="progress-view__empty-text">{error}</p>
          </div>
        )}

        {!loading && !error && summary && (
          <>
            <section aria-label="This week">
              <span className="progress-view__section-label">This week</span>
              <div className="progress-view__week-summary">
                <div className="progress-view__week-stats">
                  <div className="progress-view__stat">
                    <span className="progress-view__stat-value">{summary.weekTotal}</span>
                    <span className="progress-view__stat-label">Completed</span>
                  </div>
                  <div className="progress-view__stat">
                    <span className="progress-view__stat-value">{summary.lastWeekTotal}</span>
                    <span className="progress-view__stat-label">Last week</span>
                  </div>
                  <div className="progress-view__stat">
                    <span className="progress-view__stat-value">{summary.areaStats.filter((a) => a.thisWeek > 0).length}</span>
                    <span className="progress-view__stat-label">Active areas</span>
                  </div>
                </div>
              </div>
            </section>

            {summary.areaStats.length > 0 ? (
              <section aria-label="Focus areas">
                <span className="progress-view__section-label">Focus areas</span>
                <div className="progress-view__areas">
                  {summary.areaStats.map((area) => (
                    <article key={area.areaId} className="progress-view__area-card">
                      <div className="progress-view__area-header">
                        {area.emoji && <span className="progress-view__area-emoji">{area.emoji}</span>}
                        <span className="progress-view__area-label">{area.label}</span>
                        <span
                          className="progress-view__area-dot"
                          style={{ background: area.color ?? '#a78bfa' } as CSSProperties}
                          aria-hidden
                        />
                      </div>
                      <div className="progress-view__area-stats">
                        <div className="progress-view__area-stat">
                          <span className="progress-view__area-stat-value">{area.totalCompleted}</span>
                          <span className="progress-view__area-stat-label">All time</span>
                        </div>
                        <div className="progress-view__area-stat">
                          <span className="progress-view__area-stat-value">{area.thisWeek}</span>
                          <span className="progress-view__area-stat-label">This week</span>
                        </div>
                        <div className="progress-view__area-stat">
                          <span className="progress-view__area-stat-value">{area.streak}</span>
                          <span className="progress-view__area-stat-label">Streak</span>
                        </div>
                        <div className="progress-view__area-stat">
                          <span className="progress-view__area-stat-value">
                            {area.lastActiveDate ? formatGoalDate(area.lastActiveDate) : '—'}
                          </span>
                          <span className="progress-view__area-stat-label">Last active</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : (
              <div className="progress-view__empty">
                <div className="progress-view__empty-icon" aria-hidden>🌱</div>
                <p className="progress-view__empty-text">
                  No completed goals yet. Finish a few tasks and Monk will start tracking your journey.
                </p>
              </div>
            )}

            {hasData ? (
              <section aria-label="Timeline">
                <span className="progress-view__section-label">Timeline</span>
                <div className="progress-view__timeline">
                  {summary.weekGroups.map((group) => (
                    <div key={group.weekStartKey} className="progress-view__week-group">
                      <div className="progress-view__week-header">
                        <span className="progress-view__week-title">{group.weekLabel}</span>
                        <span className="progress-view__week-count">{group.totalCount} completed</span>
                      </div>
                      <div className="progress-view__week-goals">
                        {group.goals.map((goal) => (
                          <div key={`${goal.planDate}-${goal.goalId}`} className="progress-view__goal-row">
                            <span className="progress-view__goal-area">
                              {resolveAreaLabel(goal.areaId, activeAreas)}
                            </span>
                            <span className="progress-view__goal-title">{goal.title}</span>
                            <span className="progress-view__goal-date">{formatGoalDate(goal.planDate)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section aria-label="Monk observations">
              <span className="progress-view__section-label">Monk observes</span>
              {summary.observations.length > 0 ? (
                <div className="progress-view__observations">
                  {summary.observations.map((text) => (
                    <p key={text} className="progress-view__observation">
                      <span className="progress-view__observation-icon" aria-hidden>🧘</span>
                      {text}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="progress-view__empty">
                  <p className="progress-view__empty-text">
                    Keep going — Monk will share insights once you have a few days of data.
                  </p>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
