import { useState } from 'react'
import type { Goal } from '@oneway/shared'
import { GoalModal } from './GoalModal'
import './GoalsBar.css'

interface GoalsBarProps {
  goals: Goal[]
  onCreateGoal: (goal: Omit<Goal, 'id' | 'created_at' | 'updated_at'>) => Promise<Goal>
  onUpdateGoal: (goalId: string, updates: Partial<Goal>) => Promise<Goal>
  onDeleteGoal: (goalId: string) => Promise<void>
  userId: string
}

export function GoalsBar({ goals, onCreateGoal, onUpdateGoal, onDeleteGoal, userId }: GoalsBarProps) {
  const [showModal, setShowModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)

  const handleGoalClick = (goal: Goal) => {
    setEditingGoal(goal)
    setShowModal(true)
  }

  const handleAddClick = () => {
    setEditingGoal(null)
    setShowModal(true)
  }

  const handleSave = async (data: { name: string; icon: string; progress: number; target_date?: string }) => {
    if (editingGoal) {
      await onUpdateGoal(editingGoal.id, data)
    } else {
      await onCreateGoal({
        user_id: userId,
        ...data
      })
    }
    setShowModal(false)
    setEditingGoal(null)
  }

  const handleDelete = async () => {
    if (editingGoal) {
      await onDeleteGoal(editingGoal.id)
      setShowModal(false)
      setEditingGoal(null)
    }
  }

  return (
    <div className="goals-bar">
      {goals.map(goal => (
        <button
          key={goal.id}
          className="goals-bar__pill"
          onClick={() => handleGoalClick(goal)}
          title={goal.name}
        >
          <span className="goals-bar__pill-icon">{goal.icon || '🎯'}</span>
          <span className="goals-bar__pill-progress">{goal.progress}%</span>
          <div className="goals-bar__pill-bar">
            <div 
              className="goals-bar__pill-fill" 
              style={{ width: `${goal.progress}%` }}
            />
          </div>
        </button>
      ))}
      
      <button 
        className="goals-bar__add"
        onClick={handleAddClick}
        title="Add goal"
      >
        +
      </button>

      {showModal && (
        <GoalModal
          goal={editingGoal}
          onSave={handleSave}
          onDelete={editingGoal ? handleDelete : undefined}
          onClose={() => {
            setShowModal(false)
            setEditingGoal(null)
          }}
        />
      )}
    </div>
  )
}
