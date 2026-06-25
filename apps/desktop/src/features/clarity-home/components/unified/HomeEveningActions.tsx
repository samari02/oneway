import type { DailyGoal } from '@oneway/shared'

type HomeEveningActionsProps = {
  incompleteGoals: DailyGoal[]
  onCarryForward: (goalId: string) => void
  onLetGo: (goalId: string) => void
}

export function HomeEveningActions({
  incompleteGoals,
  onCarryForward,
  onLetGo,
}: HomeEveningActionsProps) {
  if (incompleteGoals.length === 0) return null

  return (
    <div className="uh-evening">
      {incompleteGoals.map((goal) => (
        <div key={goal.id} className="uh-evening__goal">
          <p className="uh-evening__goal-title">{goal.title}</p>
          <div className="uh-evening__actions">
            <button
              type="button"
              className="uh-btn uh-btn--ghost uh-btn--sm"
              onClick={() => onLetGo(goal.id)}
            >
              Let it go
            </button>
            <button
              type="button"
              className="uh-btn uh-btn--primary uh-btn--sm"
              onClick={() => onCarryForward(goal.id)}
            >
              Carry forward
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
